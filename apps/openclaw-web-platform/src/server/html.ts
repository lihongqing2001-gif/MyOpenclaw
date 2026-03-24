import { PackageRecord, Session, SubmissionRecord, User } from "../contracts/types";

function shell(title: string, body: string, auth?: { user: User; session: Session } | null) {
  const authBlock = auth
    ? `<div class="authbar">
        <span>${auth.user.email}</span>
        <span class="role">${auth.user.role}</span>
        <a href="/me">My Submissions</a>
        <a href="/submit">Submit</a>
      </div>`
    : `<div class="authbar"><a href="/login">Login</a></div>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { margin: 0; background: #f4f7fb; color: #111827; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
      .page { max-width: 1040px; margin: 0 auto; padding: 48px 20px 72px; }
      .hero { background: white; border: 1px solid #dbe2ea; border-radius: 24px; padding: 28px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08); }
      .nav { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
      .nav a { color: #2563eb; text-decoration: none; font-weight: 600; }
      .authbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; color: #475467; font-size: 14px; }
      .authbar a { color: #2563eb; text-decoration: none; font-weight: 600; }
      .role { background: #eef2ff; color: #3730a3; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-top: 20px; }
      .card { background: white; border: 1px solid #dbe2ea; border-radius: 20px; padding: 18px; }
      .stack { display: grid; gap: 16px; margin-top: 18px; }
      .form { display: grid; gap: 14px; margin-top: 18px; }
      label { display: grid; gap: 6px; font-size: 14px; color: #475467; }
      input, textarea { font: inherit; padding: 10px 12px; border-radius: 12px; border: 1px solid #d0d5dd; background: #fff; }
      textarea { min-height: 140px; resize: vertical; }
      button { border: none; border-radius: 999px; background: #2563eb; color: white; padding: 10px 16px; font-weight: 700; cursor: pointer; }
      .button-secondary { display: inline-flex; align-items: center; justify-content: center; background: #eef2ff; color: #3730a3; text-decoration: none; }
      code { background: #eef2ff; padding: 2px 6px; border-radius: 6px; }
      .meta { color: #667085; font-size: 13px; }
      .pill { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #f2f4f7; color: #344054; font-size: 12px; font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="nav">
        <a href="/">Product</a>
        <a href="/downloads">Downloads</a>
        <a href="/community">Community</a>
        <a href="/admin">Admin</a>
      </div>
      ${authBlock}
      ${body}
    </div>
  </body>
</html>`;
}

export function renderHome(packageCount: number, submissionCount: number, auth?: { user: User; session: Session } | null) {
  return shell(
    "OpenClaw Web Platform",
    `<section class="hero">
      <h1>OpenClaw Web Platform</h1>
      <p>Official website, package registry, tutorials, and moderated community submissions for OpenClaw.</p>
      <div class="grid">
        <div class="card"><strong>${packageCount}</strong><br />Published packages</div>
        <div class="card"><strong>${submissionCount}</strong><br />Tracked submissions</div>
        <div class="card"><strong>Local-first</strong><br />Private local workspaces are not synced by default.</div>
      </div>
      <div class="stack">
        <a class="button-secondary" href="/downloads">Browse Downloads</a>
        <a class="button-secondary" href="/submit">Submit a Package</a>
      </div>
    </section>`,
    auth,
  );
}

export function renderPackageList(title: string, packages: PackageRecord[], auth?: { user: User; session: Session } | null) {
  return shell(
    title,
    `<section class="hero">
      <h1>${title}</h1>
      <div class="grid">
        ${packages
          .map(
            (item) => `<div class="card">
                <h3>${item.name}</h3>
                <p><code>${item.packageId}</code></p>
                <p>Type: ${item.type}</p>
                <p>Latest version: ${item.latestVersion}</p>
                <p>Review status: ${item.reviewStatus}</p>
                <p><a href="/package/${encodeURIComponent(item.packageId)}">Open details</a></p>
              </div>`,
          )
          .join("") || '<div class="card">No packages yet.</div>'}
      </div>
    </section>`,
    auth,
  );
}

export function renderPackageDetail(record: PackageRecord, auth?: { user: User; session: Session } | null) {
  const latest = record.versions.find((item) => item.version === record.latestVersion) ?? record.versions[0];
  const manifest = latest?.manifest;
  return shell(
    record.name,
    `<section class="hero">
      <h1>${record.name}</h1>
      <p><code>${record.packageId}</code></p>
      <div class="stack">
        <div class="card">
          <div class="pill">${record.type}</div>
          <p class="meta">Latest version: ${record.latestVersion}</p>
          <p>${manifest?.description ?? ""}</p>
          ${auth ? `<p><a class="button-secondary" href="/package/${encodeURIComponent(record.packageId)}/download">Request signed download</a></p>` : `<p><a class="button-secondary" href="/login">Login to download</a></p>`}
        </div>
        <div class="card">
          <h3>Capabilities</h3>
          ${(manifest?.capabilities ?? []).map((item) => `<p><strong>${item.label}</strong><br />${item.summary ?? ""}</p>`).join("")}
        </div>
        <div class="card">
          <h3>Permissions</h3>
          ${(manifest?.permissions ?? []).map((item) => `<p><code>${item.key}</code> — ${item.reason}</p>`).join("")}
        </div>
      </div>
    </section>`,
    auth,
  );
}

export function renderLoginPage(debugCode: string | null = null, auth?: { user: User; session: Session } | null) {
  return shell(
    "Login",
    `<section class="hero">
      <h1>Login</h1>
      <p>Use email login. Super-admin accounts require a second verification step.</p>
      ${debugCode ? `<p class="pill">Debug code: ${debugCode}</p>` : ""}
      <div class="stack">
        <a class="button secondary" href="/auth/github/start">Continue with GitHub</a>
      </div>
      <div class="grid">
        <form class="card form" method="post" action="/login/request">
          <h3>Request code</h3>
          <label>Email
            <input type="email" name="email" required />
          </label>
          <button type="submit">Send code</button>
        </form>
        <form class="card form" method="post" action="/login/verify">
          <h3>Verify code</h3>
          <label>Email
            <input type="email" name="email" required />
          </label>
          <label>Code
            <input type="text" name="code" required />
          </label>
          <button type="submit">Login</button>
        </form>
      </div>
    </section>`,
    auth,
  );
}

export function renderAdminTwoFactorPage(auth: { user: User; session: Session }, message = "") {
  return shell(
    "Admin Two-Factor Verification",
    `<section class="hero">
      <h1>Admin Two-Factor Verification</h1>
      <p>Super-admin accounts must complete a second verification step before accessing admin and review actions.</p>
      ${message ? `<p class="pill">${message}</p>` : ""}
      <form class="form" method="post" action="/admin/2fa">
        <input type="hidden" name="csrfToken" value="${auth.session.csrfToken}" />
        <label>Authenticator code
          <input type="text" name="code" required />
        </label>
        <button type="submit">Verify 2FA</button>
      </form>
    </section>`,
    auth,
  );
}

export function renderSubmitPage(auth: { user: User; session: Session }) {
  return shell(
    "Submit Package",
    `<section class="hero">
      <h1>Submit a Package</h1>
      <p>Upload a community package zip. All public submissions go through manual review.</p>
      <form class="form" method="post" action="/submit" enctype="multipart/form-data">
        <input type="hidden" name="csrfToken" value="${auth.session.csrfToken}" />
        <label>Package zip
          <input type="file" name="package" accept=".zip" required />
        </label>
        <button type="submit">Upload submission</button>
      </form>
    </section>`,
    auth,
  );
}

export function renderMySubmissionsPage(auth: { user: User; session: Session }, submissions: SubmissionRecord[]) {
  return shell(
    "My Submissions",
    `<section class="hero">
      <h1>My Submissions</h1>
      <div class="stack">
        ${submissions
          .map(
            (item) => `<div class="card">
              <h3>${item.packageId}</h3>
              <p class="meta">Submission ID: ${item.id}</p>
              <p class="pill">${item.status}</p>
              <p class="meta">Version: ${item.packageVersion}</p>
            </div>`,
          )
          .join("") || `<div class="card">No submissions yet.</div>`}
      </div>
    </section>`,
    auth,
  );
}

export function renderReviewQueuePage(auth: { user: User; session: Session }, submissions: SubmissionRecord[]) {
  return shell(
    "Review Queue",
    `<section class="hero">
      <h1>Review Queue</h1>
      <div class="stack">
        ${submissions
          .map(
            (item) => `<div class="card">
              <h3>${item.packageId}</h3>
              <p class="meta">Submission ID: ${item.id}</p>
              <p class="pill">${item.status}</p>
              <form class="form" method="post" action="/review/${item.id}/approve-form">
                <input type="hidden" name="csrfToken" value="${auth.session.csrfToken}" />
                <button type="submit">Approve & Publish</button>
              </form>
              <form class="form" method="post" action="/review/${item.id}/request-changes-form">
                <input type="hidden" name="csrfToken" value="${auth.session.csrfToken}" />
                <label>Note
                  <input type="text" name="note" />
                </label>
                <button type="submit">Request changes</button>
              </form>
              <form class="form" method="post" action="/review/${item.id}/reject-form">
                <input type="hidden" name="csrfToken" value="${auth.session.csrfToken}" />
                <label>Note
                  <input type="text" name="note" />
                </label>
                <button type="submit">Reject</button>
              </form>
            </div>`,
          )
          .join("") || `<div class="card">No submissions awaiting review.</div>`}
      </div>
    </section>`,
    auth,
  );
}

export function renderAdminPage(auth?: { user: User; session: Session } | null) {
  return shell(
    "Admin",
    `<section class="hero">
      <h1>Admin Console</h1>
      <p>This MVP exposes admin and review actions through authenticated APIs. Use the docs and API routes to manage moderation, security, and audit workflows.</p>
      <div class="stack">
        <a class="button-secondary" href="/review">Open review queue</a>
        <a class="button-secondary" href="/admin/audit-logs">Audit log API</a>
      </div>
    </section>`,
    auth,
  );
}
