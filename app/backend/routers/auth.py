import hashlib
import logging
import os
from typing import Optional
from urllib.parse import urlencode

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
from dependencies.auth import get_admin_user, get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from fastapi.responses import RedirectResponse
from models.auth import User
from schemas.auth import (
    AdminSetUserOrganizationRequest,
    LoginOptionsResponse,
    PlatformTokenExchangeRequest,
    TokenExchangeResponse,
    UserResponse,
)
from services.auth import AuthService
from services.social_login import (
    build_meta_authorize_url,
    build_tiktok_authorize_url,
    meta_configured,
    meta_exchange_and_profile,
    tiktok_configured,
    tiktok_exchange_and_profile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


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


def _redirect_with_app_token(frontend_base: str, app_token: str, expires_at) -> RedirectResponse:
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


@router.get("/login-options", response_model=LoginOptionsResponse)
async def login_options():
    """Public: which OAuth / password methods are enabled (no secrets)."""
    allow_pw = os.environ.get("ALLOW_PASSWORD_AUTH", "").lower() in ("1", "true", "yes")
    pw_ok = allow_pw and bool(
        os.environ.get("LOCAL_LOGIN_EMAIL", "").strip() and os.environ.get("LOCAL_LOGIN_PASSWORD", "")
    )
    allow_local = os.environ.get("ALLOW_LOCAL_AUTH", "").lower() in ("1", "true", "yes")
    return LoginOptionsResponse(
        google_oidc=is_oidc_configured(),
        tiktok=tiktok_configured(),
        meta_facebook=meta_configured(),
        password=pw_ok,
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
        return _redirect_with_app_token(frontend_base, app_token, expires_at)

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
    return UserResponse.model_validate(row)


@router.get("/logout")
async def logout():
    """Logout user."""
    logout_url = build_logout_url()
    return {"redirect_url": logout_url}


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
    redirect_uri = f"{backend_url}/api/v1/auth/social/tiktok/callback"
    try:
        sub, email, name = await tiktok_exchange_and_profile(
            code=code, redirect_uri=redirect_uri, code_verifier=verifier
        )
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
    try:
        sub, email, name = await meta_exchange_and_profile(code=code, redirect_uri=redirect_uri)
        user = await auth_service.get_or_create_user(platform_sub=sub, email=email, name=name)
        app_token, expires_at, _ = await auth_service.issue_app_token(user=user)
        return _redirect_with_app_token(frontend_base, app_token, expires_at)
    except Exception as e:
        logger.exception("Meta OAuth callback failed: %s", e)
        return redirect_with_error("Facebook sign-in failed. Try again or use another method.")


class LocalLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/local-login", response_model=TokenExchangeResponse)
async def local_login(
    payload: LocalLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    allow_password_auth = os.environ.get("ALLOW_PASSWORD_AUTH", "").lower() in ("1", "true", "yes")
    if not allow_password_auth:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password auth is disabled",
        )

    expected_email = os.environ.get("LOCAL_LOGIN_EMAIL", "").strip().lower()
    expected_password = os.environ.get("LOCAL_LOGIN_PASSWORD", "")

    if not expected_email or not expected_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password auth is not configured on server",
        )

    if payload.email.strip().lower() != expected_email or payload.password != expected_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    auth_service = AuthService(db)
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

