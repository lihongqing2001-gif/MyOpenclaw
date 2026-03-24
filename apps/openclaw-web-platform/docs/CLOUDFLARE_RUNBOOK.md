# Cloudflare / Edge Runbook

## Recommended Setup

- proxy the main domain through Cloudflare
- enable WAF managed rules
- enable bot fight mode or bot management if available
- cache public package pages and docs
- do not cache login or admin routes

## Page Rules / Cache Rules

- cache:
  - `/`
  - `/downloads`
  - `/community`
  - `/package/*`
- bypass cache:
  - `/login`
  - `/submit`
  - `/me`
  - `/review`
  - `/admin`
  - `/auth/*`
  - `/downloads/file`

## Rate Limit Recommendations

- `/auth/email/request`
  - low threshold
- `/auth/email/verify`
  - low threshold
- `/submissions`
  - medium threshold
- `/downloads/:packageId`
  - medium threshold
- `/downloads/file`
  - medium threshold
- `/review/*`
  - strict threshold

## Security Headers

- enforce HTTPS
- HSTS
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: same-origin`

## Admin Safety

- consider Cloudflare Access or IP allowlisting for `/admin` and `/review`
- always keep super-admin 2FA enabled
