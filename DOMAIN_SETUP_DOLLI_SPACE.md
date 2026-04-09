# DolliApp Domain Setup For dolli.space

This file is the concrete version of the domain plan for your current domain and hosting setup.

Current registrar:

- Namecheap

Current hosting DNS nameservers:

- `ns1.hoster.kz`
- `ns2.hoster.kz`
- `ns3.hoster.kz`

## 1. Registrar setup at Namecheap

In Namecheap, set the domain `dolli.space` to use these custom nameservers:

- `ns1.hoster.kz`
- `ns2.hoster.kz`
- `ns3.hoster.kz`

If these are already set, you do not need to change them again.

## 2. Recommended domain layout

### Staging

- Frontend: `staging.dolli.space`
- Backend API: `api-staging.dolli.space`

### Production

- Frontend: `dolli.space`
- Backend API: `api.dolli.space`

This is the best fit for the current app because:

- frontend stays on the main brand domain
- API stays isolated on a clean subdomain
- auth and payment callbacks are easier to configure

## 3. DNS records to create in Hoster.kz DNS

Create these records in the DNS zone for `dolli.space`.

### Staging

- `staging` -> points to frontend hosting target
- `api-staging` -> points to backend hosting target

### Production

- `@` -> points to frontend hosting target
- `api` -> points to backend hosting target

Important:

- If your hosting panel gives you an IP, use `A` records
- If your hosting panel gives you a hostname, use `CNAME`
- Do not create `CNAME` on the root `@` record unless your hosting provider explicitly supports it

## 4. Exact frontend environment values

### Staging frontend

```env
VITE_API_BASE_URL=https://api-staging.dolli.space
VITE_FRONTEND_URL=https://staging.dolli.space
```

### Production frontend

```env
VITE_API_BASE_URL=https://api.dolli.space
VITE_FRONTEND_URL=https://dolli.space
```

## 5. Exact backend environment values

### Staging backend

```env
FRONTEND_URL=https://staging.dolli.space
BACKEND_PUBLIC_URL=https://api-staging.dolli.space
PYTHON_BACKEND_URL=https://api-staging.dolli.space
ALLOWED_ORIGINS=https://staging.dolli.space
ALLOWED_DOMAINS=staging.dolli.space,api-staging.dolli.space
```

### Production backend

```env
FRONTEND_URL=https://dolli.space
BACKEND_PUBLIC_URL=https://api.dolli.space
PYTHON_BACKEND_URL=https://api.dolli.space
ALLOWED_ORIGINS=https://dolli.space
ALLOWED_DOMAINS=dolli.space,api.dolli.space
```

## 6. Exact OIDC settings

Register these URLs in your OIDC provider.

### Staging OIDC

- Redirect URI:
  - `https://api-staging.dolli.space/api/v1/auth/callback`
- Frontend callback page:
  - `https://staging.dolli.space/auth/callback`
- Frontend error page:
  - `https://staging.dolli.space/auth/error`
- Post logout redirect:
  - `https://staging.dolli.space/logout-callback`
- Allowed web origins:
  - `https://staging.dolli.space`
  - `https://api-staging.dolli.space`

### Production OIDC

- Redirect URI:
  - `https://api.dolli.space/api/v1/auth/callback`
- Frontend callback page:
  - `https://dolli.space/auth/callback`
- Frontend error page:
  - `https://dolli.space/auth/error`
- Post logout redirect:
  - `https://dolli.space/logout-callback`
- Allowed web origins:
  - `https://dolli.space`
  - `https://api.dolli.space`

## 7. Exact Halyk EPAY callback settings

These are the URLs to use in Halyk staging and production merchant settings.

### Staging Halyk

- Success return URL:
  - `https://staging.dolli.space/donation-success`
- Failure return URL:
  - `https://staging.dolli.space/donation-success?status=failed`
- Server callback:
  - `https://api-staging.dolli.space/api/v1/payment/providers/halyk/callback`

### Production Halyk

- Success return URL:
  - `https://dolli.space/donation-success`
- Failure return URL:
  - `https://dolli.space/donation-success?status=failed`
- Server callback:
  - `https://api.dolli.space/api/v1/payment/providers/halyk/callback`

## 8. Exact Kaspi Pay setting

For the current integration:

- `KASPI_PAY_REMOTE_LINK` should be your Kaspi merchant payment link

Recommended approach:

- use a test or limited-access payment link for staging
- replace with the real merchant payment link in production

## 9. Reverse proxy requirements

If Hoster.kz or your app server uses Nginx/Apache:

- frontend host must serve the frontend build
- backend host must forward:
  - `Host`
  - `X-Forwarded-Proto`
  - `X-Forwarded-Host`

Those headers matter because backend auth and payment redirects are domain-aware.

## 10. TLS checklist

Before testing auth or payments, make sure all of these are valid:

- `https://staging.dolli.space`
- `https://api-staging.dolli.space`
- `https://dolli.space`
- `https://api.dolli.space`

Do not test OIDC or Halyk against non-HTTPS domains.

## 11. What to ask your hosting provider for

You need these exact pieces of information from Hoster.kz or your deployment target:

1. frontend hosting target
   - IP or CNAME target
2. backend hosting target
   - IP or CNAME target
3. whether SSL certificates are auto-issued
4. whether reverse proxy headers are passed through
5. whether Python backend can run persistently
6. whether Postgres is available, or whether you need an external database

## 12. Immediate practical next actions

In order:

1. confirm `dolli.space` already points to the Hoster.kz nameservers
2. decide where frontend will run
3. decide where backend will run
4. create `staging`, `api-staging`, and `api` DNS records
5. issue SSL certificates
6. fill staging `.env` using the exact values above
7. deploy backend first
8. deploy frontend second
9. wire OIDC
10. wire Halyk

## 13. Final quick reference

| Purpose | Staging | Production |
| --- | --- | --- |
| Frontend URL | `https://staging.dolli.space` | `https://dolli.space` |
| Backend URL | `https://api-staging.dolli.space` | `https://api.dolli.space` |
| OIDC callback | `https://api-staging.dolli.space/api/v1/auth/callback` | `https://api.dolli.space/api/v1/auth/callback` |
| Frontend auth callback | `https://staging.dolli.space/auth/callback` | `https://dolli.space/auth/callback` |
| Halyk callback | `https://api-staging.dolli.space/api/v1/payment/providers/halyk/callback` | `https://api.dolli.space/api/v1/payment/providers/halyk/callback` |
| Donation success page | `https://staging.dolli.space/donation-success` | `https://dolli.space/donation-success` |
