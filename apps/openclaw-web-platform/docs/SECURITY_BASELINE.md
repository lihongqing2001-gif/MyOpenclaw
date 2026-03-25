# Security Baseline

## Authentication

- users: email magic link / verification code
- super admins: email login + policy-controlled 2FA (enabled by default)

## Session Controls

- secure HttpOnly cookies
- CSRF protection on state-changing actions
- server-side role enforcement
- re-auth for sensitive admin operations

## Edge Controls

- CDN + WAF
- rate limiting on auth, uploads, downloads, review APIs
- bot scoring / reputation checks where available

## Upload Controls

- package file size limit
- allowed mime/type list
- malware scanning
- object storage isolation

## Download Controls

- signed URLs
- short TTL
- download audit logs

## Audit Requirements

- login success/failure
- review decisions
- publish/unpublish
- role changes
- admin security changes
- package downloads
