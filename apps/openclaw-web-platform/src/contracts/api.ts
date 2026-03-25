export const apiContract = {
  auth: [
    "POST /auth/email/request",
    "POST /auth/email/verify",
    "POST /auth/admin/2fa/verify",
  ],
  packages: [
    "GET /packages",
    "GET /packages/:id",
    "GET /packages/:id/versions/:version",
    "GET /downloads/:packageId",
  ],
  submissions: [
    "POST /submissions",
    "GET /me/submissions",
    "GET /me/submissions/:id",
  ],
  review: [
    "GET /review/queue",
    "POST /review/:submissionId/approve",
    "POST /review/:submissionId/request-changes",
    "POST /review/:submissionId/reject",
  ],
  audit: [
    "GET /admin/audit-logs",
    "GET /admin/security-events",
  ],
  users: [
    "GET /admin/users",
    "POST /admin/users/:userId/role",
    "POST /admin/users/:userId/revoke-sessions",
  ],
} as const;
