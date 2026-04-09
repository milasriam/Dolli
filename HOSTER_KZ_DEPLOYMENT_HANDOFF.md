# Hoster.kz Deployment Handoff For DolliApp

Use this checklist when configuring `dolli.space` in Hoster.kz and preparing staging.

## 1. Confirm nameservers at Namecheap

At Namecheap, verify that `dolli.space` uses:

- `ns1.hoster.kz`
- `ns2.hoster.kz`
- `ns3.hoster.kz`

If these are already active, do not change them.

## 2. What to ask or verify in Hoster.kz

Before touching DNS, verify these platform details:

1. frontend hosting target
   - exact IP address or CNAME target
2. backend hosting target
   - exact IP address or CNAME target
3. SSL support
   - whether certificates are issued automatically for subdomains
4. Python app hosting
   - whether FastAPI can run as a persistent app
5. database availability
   - whether managed Postgres exists
6. reverse proxy support
   - whether `Host`, `X-Forwarded-Proto`, and `X-Forwarded-Host` are passed through

## 3. DNS records to create first

Create these records in the DNS zone for `dolli.space`.

### Staging

- `staging.dolli.space`
- `api-staging.dolli.space`

### Production

- `api.dolli.space`

Do not point the root domain `dolli.space` yet unless staging is already validated.

## 4. Recommended rollout order

Use this exact order:

1. create `staging.dolli.space`
2. create `api-staging.dolli.space`
3. issue SSL for both
4. deploy backend to `api-staging.dolli.space`
5. deploy frontend to `staging.dolli.space`
6. run auth tests
7. run Halyk staging tests
8. run campaign creation tests
9. only then point production frontend `dolli.space`
10. then add `api.dolli.space`

## 5. Exact staging values to give the hosting team

### Frontend staging

```env
VITE_API_BASE_URL=https://api-staging.dolli.space
VITE_FRONTEND_URL=https://staging.dolli.space
```

### Backend staging

```env
FRONTEND_URL=https://staging.dolli.space
BACKEND_PUBLIC_URL=https://api-staging.dolli.space
PYTHON_BACKEND_URL=https://api-staging.dolli.space
ALLOWED_ORIGINS=https://staging.dolli.space
ALLOWED_DOMAINS=staging.dolli.space,api-staging.dolli.space
```

## 6. OIDC URLs to register

Give these exact URLs to whoever configures your identity provider.

### Staging

- Redirect URI:
  - `https://api-staging.dolli.space/api/v1/auth/callback`
- Frontend auth callback:
  - `https://staging.dolli.space/auth/callback`
- Frontend auth error:
  - `https://staging.dolli.space/auth/error`
- Logout callback:
  - `https://staging.dolli.space/logout-callback`

## 7. Halyk EPAY URLs to register

Give these exact URLs to whoever configures Halyk.

### Staging

- Success return:
  - `https://staging.dolli.space/donation-success`
- Failure return:
  - `https://staging.dolli.space/donation-success?status=failed`
- Server callback:
  - `https://api-staging.dolli.space/api/v1/payment/providers/halyk/callback`

## 8. Minimum infrastructure requirement

Do not go live on simple shared hosting if it cannot provide all of these:

1. persistent Python backend process
2. HTTPS on custom subdomains
3. Postgres or external database support
4. ability to set environment variables
5. reverse proxy/header forwarding

If Hoster.kz does not support these well enough, keep DNS there but host the app elsewhere.

## 9. Staging acceptance test

The staging handoff is only complete if all of these pass:

1. `https://api-staging.dolli.space/health` returns healthy
2. `https://staging.dolli.space` opens over HTTPS
3. frontend loads campaigns from API
4. login redirect works
5. callback returns user to frontend
6. profile opens without mock data
7. create campaign works
8. Halyk test payment starts
9. donation success page verifies the payment state

## 10. What I recommend you do next

Send Hoster.kz support or your hosting admin this exact short request:

`I need to host a React frontend on staging.dolli.space and a FastAPI backend on api-staging.dolli.space. Please tell me the exact DNS targets or IPs for both, whether SSL can be issued automatically for these subdomains, whether Python/FastAPI apps can run persistently, whether Postgres is available, and whether reverse proxy headers Host/X-Forwarded-Proto/X-Forwarded-Host are preserved.`
