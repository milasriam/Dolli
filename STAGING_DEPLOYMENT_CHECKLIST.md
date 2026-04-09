# DolliApp Staging Deployment Checklist

This checklist is the recommended order for preparing DolliApp on a staging domain before public launch.

## 1. Choose staging domains

Recommended layout:

- Frontend: `https://staging.yourdomain.kz`
- Backend API: `https://api-staging.yourdomain.kz`

If you prefer a single domain with a reverse proxy, keep the public frontend on:

- Frontend: `https://staging.yourdomain.kz`
- Backend API behind `/api`

The current project is easiest to reason about with two subdomains.

## 2. Prepare backend environment variables

Set these on the staging backend host:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET_KEY=replace-with-long-random-secret
FRONTEND_URL=https://staging.yourdomain.kz
BACKEND_PUBLIC_URL=https://api-staging.yourdomain.kz
PYTHON_BACKEND_URL=https://api-staging.yourdomain.kz

OIDC_ISSUER_URL=https://YOUR_OIDC_PROVIDER
OIDC_CLIENT_ID=your-staging-client-id
OIDC_CLIENT_SECRET=your-staging-client-secret
OIDC_SCOPE=openid profile email

ADMIN_USER_EMAIL=your-admin-email@example.com
ADMIN_USER_ID=your-admin-platform-user-id

HALYK_EPAY_CLIENT_ID=your-halyk-client-id
HALYK_EPAY_CLIENT_SECRET=your-halyk-client-secret
HALYK_EPAY_TERMINAL_ID=your-halyk-terminal-id
HALYK_EPAY_CURRENCY=KZT
HALYK_EPAY_OAUTH_URL=https://test-epay.homebank.kz/oauth2/token
HALYK_EPAY_SCRIPT_URL=https://test-epay.homebank.kz/payform/payment-api.js
HALYK_EPAY_STATUS_TOKEN_URL=https://test-epay.homebank.kz/oauth2/token
HALYK_EPAY_STATUS_URL=https://test-epay.homebank.kz/operation-api/api/transactions/status

KASPI_PAY_REMOTE_LINK=https://your-kaspi-payment-link

ALLOWED_DOMAINS=staging.yourdomain.kz,api-staging.yourdomain.kz
ALLOWED_ORIGINS=https://staging.yourdomain.kz
```

Notes:

- Use Halyk test endpoints in staging first.
- Do not use SQLite in staging. Move to Postgres before domain testing.
- `FRONTEND_URL` and `BACKEND_PUBLIC_URL` are required for payment and auth redirects.

## 3. Prepare frontend environment variables

Set these on the frontend host/build environment:

```env
VITE_API_BASE_URL=https://api-staging.yourdomain.kz
VITE_FRONTEND_URL=https://staging.yourdomain.kz
```

## 4. Configure OIDC redirect URLs

Register these exact URLs in your identity provider:

- Login callback: `https://api-staging.yourdomain.kz/api/v1/auth/callback`
- Frontend auth landing page: `https://staging.yourdomain.kz/auth/callback`
- Frontend auth error page: `https://staging.yourdomain.kz/auth/error`
- Logout callback: `https://staging.yourdomain.kz/logout-callback`

If your provider requires allowed origins, add:

- `https://staging.yourdomain.kz`
- `https://api-staging.yourdomain.kz`

## 5. Configure Halyk EPAY staging callbacks

Make sure Halyk EPAY staging is configured to return users to:

- Success redirect: `https://staging.yourdomain.kz/donation-success?provider=halyk_epay`
- Failure redirect: `https://staging.yourdomain.kz/donation-success?provider=halyk_epay&status=failed`
- Server callback: `https://api-staging.yourdomain.kz/api/v1/payment/providers/halyk/callback`

Important:

- The backend currently builds the final success and failure URLs dynamically.
- Halyk merchant settings still must allow your staging frontend/backend domains.

## 6. Configure Kaspi Pay staging flow

For the current implementation, Kaspi uses a remote payment link:

- `KASPI_PAY_REMOTE_LINK` must point to the merchant-provided Kaspi payment page or remote payment flow.

Current behavior:

- User is redirected to Kaspi.
- Donation remains `pending` until manual or later automated confirmation.

Before public launch, decide whether:

- manual Kaspi confirmation is acceptable for MVP
- or you need a deeper Kaspi-side confirmation workflow

## 7. Tighten backend security before production

Backend CORS is now driven by `ALLOWED_ORIGINS`, `FRONTEND_URL`, and `ALLOWED_DOMAINS` in [main.py](/Users/amirsalim/Documents/DolliApp/app/backend/main.py:23).

Before production:

- set `ALLOWED_ORIGINS` to your real frontend domains
- review `ALLOWED_DOMAINS`
- review admin bootstrap settings
- replace all dev secrets

## 8. Run database migration before staging tests

Apply migrations on the staging database, especially the donation payment fields migration:

- [c3a8d8f4e1b2_add_local_payment_provider_fields.py](/Users/amirsalim/Documents/DolliApp/app/backend/alembic/versions/c3a8d8f4e1b2_add_local_payment_provider_fields.py)

Minimum required outcome:

- `donations.payment_provider`
- `donations.provider_invoice_id`
- `donations.provider_reference`

## 9. Deploy order

Use this order:

1. Provision database
2. Apply backend environment variables
3. Run backend migrations
4. Deploy backend
5. Verify `GET /health`
6. Apply frontend environment variables
7. Build and deploy frontend
8. Verify frontend can reach backend
9. Connect OIDC redirects
10. Connect Halyk staging merchant settings
11. Test Kaspi link

## 10. Mandatory staging smoke test

Run these tests on the staging domain:

1. Open landing page
2. Open campaign detail page
3. Start login flow
4. Complete login callback
5. Open profile page
6. Create a campaign
7. Open newly created campaign
8. Start Halyk payment
9. Return to `donation-success`
10. Confirm donation becomes `paid`
11. Confirm campaign `raised_amount` and `donor_count` increase
12. Start Kaspi payment
13. Confirm donation shows `pending`
14. Create and open referral link

## 11. Release gate before production

Do not move to production until all are true:

- OIDC login works on the domain
- campaign creation works without mocks
- profile loads real data
- Halyk payment verifies correctly
- Kaspi behavior is accepted by business rules
- staging database is not SQLite
- CORS is narrowed
- secrets are rotated for production

## 12. Recommended next implementation steps

After this checklist, the best next tasks are:

1. add environment example files for backend and frontend
2. tighten CORS and domain allowlists
3. run real staging auth tests against your OIDC provider
4. run real Halyk test payments
5. decide whether Kaspi stays manual for MVP or needs deeper integration
