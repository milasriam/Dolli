import hashlib
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote, urlencode

import httpx
from core.auth import (
    IDTokenValidationError,
    build_authorization_url,
    build_logout_url,
    generate_code_challenge,
    generate_code_verifier,
    generate_nonce,
    generate_state,
    oidc_token_endpoint,
    validate_id_token,
)
from core.config import settings
from core.database import get_db
from dependencies.auth import _with_curated_badge, get_admin_user, get_current_user, user_row_to_response
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from fastapi.responses import RedirectResponse, Response
from models.auth import User
from models.magic_login import MagicLoginToken
from schemas.auth import (
    AdminSetUserOrganizationRequest,
    ChangePasswordRequest,
    EarlyDonorMilestoneResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginOptionsResponse,
    MarkNotificationsReadRequest,
    PlatformTokenExchangeRequest,
    ResetPasswordRequest,
    SocialAuthorizeUrlResponse,
    TokenExchangeResponse,
    UnreadNotificationsResponse,
    UserNotificationListResponse,
    UserNotificationResponse,
    UserResponse,
)
from services.auth import AuthService, as_utc_aware
from services.notify_email import (
    send_magic_login_email,
    send_password_reset_email,
    smtp_delivery_configured,
)
from services.donations import DonationsService
from services.user_notifications import UserNotificationsService
from services.social_login import (
    build_meta_authorize_url,
    build_tiktok_authorize_url,
    meta_configured,
    meta_exchange_and_profile,
    tiktok_configured,
    tiktok_exchange_and_profile,
)
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

_magic_link_last_sent: dict[str, float] = {}
_MAGIC_LINK_COOLDOWN_SEC = 60.0
_pwd_reset_last_sent: dict[str, float] = {}
_PASSWORD_RESET_COOLDOWN_SEC = 60.0


def _local_patch(url: str) -> str:
    """Patch URL for local development."""
    if os.getenv("LOCAL_PATCH", "").lower() not in ("true", "1"):
        return url

    patched_url = url.replace("https://", "http://").replace(":8000", ":3000")
    logger.debug("[get_dynamic_backend_url] patching URL from %s to %s", url, patched_url)
    return patched_url


def get_dynamic_backend_url(request: Request) -> str:
    """Get backend URL dynamically from request headers.

    Priority: mgx-external-domain > x-forwarded-host > host > settings.backend_url
    """
    mgx_external_domain = request.headers.get("mgx-external-domain")
    x_forwarded_host = request.headers.get("x-forwarded-host")
    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", "https")

    effective_host = mgx_external_domain or x_forwarded_host or host
    if not effective_host:
        logger.warning("[get_dynamic_backend_url] No host found, fallback to %s", settings.backend_url)
        return settings.backend_url

    dynamic_url = _local_patch(f"{scheme}://{effective_host}")
    logger.debug(
        "[get_dynamic_backend_url] mgx-external-domain=%s, x-forwarded-host=%s, host=%s, scheme=%s, dynamic_url=%s",
        mgx_external_domain,
        x_forwarded_host,
        host,
        scheme,
        dynamic_url,
    )
    return dynamic_url


def derive_name_from_email(email: str) -> str:
    return email.split("@", 1)[0] if email else ""


def _has_non_empty_setting(name: str) -> bool:
    try:
        value = getattr(settings, name)
    except AttributeError:
        return False
    return bool(str(value).strip())


def is_oidc_configured() -> bool:
    """Validate required OIDC settings exist and are non-empty."""
    required = ("oidc_issuer_url", "oidc_client_id", "oidc_client_secret", "oidc_scope")
    return all(_has_non_empty_setting(field) for field in required)


def is_email_password_auth_enabled() -> bool:
    return os.environ.get("ALLOW_EMAIL_PASSWORD_AUTH", "").lower() in ("1", "true", "yes")


def is_magic_link_feature_enabled() -> bool:
    if os.environ.get("ALLOW_MAGIC_LINK", "").lower() not in ("1", "true", "yes"):
        return False
    return smtp_delivery_configured()


def _infer_staging_like_deploy() -> bool:
    """True when this backend is the staging.dolli instance (same VPS as prod is OK — use env/URLs)."""
    if (os.environ.get("DOLLI_STAGING") or "").lower() in ("1", "true", "yes"):
        return True
    for key in ("DEPLOY_CHANNEL", "DOLLI_CORS_CHANNEL"):
        v = (os.environ.get(key) or "").lower()
        if "stag" in v:
            return True
    for key in ("ENVIRONMENT", "APP_ENV"):
        v = (os.environ.get(key) or "").lower()
        if "stag" in v:
            return True
    bundle = " ".join(
        (os.environ.get(k) or "").lower()
        for k in ("FRONTEND_URL", "VITE_FRONTEND_URL", "PYTHON_BACKEND_URL", "BACKEND_PUBLIC_URL")
    )
    if "staging.dolli" in bundle or "api-staging.dolli" in bundle:
        return True
    # VPS layout: staging SQLite path (when URL envs are minimal).
    db = (os.environ.get("DATABASE_URL") or "").lower()
    if "staging.db" in db or "/dolli/staging" in db:
        return True
    return False


def is_password_reset_feature_enabled() -> bool:
    """Prod: requires ALLOW_PASSWORD_RESET + SMTP. Staging: SMTP alone is enough unless DISABLE_PASSWORD_RESET_ON_STAGING=1."""
    if not smtp_delivery_configured():
        return False
    if os.environ.get("ALLOW_PASSWORD_RESET", "").lower() in ("1", "true", "yes"):
        return True
    if _infer_staging_like_deploy() and os.environ.get("DISABLE_PASSWORD_RESET_ON_STAGING", "").lower() not in (
        "1",
        "true",
        "yes",
    ):
        return True
    return False


def _password_reset_disabled_response() -> HTTPException:
    """503 with a hint when staging has no SMTP (prod usually needs ALLOW_PASSWORD_RESET + SMTP)."""
    if _infer_staging_like_deploy() and not smtp_delivery_configured():
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Password reset needs outbound email: add SMTP_HOST (and related SMTP_* variables) to "
                "/etc/dolli/staging.env, then restart dolli-backend-staging. On the same VPS you can copy the "
                "SMTP_* block from /etc/dolli/prod.env."
            ),
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Password reset is not available (set ALLOW_PASSWORD_RESET=1 and configure SMTP).",
    )


def legacy_fixed_password_enabled() -> bool:
    allow = os.environ.get("ALLOW_PASSWORD_AUTH", "").lower() in ("1", "true", "yes")
    if not allow:
        return False
    return bool(
        os.environ.get("LOCAL_LOGIN_EMAIL", "").strip() and os.environ.get("LOCAL_LOGIN_PASSWORD", "")
    )


def password_form_enabled() -> bool:
    return is_email_password_auth_enabled() or legacy_fixed_password_enabled()


def _redirect_with_app_token(
    frontend_base: str, app_token: str, expires_at, *, extra: Optional[dict] = None
) -> RedirectResponse:
    q = {
        "token": app_token,
        "expires_at": int(expires_at.timestamp()),
        "token_type": "Bearer",
    }
    if extra:
        q.update(extra)
    fragment = urlencode(q)
    return RedirectResponse(
        url=f"{frontend_base}/auth/callback?{fragment}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/login-options", response_model=LoginOptionsResponse)
async def login_options():
    """Public: which OAuth / password methods are enabled (no secrets)."""
    allow_local = os.environ.get("ALLOW_LOCAL_AUTH", "").lower() in ("1", "true", "yes")
    return LoginOptionsResponse(
        google_oidc=is_oidc_configured(),
        tiktok=tiktok_configured(),
        meta_facebook=meta_configured(),
        password=password_form_enabled(),
        email_signup=is_email_password_auth_enabled(),
        magic_link=is_magic_link_feature_enabled(),
        password_reset=is_password_reset_feature_enabled(),
        local_demo_redirect=allow_local and not is_oidc_configured(),
    )


def get_frontend_redirect_base(request: Request) -> str:
    """Resolve frontend base URL for post-auth redirects.

    Prefer explicit FRONTEND_URL from environment to avoid redirecting back to the API host.
    """
    frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url:
        return _local_patch(frontend_url)

    # Fallback for misconfigured envs
    return get_dynamic_backend_url(request)


@router.get("/login")
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    """Start OIDC login flow with PKCE."""
    frontend_base = get_frontend_redirect_base(request)

    # Temporary fallback for MVP/demo: allow local token login if OIDC is not configured.
    # Controlled by ALLOW_LOCAL_AUTH=1 to avoid accidental exposure.
    if not is_oidc_configured():
        allow_local_auth = os.environ.get("ALLOW_LOCAL_AUTH", "").lower() in ("1", "true", "yes")
        if not allow_local_auth:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OIDC auth is not configured on server. Set OIDC_* env vars or enable ALLOW_LOCAL_AUTH=1.",
            )

        auth_service = AuthService(db)
        local_user_id = os.environ.get("LOCAL_AUTH_USER_ID", "demo-user")
        local_user_email = os.environ.get("LOCAL_AUTH_USER_EMAIL", "demo@dolli.space")
        local_user_name = os.environ.get("LOCAL_AUTH_USER_NAME", "Demo User")
        local_user_role = os.environ.get("LOCAL_AUTH_USER_ROLE", "admin")

        user = await auth_service.get_or_create_user(
            platform_sub=local_user_id,
            email=local_user_email,
            name=local_user_name,
        )
        user.role = local_user_role
        await db.commit()

        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
        fragment = urlencode(
            {
                "token": app_token,
                "expires_at": int(expires_at.timestamp()),
                "token_type": "Bearer",
            }
        )
        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?{fragment}",
            status_code=status.HTTP_302_FOUND,
        )

    state = generate_state()
    nonce = generate_nonce()
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)

    # Store state, nonce, and code verifier in database
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, code_verifier)

    # Build redirect_uri dynamically from request
    backend_url = get_dynamic_backend_url(request)
    redirect_uri = f"{backend_url}/api/v1/auth/callback"
    logger.info("[login] Starting OIDC flow with redirect_uri=%s", redirect_uri)

    auth_url = build_authorization_url(state, nonce, code_challenge, redirect_uri=redirect_uri)
    return RedirectResponse(
        url=auth_url,
        status_code=status.HTTP_302_FOUND,
        headers={"X-Request-ID": state},
    )


@router.get("/callback")
async def callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle OIDC callback."""
    backend_url = get_dynamic_backend_url(request)
    frontend_base = get_frontend_redirect_base(request)

    def redirect_with_error(message: str) -> RedirectResponse:
        fragment = urlencode({"msg": message})
        return RedirectResponse(
            url=f"{frontend_base}/auth/error?{fragment}",
            status_code=status.HTTP_302_FOUND,
        )

    if error:
        return redirect_with_error(f"OIDC error: {error}")

    if not code or not state:
        return redirect_with_error("Missing code or state parameter")

    # Validate state using database
    auth_service = AuthService(db)
    temp_data = await auth_service.get_and_delete_oidc_state(state)
    if not temp_data:
        return redirect_with_error("Invalid or expired state parameter")

    nonce = temp_data["nonce"]
    code_verifier = temp_data.get("code_verifier")

    try:
        # Build redirect_uri dynamically from request
        redirect_uri = f"{backend_url}/api/v1/auth/callback"
        logger.info("[callback] Exchanging code for tokens with redirect_uri=%s", redirect_uri)

        # Exchange authorization code for tokens with PKCE
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
        }

        # Add PKCE code verifier if available
        if code_verifier:
            token_data["code_verifier"] = code_verifier

        token_url = oidc_token_endpoint()
        try:
            async with httpx.AsyncClient() as client:
                token_response = await client.post(
                    token_url,
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded", "X-Request-ID": state},
                )
        except httpx.HTTPError as e:
            logger.error(
                "[callback] Token exchange HTTP error: url=%s, error=%s",
                token_url,
                str(e),
                exc_info=True,
            )
            return redirect_with_error(f"Token exchange failed: {e}")

        if token_response.status_code != 200:
            logger.error(
                "[callback] Token exchange failed: url=%s, status_code=%s, response=%s",
                token_url,
                token_response.status_code,
                token_response.text,
            )
            return redirect_with_error(f"Token exchange failed: {token_response.text}")

        tokens = token_response.json()

        # Validate ID token
        id_token = tokens.get("id_token")
        if not id_token:
            return redirect_with_error("No ID token received")

        id_claims = await validate_id_token(id_token, access_token=tokens.get("access_token"))

        # Validate nonce
        if id_claims.get("nonce") != nonce:
            return redirect_with_error("Invalid nonce")

        # Get or create user
        email = id_claims.get("email", "")
        name = id_claims.get("name") or derive_name_from_email(email)
        user = await auth_service.get_or_create_user(platform_sub=id_claims["sub"], email=email, name=name)

        # Same human as LOCAL_LOGIN_* can still be a different DB row (Google `sub` vs owner-user id).
        # Optional: grant admin to specific emails on OIDC login (comma-separated, case-insensitive).
        admin_csv = os.environ.get("OIDC_ADMIN_EMAILS", "").strip()
        if admin_csv:
            allowed = {e.strip().lower() for e in admin_csv.split(",") if e.strip()}
            if (email or "").strip().lower() in allowed and user.role != "admin":
                user.role = "admin"
                await auth_service.db.commit()
                await auth_service.db.refresh(user)

        # Issue application JWT token encapsulating user information
        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)

        logger.info("[callback] OIDC callback successful, redirecting to frontend auth/callback")
        return _redirect_with_app_token(
            frontend_base, app_token, expires_at, extra={"oidc_session": "1"}
        )

    except IDTokenValidationError as e:
        # Redirect to error page with validation details
        return redirect_with_error(f"Authentication failed: {e.message}")
    except HTTPException as e:
        # Redirect to error page with the original detail message
        return redirect_with_error(str(e.detail))
    except Exception as e:
        logger.exception(f"Unexpected error in OIDC callback: {e}")
        return redirect_with_error(
            "Authentication processing failed. Please try again or contact support if the issue persists."
        )


@router.post("/token/exchange", response_model=TokenExchangeResponse)
async def exchange_platform_token(
    payload: PlatformTokenExchangeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange Platform token for app token, restricted to admin user."""
    logger.info("[token/exchange] Received platform token exchange request")

    verify_url = f"{settings.oidc_issuer_url}/platform/tokens/verify"
    logger.debug(f"[token/exchange] Verifying token with issuer: {verify_url}")

    try:
        async with httpx.AsyncClient() as client:
            verify_response = await client.post(
                verify_url,
                json={"platform_token": payload.platform_token},
                headers={"Content-Type": "application/json"},
            )
        logger.debug(f"[token/exchange] Issuer response status: {verify_response.status_code}")
    except httpx.HTTPError as exc:
        logger.error(f"[token/exchange] HTTP error verifying platform token: {exc}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to verify platform token") from exc

    try:
        verify_body = verify_response.json()
        logger.debug(f"[token/exchange] Issuer response body: {verify_body}")
    except ValueError:
        logger.error(f"[token/exchange] Failed to parse issuer response as JSON: {verify_response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from platform token verification service",
        )

    if not isinstance(verify_body, dict):
        logger.error(f"[token/exchange] Unexpected response type: {type(verify_body)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unexpected response from platform token verification service",
        )

    if verify_response.status_code != status.HTTP_200_OK or not verify_body.get("success"):
        message = verify_body.get("message", "") if isinstance(verify_body, dict) else ""
        logger.warning(
            f"[token/exchange] Token verification failed: status={verify_response.status_code}, message={message}"
        )
        raise HTTPException(
            status_code=verify_response.status_code,
            detail=message or "Platform token verification failed",
        )

    payload_data = verify_body.get("data") or {}
    raw_user_id = payload_data.get("user_id")
    logger.info(f"[token/exchange] Token verified, platform_user_id={raw_user_id}, email={payload_data.get('email')}")

    if not raw_user_id:
        logger.error("[token/exchange] Platform token payload missing user_id")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform token payload missing user_id")

    platform_user_id = str(raw_user_id)
    if platform_user_id != str(settings.admin_user_id):
        logger.warning(
            f"[token/exchange] Denied: platform_user_id={platform_user_id}, admin_user_id={settings.admin_user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admin user can exchange a platform token"
        )

    logger.info("[token/exchange] Admin user verified, issuing admin token without DB persistence")
    auth_service = AuthService(db)

    admin_email = payload_data.get("email", "") or getattr(settings, "admin_user_email", "")
    admin_name = payload_data.get("name") or payload_data.get("username")
    if not admin_name:
        admin_name = derive_name_from_email(admin_email)

    user = User(id=platform_user_id, email=admin_email, name=admin_name, role="admin")
    logger.debug(
        f"[token/exchange] Admin user object for token issuance: id={user.id}, email={user.email}, role={user.role}"
    )

    app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
    logger.info(f"[token/exchange] Token issued successfully for user_id={user.id}, expires_at={expires_at}")

    return TokenExchangeResponse(
        token=app_token,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/early-donor-milestone", response_model=EarlyDonorMilestoneResponse)
async def get_early_donor_milestone(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """First-wave donor rank (100 / 1k / 10k) for profile milestones; cheap to poll from the profile page."""
    svc = DonationsService(db)
    snap = await svc.early_donor_milestone_snapshot(current_user.id)
    return EarlyDonorMilestoneResponse(**snap)


@router.get("/notifications", response_model=UserNotificationListResponse)
async def list_my_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserNotificationsService(db)
    pack = await svc.list_for_user(current_user.id, skip=skip, limit=limit)
    items = [UserNotificationResponse.model_validate(x) for x in pack["items"]]
    return UserNotificationListResponse(
        items=items,
        total=pack["total"],
        skip=pack["skip"],
        limit=pack["limit"],
    )


@router.get("/notifications/unread-count", response_model=UnreadNotificationsResponse)
async def notifications_unread_count(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserNotificationsService(db)
    n = await svc.unread_count(current_user.id)
    return UnreadNotificationsResponse(count=n)


@router.post("/notifications/mark-read", status_code=status.HTTP_204_NO_CONTENT)
async def notifications_mark_read(
    body: MarkNotificationsReadRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserNotificationsService(db)
    if body.ids:
        await svc.mark_read(current_user.id, body.ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notifications/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
async def notifications_mark_all_read(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = UserNotificationsService(db)
    await svc.mark_all_read(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/admin/users/{user_id}/organization", response_model=UserResponse)
async def admin_set_user_organization(
    user_id: str,
    body: AdminSetUserOrganizationRequest,
    _: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: grant or revoke verified-organization status (NPO/NGO-style accounts)."""
    result = await db.execute(select(User).where(User.id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.organization_verified:
        row.organization_verified = True
        row.account_type = "verified_organization"
        name = (body.organization_display_name or "").strip()
        row.organization_display_name = name or None
        row.platform_fee_bps = body.platform_fee_bps
    else:
        row.organization_verified = False
        row.account_type = "individual"
        row.organization_display_name = None
        row.platform_fee_bps = None

    await db.commit()
    await db.refresh(row)
    base = user_row_to_response(row)
    return await _with_curated_badge(base, db)


@router.get("/logout")
async def logout():
    """Logout user."""
    logout_url = build_logout_url()
    return {"redirect_url": logout_url}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    if not is_password_reset_feature_enabled():
        raise _password_reset_disabled_response()
    em = payload.email.strip().lower()
    now = time.monotonic()
    last = _pwd_reset_last_sent.get(em, 0.0)
    if now - last < _PASSWORD_RESET_COOLDOWN_SEC:
        return ForgotPasswordResponse()
    _pwd_reset_last_sent[em] = now

    auth_service = AuthService(db)
    user = await auth_service.get_user_by_email_lower(em)
    if not user:
        return ForgotPasswordResponse()

    raw = await auth_service.create_password_reset_token_raw(user.id)
    if not raw:
        return ForgotPasswordResponse()

    fe = get_frontend_redirect_base(request).rstrip("/")
    reset_url = f"{fe}/auth/reset-password?token={quote(raw, safe='')}"
    try:
        await send_password_reset_email(user.email, reset_url)
    except Exception as exc:
        logger.exception("forgot_password: email send failed for user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send reset email. Check SMTP configuration or try again later.",
        ) from exc
    return ForgotPasswordResponse()


@router.post("/reset-password", response_model=TokenExchangeResponse)
async def reset_password_with_email_token(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if not is_password_reset_feature_enabled():
        raise _password_reset_disabled_response()
    auth_service = AuthService(db)
    try:
        user = await auth_service.reset_password_with_token(payload.token, payload.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    app_token, _, _ = await auth_service.issue_app_token(user=user)
    return TokenExchangeResponse(token=app_token)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password_logged_in(
    body: ChangePasswordRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    try:
        await auth_service.change_password(current_user.id, body.current_password, body.new_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/social/link/tiktok/start", response_model=SocialAuthorizeUrlResponse)
async def tiktok_social_link_start(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if not tiktok_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TikTok login is not configured (set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET).",
        )
    backend_url = get_dynamic_backend_url(request)
    state = generate_state()
    nonce = generate_nonce()
    verifier = generate_code_verifier()
    challenge = hashlib.sha256(verifier.encode("utf-8")).hexdigest()
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, verifier, link_user_id=current_user.id)
    redirect_uri = f"{backend_url}/api/v1/auth/social/tiktok/callback"
    url = build_tiktok_authorize_url(redirect_uri=redirect_uri, state=state, code_challenge=challenge)
    return SocialAuthorizeUrlResponse(url=url)


@router.post("/social/link/meta/start", response_model=SocialAuthorizeUrlResponse)
async def meta_social_link_start(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if not meta_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Meta login is not configured (set META_APP_ID and META_APP_SECRET).",
        )
    backend_url = get_dynamic_backend_url(request)
    state = generate_state()
    nonce = generate_nonce()
    verifier = generate_code_verifier()
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, verifier, link_user_id=current_user.id)
    redirect_uri = f"{backend_url}/api/v1/auth/social/meta/callback"
    url = build_meta_authorize_url(redirect_uri=redirect_uri, state=state)
    return SocialAuthorizeUrlResponse(url=url)


@router.post("/social/unlink/tiktok", status_code=status.HTTP_204_NO_CONTENT)
async def tiktok_social_unlink(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    try:
        await auth_service.unlink_tiktok_from_user(current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/social/unlink/meta", status_code=status.HTTP_204_NO_CONTENT)
async def meta_social_unlink(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    try:
        await auth_service.unlink_meta_from_user(current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/social/tiktok/login")
async def tiktok_oauth_start(request: Request, db: AsyncSession = Depends(get_db)):
    if not tiktok_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TikTok login is not configured (set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET).",
        )
    backend_url = get_dynamic_backend_url(request)
    state = generate_state()
    nonce = generate_nonce()
    verifier = generate_code_verifier()
    # TikTok expects SHA-256(code_verifier) as hex, not base64url (RFC 7636 S256).
    challenge = hashlib.sha256(verifier.encode("utf-8")).hexdigest()
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, verifier)
    redirect_uri = f"{backend_url}/api/v1/auth/social/tiktok/callback"
    url = build_tiktok_authorize_url(redirect_uri=redirect_uri, state=state, code_challenge=challenge)
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND)


@router.get("/social/tiktok/callback")
async def tiktok_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    backend_url = get_dynamic_backend_url(request)
    frontend_base = get_frontend_redirect_base(request)

    def redirect_with_error(message: str) -> RedirectResponse:
        return RedirectResponse(
            url=f"{frontend_base}/auth/error?{urlencode({'msg': message})}",
            status_code=status.HTTP_302_FOUND,
        )

    if error:
        return redirect_with_error(f"TikTok error: {error}")
    if not code or not state:
        return redirect_with_error("Missing code or state")

    auth_service = AuthService(db)
    temp = await auth_service.get_and_delete_oidc_state(state)
    if not temp:
        return redirect_with_error("Invalid or expired state")

    verifier = temp.get("code_verifier") or ""
    link_user_id = temp.get("link_user_id")
    redirect_uri = f"{backend_url}/api/v1/auth/social/tiktok/callback"
    try:
        sub, email, name = await tiktok_exchange_and_profile(
            code=code, redirect_uri=redirect_uri, code_verifier=verifier
        )
        if link_user_id:
            result = await db.execute(select(User).where(User.id == str(link_user_id)))
            target = result.scalar_one_or_none()
            if not target:
                return redirect_with_error("Your session expired. Sign in again and retry linking TikTok.")
            try:
                await auth_service.attach_tiktok_to_user(target, sub, name)
            except ValueError as ve:
                return redirect_with_error(str(ve))
            app_token, expires_at, _ = await auth_service.issue_app_token(user=target)
            return _redirect_with_app_token(frontend_base, app_token, expires_at, extra={"linked": "1"})
        user = await auth_service.get_or_create_user(platform_sub=sub, email=email, name=name)
        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
        return _redirect_with_app_token(frontend_base, app_token, expires_at)
    except Exception as e:
        logger.exception("TikTok OAuth callback failed: %s", e)
        return redirect_with_error("TikTok sign-in failed. Try again or use another method.")


@router.get("/social/meta/login")
async def meta_oauth_start(request: Request, db: AsyncSession = Depends(get_db)):
    """Facebook Login — use the same Meta developer app used for Instagram integrations."""
    if not meta_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Meta login is not configured (set META_APP_ID and META_APP_SECRET).",
        )
    backend_url = get_dynamic_backend_url(request)
    state = generate_state()
    nonce = generate_nonce()
    verifier = generate_code_verifier()
    auth_service = AuthService(db)
    await auth_service.store_oidc_state(state, nonce, verifier)
    redirect_uri = f"{backend_url}/api/v1/auth/social/meta/callback"
    url = build_meta_authorize_url(redirect_uri=redirect_uri, state=state)
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND)


@router.get("/social/meta/callback")
async def meta_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    backend_url = get_dynamic_backend_url(request)
    frontend_base = get_frontend_redirect_base(request)

    def redirect_with_error(message: str) -> RedirectResponse:
        return RedirectResponse(
            url=f"{frontend_base}/auth/error?{urlencode({'msg': message})}",
            status_code=status.HTTP_302_FOUND,
        )

    if error:
        msg = error_description or error
        return redirect_with_error(f"Meta / Facebook error: {msg}")
    if not code or not state:
        return redirect_with_error("Missing code or state")

    auth_service = AuthService(db)
    temp = await auth_service.get_and_delete_oidc_state(state)
    if not temp:
        return redirect_with_error("Invalid or expired state")

    redirect_uri = f"{backend_url}/api/v1/auth/social/meta/callback"
    link_user_id = temp.get("link_user_id")
    try:
        sub, email, name = await meta_exchange_and_profile(code=code, redirect_uri=redirect_uri)
        if link_user_id:
            result = await db.execute(select(User).where(User.id == str(link_user_id)))
            target = result.scalar_one_or_none()
            if not target:
                return redirect_with_error("Your session expired. Sign in again and retry linking Facebook.")
            try:
                await auth_service.attach_meta_to_user(target, sub, name)
            except ValueError as ve:
                return redirect_with_error(str(ve))
            app_token, expires_at, _ = await auth_service.issue_app_token(user=target)
            return _redirect_with_app_token(frontend_base, app_token, expires_at, extra={"linked": "1"})
        user = await auth_service.get_or_create_user(platform_sub=sub, email=email, name=name)
        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
        return _redirect_with_app_token(frontend_base, app_token, expires_at)
    except Exception as e:
        logger.exception("Meta OAuth callback failed: %s", e)
        return redirect_with_error("Facebook sign-in failed. Try again or use another method.")


class LocalLoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkConsumeRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=500)


@router.post("/register", response_model=TokenExchangeResponse)
async def register_email_password(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not is_email_password_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email registration is disabled on this server",
        )
    auth_service = AuthService(db)
    try:
        user = await auth_service.register_with_password(payload.email, payload.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    app_token, _, _ = await auth_service.issue_app_token(user=user)
    return TokenExchangeResponse(token=app_token)


@router.post("/magic-link/request")
async def magic_link_request(
    payload: MagicLinkRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a one-time sign-in link if SMTP is configured and the account exists."""
    if not is_magic_link_feature_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Magic link sign-in is not available",
        )
    em = payload.email.strip().lower()
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_email_lower(em)

    now = time.monotonic()
    last = _magic_link_last_sent.get(em, 0.0)
    if now - last < _MAGIC_LINK_COOLDOWN_SEC:
        return {"sent": True}

    if not user:
        _magic_link_last_sent[em] = now
        return {"sent": True}

    await db.execute(delete(MagicLoginToken).where(MagicLoginToken.user_id == user.id))
    await db.commit()

    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(MagicLoginToken(token_hash=token_hash, user_id=user.id, expires_at=expires_at))
    await db.commit()

    _magic_link_last_sent[em] = now

    frontend_base = get_frontend_redirect_base(request).rstrip("/")
    sign_in_url = f"{frontend_base}/auth/magic-login?token={quote(raw, safe='')}"

    await send_magic_login_email(user.email, sign_in_url)
    return {"sent": True}


@router.post("/magic-link/consume", response_model=TokenExchangeResponse)
async def magic_link_consume(payload: MagicLinkConsumeRequest, db: AsyncSession = Depends(get_db)):
    if not is_magic_link_feature_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Magic link sign-in is not available",
        )
    token_hash = hashlib.sha256(payload.token.strip().encode("utf-8")).hexdigest()
    result = await db.execute(select(MagicLoginToken).where(MagicLoginToken.token_hash == token_hash))
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not row or as_utc_aware(row.expires_at) < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired link")

    user_result = await db.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    await db.delete(row)
    await db.commit()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired link")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    auth_service = AuthService(db)
    app_token, _, _ = await auth_service.issue_app_token(user=user)
    return TokenExchangeResponse(token=app_token)


@router.post("/local-login", response_model=TokenExchangeResponse)
async def local_login(
    payload: LocalLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)

    if is_email_password_auth_enabled():
        user = await auth_service.verify_email_password(payload.email, payload.password)
        if user:
            app_token, _, _ = await auth_service.issue_app_token(user=user)
            return TokenExchangeResponse(token=app_token)

        em = payload.email.strip().lower()
        maybe = await auth_service.get_user_by_email_lower(em)
        if maybe and not getattr(maybe, "password_hash", None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This email is registered with Google sign-in. Use Continue with Google, "
                    "or set a Dolli password first via Forgot password on the sign-in page."
                ),
            )

    if not legacy_fixed_password_enabled():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    expected_email = os.environ.get("LOCAL_LOGIN_EMAIL", "").strip().lower()
    expected_password = os.environ.get("LOCAL_LOGIN_PASSWORD", "")

    if not expected_email or not expected_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password auth is not configured on server",
        )

    if payload.email.strip().lower() != expected_email or payload.password != expected_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user = await auth_service.get_or_create_user(
        platform_sub=os.environ.get("LOCAL_LOGIN_USER_ID", "owner-user"),
        email=expected_email,
        name=os.environ.get("LOCAL_LOGIN_USER_NAME", "Owner"),
    )
    user.role = os.environ.get("LOCAL_LOGIN_USER_ROLE", "admin")
    await db.commit()
    await db.refresh(user)

    app_token, _, _ = await auth_service.issue_app_token(user=user)
    return TokenExchangeResponse(token=app_token)

