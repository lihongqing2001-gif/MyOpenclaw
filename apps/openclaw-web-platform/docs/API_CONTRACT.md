# API Contract

## Auth

- `POST /auth/email/request`
- `POST /auth/email/verify`
- `POST /auth/admin/2fa/verify`

## Packages

- `GET /packages`
- `GET /packages/:id`
- `GET /packages/:id/versions/:version`
- `GET /downloads/:packageId`

## Submissions

- `POST /submissions`
- `GET /me/submissions`
- `GET /me/submissions/:id`

## Review

- `GET /review/queue`
- `POST /review/:submissionId/approve`
- `POST /review/:submissionId/request-changes`
- `POST /review/:submissionId/reject`

## Audit

- `GET /admin/audit-logs`
- `GET /admin/security-events`
