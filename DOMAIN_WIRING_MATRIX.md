# DolliApp Domain Wiring Matrix

Use this file when you are ready to connect your real domain to staging and then production.

Replace `yourdomain.kz` with your actual domain.

## Recommended domain layout

### Staging

- Frontend: `staging.yourdomain.kz`
- Backend API: `api-staging.yourdomain.kz`

### Production

- Frontend: `dolli.yourdomain.kz` or `yourdomain.kz`
- Backend API: `api.yourdomain.kz`

If you want the cleanest first rollout, use:

- production frontend: `https://dolli.yourdomain.kz`
- production backend: `https://api.yourdomain.kz`

That keeps frontend and API separation simple.

## DNS records

Create these DNS records with your hosting provider.

### Staging DNS

- `staging.yourdomain.kz` -> frontend host
- `api-staging.yourdomain.kz` -> backend host

### Production DNS

- `dolli.yourdomain.kz` or root domain -> frontend host
- `api.yourdomain.kz` -> backend host

If your platform uses CNAME-style setup:

- `staging` -> CNAME to frontend platform hostname
- `api-staging` -> CNAME/A record to backend platform hostname
- `dolli` -> CNAME to frontend platform hostname
- `api` -> CNAME/A record to backend platform hostname

## Frontend environment mapping

### Staging frontend

```env
VITE_API_BASE_URL=https://api-staging.yourdomain.kz
VITE_FRONTEND_URL=https://staging.yourdomain.kz
```

### Production frontend

```env
VITE_API_BASE_URL=https://api.yourdomain.kz
VITE_FRONTEND_URL=https://dolli.yourdomain.kz
```

If you use the root domain instead of `dolli.yourdomain.kz`, change `VITE_FRONTEND_URL` accordingly.

## Backend environment mapping

### Staging backend

```env
FRONTEND_URL=https://staging.yourdomain.kz
BACKEND_PUBLIC_URL=https://api-staging.yourdomain.kz
PYTHON_BACKEND_URL=https://api-staging.yourdomain.kz
ALLOWED_ORIGINS=https://staging.yourdomain.kz
ALLOWED_DOMAINS=staging.yourdomain.kz,api-staging.yourdomain.kz
```

### Production backend

```env
FRONTEND_URL=https://dolli.yourdomain.kz
BACKEND_PUBLIC_URL=https://api.yourdomain.kz
PYTHON_BACKEND_URL=https://api.yourdomain.kz
ALLOWED_ORIGINS=https://dolli.yourdomain.kz
ALLOWED_DOMAINS=dolli.yourdomain.kz,api.yourdomain.kz
```

If production frontend uses the root domain, replace `https://dolli.yourdomain.kz` with `https://yourdomain.kz`.

## OIDC wiring

Register these exact URLs in your OIDC provider.

### Staging OIDC

- Redirect URI:
  - `https://api-staging.yourdomain.kz/api/v1/auth/callback`
- Frontend callback page:
  - `https://staging.yourdomain.kz/auth/callback`
- Frontend error page:
  - `https://staging.yourdomain.kz/auth/error`
- Post logout redirect:
  - `https://staging.yourdomain.kz/logout-callback`
- Allowed web origins:
  - `https://staging.yourdomain.kz`
  - `https://api-staging.yourdomain.kz`

### Production OIDC

- Redirect URI:
  - `https://api.yourdomain.kz/api/v1/auth/callback`
- Frontend callback page:
  - `https://dolli.yourdomain.kz/auth/callback`
- Frontend error page:
  - `https://dolli.yourdomain.kz/auth/error`
- Post logout redirect:
  - `https://dolli.yourdomain.kz/logout-callback`
- Allowed web origins:
  - `https://dolli.yourdomain.kz`
  - `https://api.yourdomain.kz`

If production uses the root domain, replace `https://dolli.yourdomain.kz` with `https://yourdomain.kz`.

## Halyk EPAY wiring

These URLs must be aligned between DolliApp env and your Halyk merchant settings.

### Staging Halyk

- Frontend success URL base:
  - `https://staging.yourdomain.kz/donation-success`
- Frontend failure URL base:
  - `https://staging.yourdomain.kz/donation-success?status=failed`
- Backend callback:
  - `https://api-staging.yourdomain.kz/api/v1/payment/providers/halyk/callback`

### Production Halyk

- Frontend success URL base:
  - `https://dolli.yourdomain.kz/donation-success`
- Frontend failure URL base:
  - `https://dolli.yourdomain.kz/donation-success?status=failed`
- Backend callback:
  - `https://api.yourdomain.kz/api/v1/payment/providers/halyk/callback`

Note:

- The backend appends provider and invoice parameters dynamically.
- Your merchant cabinet still needs to allow these production/staging domains.

## Kaspi Pay wiring

Current implementation expects:

- `KASPI_PAY_REMOTE_LINK` to be a merchant-provided Kaspi payment URL

For staging:

- use a test or private merchant payment link if available

For production:

- replace it with the real merchant payment link

## Reverse proxy expectations

If you deploy behind Nginx, Caddy, Traefik, or a hosting proxy:

- frontend host must serve the Vite build output
- backend host must forward these headers:
  - `Host`
  - `X-Forwarded-Proto`
  - `X-Forwarded-Host`

Those are important because auth and payment redirects are derived from incoming host data in the backend.

## TLS and certificates

Before testing auth or payments, confirm:

- frontend domain has valid HTTPS
- backend domain has valid HTTPS
- no certificate warnings appear in browser

OIDC and payment providers often fail or reject callbacks if HTTPS is not valid.

## Deployment order

### Staging order

1. Create DNS records
2. Provision HTTPS certificates
3. Deploy backend on `api-staging.yourdomain.kz`
4. Set staging backend env
5. Apply database migrations
6. Verify `https://api-staging.yourdomain.kz/health`
7. Deploy frontend on `staging.yourdomain.kz`
8. Set staging frontend env
9. Verify frontend can load campaigns from backend
10. Configure OIDC staging redirects
11. Configure Halyk staging callbacks
12. Verify Kaspi link

### Production order

1. Copy the validated staging settings pattern
2. Change only domains, secrets, and production keys
3. Re-run the full smoke test before public announcement

## Final fill-in table

Use this short table when you have the real domain.

| Purpose | Staging | Production |
| --- | --- | --- |
| Frontend URL | `https://staging.yourdomain.kz` | `https://dolli.yourdomain.kz` |
| Backend URL | `https://api-staging.yourdomain.kz` | `https://api.yourdomain.kz` |
| OIDC callback | `https://api-staging.yourdomain.kz/api/v1/auth/callback` | `https://api.yourdomain.kz/api/v1/auth/callback` |
| Frontend auth callback | `https://staging.yourdomain.kz/auth/callback` | `https://dolli.yourdomain.kz/auth/callback` |
| Halyk callback | `https://api-staging.yourdomain.kz/api/v1/payment/providers/halyk/callback` | `https://api.yourdomain.kz/api/v1/payment/providers/halyk/callback` |
| Donation success page | `https://staging.yourdomain.kz/donation-success` | `https://dolli.yourdomain.kz/donation-success` |
