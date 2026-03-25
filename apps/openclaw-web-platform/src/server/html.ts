import { PackageRecord, Session, SubmissionRecord, User } from "../contracts/types";

type AuthContext = { user: User; session: Session } | null | undefined;

interface ShellOptions {
  activePath?: "/" | "/downloads" | "/community" | "/login" | "/submit" | "/me" | "/review" | "/admin" | "/admin/2fa";
  centered?: boolean;
  hideFooter?: boolean;
}

const HUB_BRAND = "Forge Hub";
const CONSOLE_BRAND = "Forge Console";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value?: string): string {
  if (!value) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return escapeHtml(value);
  }
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanize(value?: string): string {
  if (!value) {
    return "";
  }
  return value
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function latestManifest(record: PackageRecord) {
  return record.versions.find((item) => item.version === record.latestVersion)?.manifest ?? record.versions[0]?.manifest;
}

function toneForStatus(value?: string): string {
  switch (value) {
    case "published":
    case "approved":
    case "success":
      return "success";
    case "submitted":
    case "under_review":
    case "changes_requested":
    case "warning":
      return "warning";
    case "official":
    case "info":
      return "info";
    case "community":
      return "violet";
    case "rejected":
    case "archived":
    case "failed":
      return "danger";
    default:
      return "muted";
  }
}

function renderPill(label: string, tone = "muted", mono = false): string {
  return `<span class="pill tone-${escapeHtml(tone)}${mono ? " mono" : ""}">${escapeHtml(label)}</span>`;
}

function renderButton(label: string, href: string, variant: "primary" | "secondary" | "ghost" | "outline" = "secondary"): string {
  return `<a class="btn btn-${variant}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderNav(auth: AuthContext, activePath: ShellOptions["activePath"] = "/"): string {
  const items = [
    { href: "/", label: "Overview" },
    { href: "/downloads", label: "Downloads" },
    { href: "/community", label: "Community" },
  ];

  return `<nav class="site-nav">
    ${items
      .map(
        (item) =>
          `<a href="${item.href}" class="${activePath === item.href ? "is-active" : ""}">${escapeHtml(item.label)}</a>`,
      )
      .join("")}
    ${auth ? `<a href="/submit" class="${activePath === "/submit" ? "is-active" : ""}">Submit</a>` : ""}
    ${auth && ["reviewer", "super_admin"].includes(auth.user.role) ? `<a href="/review" class="${activePath === "/review" ? "is-active" : ""}">Review</a>` : ""}
    ${auth?.user.role === "super_admin" ? `<a href="/admin" class="${activePath === "/admin" ? "is-active" : ""}">Admin</a>` : ""}
  </nav>`;
}

function renderAuthStrip(auth: AuthContext): string {
  if (!auth) {
    return `<div class="auth-strip guest">
      <div class="auth-copy">
        <span class="micro-label">Account</span>
        <strong>Sign in to request signed downloads and submit packages.</strong>
      </div>
      <div class="auth-actions">
        ${renderButton("Sign In", "/login", "ghost")}
      </div>
    </div>`;
  }

  return `<div class="auth-strip">
    <div class="auth-copy">
      <span class="micro-label">Signed in as</span>
      <strong>${escapeHtml(auth.user.email)}</strong>
    </div>
    <div class="auth-actions">
      ${renderPill(humanize(auth.user.role), toneForStatus(auth.user.role === "super_admin" ? "info" : auth.user.role === "reviewer" ? "warning" : "success"))}
      <a class="mini-link" href="/me">My submissions</a>
      <a class="mini-link" href="/submit">Submit</a>
      ${["reviewer", "super_admin"].includes(auth.user.role) ? `<a class="mini-link" href="/review">Review queue</a>` : ""}
      ${auth.user.role === "super_admin" ? `<a class="mini-link" href="/admin">Admin</a>` : ""}
      <form method="post" action="/auth/logout" class="logout-form">
        <input type="hidden" name="csrfToken" value="${escapeHtml(auth.session.csrfToken)}" />
        <button type="submit" class="btn btn-ghost btn-small">Log out</button>
      </form>
    </div>
  </div>`;
}

function shell(title: string, body: string, auth?: AuthContext, options: ShellOptions = {}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} · ${HUB_BRAND}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #040814;
        --bg-elevated: rgba(15, 23, 42, 0.7);
        --panel: rgba(10, 15, 28, 0.82);
        --panel-strong: rgba(15, 23, 42, 0.92);
        --panel-soft: rgba(255, 255, 255, 0.03);
        --border: rgba(148, 163, 184, 0.16);
        --border-strong: rgba(96, 165, 250, 0.26);
        --text: #e6eefc;
        --text-soft: #a4b5d6;
        --text-faint: #6e7f9d;
        --blue: #5ea8ff;
        --blue-strong: #2563eb;
        --cyan: #66e0ff;
        --violet: #8b7dff;
        --emerald: #31c48d;
        --amber: #f59e0b;
        --rose: #fb7185;
        --shadow: 0 32px 90px rgba(2, 8, 23, 0.48);
        --radius-xl: 28px;
        --radius-lg: 22px;
        --radius-md: 16px;
        --radius-sm: 12px;
        --font-sans: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
        --font-mono: "IBM Plex Mono", "SFMono-Regular", "Consolas", monospace;
      }

      * { box-sizing: border-box; }
      html { min-height: 100%; }
      body {
        margin: 0;
        min-height: 100%;
        color: var(--text);
        background:
          radial-gradient(circle at 20% 0%, rgba(37, 99, 235, 0.26), transparent 34%),
          radial-gradient(circle at 82% 12%, rgba(102, 224, 255, 0.18), transparent 28%),
          radial-gradient(circle at 50% 100%, rgba(99, 102, 241, 0.16), transparent 42%),
          var(--bg);
        font: 16px/1.65 var(--font-sans);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 72px 72px;
        mask-image: radial-gradient(circle at center, black 30%, transparent 90%);
        opacity: 0.35;
      }

      a { color: inherit; text-decoration: none; }
      button, input, textarea { font: inherit; }

      .shell {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
      }

      .shell::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent 14%, transparent 86%, rgba(255,255,255,0.02));
      }

      .header-wrap {
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(18px);
        background: rgba(4, 8, 20, 0.72);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .header {
        max-width: 1220px;
        margin: 0 auto;
        padding: 18px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .brand-mark {
        width: 42px;
        height: 42px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        font: 700 14px/1 var(--font-mono);
        letter-spacing: 0.12em;
        color: white;
        background: linear-gradient(135deg, rgba(94, 168, 255, 0.95), rgba(99, 102, 241, 0.95));
        box-shadow: 0 18px 40px rgba(37, 99, 235, 0.28);
      }

      .brand-text {
        display: grid;
        gap: 2px;
      }

      .brand-text strong {
        font-size: 1.02rem;
        letter-spacing: 0.01em;
      }

      .brand-text span {
        color: var(--text-faint);
        font-size: 0.78rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .site-nav {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .site-nav a {
        padding: 10px 14px;
        border-radius: 999px;
        color: var(--text-soft);
        font-size: 0.94rem;
        transition: 140ms ease;
      }

      .site-nav a:hover,
      .site-nav a.is-active {
        color: white;
        background: rgba(255, 255, 255, 0.07);
      }

      .page {
        position: relative;
        z-index: 1;
        max-width: 1220px;
        margin: 0 auto;
        padding: 28px 24px 88px;
      }

      .page.centered {
        max-width: 760px;
        min-height: calc(100vh - 96px);
        display: flex;
        align-items: center;
      }

      .auth-strip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 22px;
        padding: 16px 18px;
        border-radius: var(--radius-md);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .auth-strip.guest {
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(15, 23, 42, 0.5));
        border-color: rgba(94, 168, 255, 0.22);
      }

      .auth-copy {
        display: grid;
        gap: 4px;
      }

      .auth-copy strong {
        font-size: 0.98rem;
      }

      .micro-label {
        color: var(--text-faint);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .auth-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        justify-content: flex-end;
      }

      .mini-link {
        color: var(--text-soft);
        font-size: 0.92rem;
      }

      .mini-link:hover {
        color: white;
      }

      .logout-form {
        margin: 0;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid transparent;
        font-weight: 600;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, color 140ms ease, box-shadow 140ms ease;
        cursor: pointer;
      }

      .btn:hover {
        transform: translateY(-1px);
      }

      .btn-primary {
        color: white;
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(94, 168, 255, 0.95));
        box-shadow: 0 16px 36px rgba(37, 99, 235, 0.24);
      }

      .btn-secondary {
        color: white;
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(148, 163, 184, 0.18);
      }

      .btn-ghost {
        color: var(--text-soft);
        background: transparent;
        border-color: rgba(148, 163, 184, 0.18);
      }

      .btn-outline {
        color: var(--blue);
        border-color: rgba(94, 168, 255, 0.34);
        background: rgba(94, 168, 255, 0.08);
      }

      .btn-small {
        min-height: 36px;
        padding: 0 14px;
        font-size: 0.9rem;
      }

      .hero {
        position: relative;
        overflow: hidden;
        padding: 34px;
        border-radius: var(--radius-xl);
        background:
          linear-gradient(160deg, rgba(94, 168, 255, 0.12), transparent 32%),
          linear-gradient(205deg, rgba(99, 102, 241, 0.12), transparent 30%),
          var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: var(--shadow);
      }

      .hero::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,0.05), transparent 20%, transparent 80%, rgba(255,255,255,0.03));
      }

      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
        gap: 28px;
        align-items: stretch;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(94, 168, 255, 0.22);
        background: rgba(94, 168, 255, 0.08);
        color: var(--blue);
        font: 600 0.78rem/1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: var(--cyan);
        box-shadow: 0 0 18px rgba(102, 224, 255, 0.8);
      }

      .hero-copy {
        display: grid;
        gap: 22px;
      }

      .hero-copy h1 {
        margin: 0;
        max-width: 12ch;
        font-size: clamp(2.7rem, 7vw, 5.1rem);
        line-height: 0.98;
        letter-spacing: -0.05em;
      }

      .hero-copy h1 span {
        display: block;
        color: transparent;
        background: linear-gradient(90deg, #e6eefc, #76d6ff, #7f86ff);
        background-clip: text;
        -webkit-background-clip: text;
      }

      .lede {
        margin: 0;
        max-width: 60ch;
        color: var(--text-soft);
        font-size: 1.06rem;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .terminal-callout {
        padding: 16px 18px;
        border-radius: var(--radius-md);
        background: rgba(3, 7, 18, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .terminal-label {
        display: block;
        margin-bottom: 8px;
        color: var(--text-faint);
        font-size: 0.76rem;
        font-family: var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .terminal-callout code {
        color: var(--cyan);
        font: 500 0.92rem/1.7 var(--font-mono);
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .metric {
        padding: 16px;
        border-radius: var(--radius-md);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
      }

      .metric strong {
        display: block;
        font-size: 1.8rem;
        line-height: 1;
        margin-bottom: 6px;
      }

      .metric span {
        color: var(--text-soft);
        font-size: 0.92rem;
      }

      .stack {
        display: grid;
        gap: 16px;
      }

      .signal-card {
        padding: 20px;
        border-radius: var(--radius-lg);
        background: rgba(7, 13, 26, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: grid;
        gap: 14px;
      }

      .signal-card h3,
      .panel h3,
      .catalog-card h3,
      .detail-block h2,
      .section-header h2,
      .form-card h2 {
        margin: 0;
      }

      .card-kicker {
        color: var(--text-faint);
        font: 0.76rem/1.3 var(--font-mono);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .signal-card p,
      .panel p,
      .catalog-card p,
      .detail-block p,
      .empty-state p {
        margin: 0;
      }

      .signal-list,
      .detail-list,
      .resource-list {
        display: grid;
        gap: 10px;
      }

      .signal-row,
      .detail-item,
      .resource-row {
        padding: 13px 14px;
        border-radius: var(--radius-sm);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .signal-row strong,
      .detail-item strong,
      .resource-row strong {
        display: block;
        margin-bottom: 4px;
      }

      .signal-row span,
      .detail-item span,
      .resource-row span,
      .panel ul,
      .meta-note,
      .subtle {
        color: var(--text-soft);
      }

      .section {
        margin-top: 26px;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 14px;
      }

      .section-header p {
        margin: 0;
        color: var(--text-soft);
      }

      .panel-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .panel {
        padding: 22px;
        border-radius: var(--radius-lg);
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: grid;
        gap: 12px;
      }

      .panel ul {
        margin: 0;
        padding-left: 18px;
      }

      .catalog-grid,
      .submission-grid {
        display: grid;
        gap: 16px;
      }

      .catalog-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .catalog-card,
      .submission-card,
      .form-card,
      .detail-block {
        padding: 22px;
        border-radius: var(--radius-lg);
        background: var(--panel-strong);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 18px 52px rgba(2, 8, 23, 0.28);
      }

      .catalog-card {
        display: grid;
        gap: 16px;
      }

      .card-top,
      .card-bottom,
      .detail-meta-row,
      .submission-top {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
      }

      .card-code,
      .mono {
        font-family: var(--font-mono);
        color: var(--text-faint);
        font-size: 0.82rem;
      }

      .card-description {
        color: var(--text-soft);
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 0.76rem;
        line-height: 1;
        font-weight: 700;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-soft);
      }

      .pill.mono {
        font-family: var(--font-mono);
      }

      .tone-success {
        color: #d2ffe9;
        background: rgba(49, 196, 141, 0.16);
        border-color: rgba(49, 196, 141, 0.26);
      }

      .tone-warning {
        color: #ffedc1;
        background: rgba(245, 158, 11, 0.14);
        border-color: rgba(245, 158, 11, 0.24);
      }

      .tone-danger {
        color: #ffd5df;
        background: rgba(251, 113, 133, 0.14);
        border-color: rgba(251, 113, 133, 0.24);
      }

      .tone-info {
        color: #d7ebff;
        background: rgba(94, 168, 255, 0.14);
        border-color: rgba(94, 168, 255, 0.24);
      }

      .tone-violet {
        color: #e0ddff;
        background: rgba(139, 125, 255, 0.14);
        border-color: rgba(139, 125, 255, 0.24);
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .meta-box {
        padding: 14px;
        border-radius: var(--radius-md);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .meta-label {
        display: block;
        margin-bottom: 6px;
        color: var(--text-faint);
        font-size: 0.76rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .meta-value {
        color: var(--text);
        font-weight: 600;
      }

      .two-column {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.9fr);
        gap: 18px;
      }

      .hero-detail {
        display: grid;
        gap: 18px;
      }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--text-soft);
        font-size: 0.92rem;
      }

      .back-link:hover {
        color: white;
      }

      .detail-columns {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.8fr);
        gap: 18px;
        margin-top: 18px;
      }

      .detail-main,
      .detail-side {
        display: grid;
        gap: 16px;
      }

      .detail-block {
        display: grid;
        gap: 14px;
      }

      .detail-block h2 {
        font-size: 1.12rem;
      }

      .definition-grid {
        display: grid;
        gap: 12px;
      }

      .definition-item {
        padding: 14px;
        border-radius: var(--radius-md);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .definition-item strong {
        display: block;
        margin-bottom: 6px;
      }

      .resource-link {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        color: var(--text-soft);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .resource-link:hover {
        color: white;
        border-color: rgba(94, 168, 255, 0.28);
      }

      .form-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
        gap: 18px;
      }

      .form-card,
      .center-card {
        display: grid;
        gap: 18px;
      }

      .center-card {
        width: 100%;
        max-width: 620px;
        margin: 0 auto;
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .field label {
        color: var(--text-soft);
        font-size: 0.92rem;
      }

      .field input,
      .field textarea {
        width: 100%;
        min-height: 48px;
        padding: 12px 14px;
        color: var(--text);
        border-radius: var(--radius-sm);
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: rgba(3, 7, 18, 0.72);
      }

      .field textarea {
        min-height: 110px;
        resize: vertical;
      }

      .field input[type="file"] {
        padding: 14px;
      }

      .field input:focus,
      .field textarea:focus {
        outline: none;
        border-color: rgba(94, 168, 255, 0.42);
        box-shadow: 0 0 0 4px rgba(94, 168, 255, 0.1);
      }

      .form-actions,
      .submission-actions,
      .review-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .review-actions form,
      .submission-actions form {
        margin: 0;
      }

      .note-row {
        display: grid;
        gap: 10px;
      }

      .note-row input {
        width: 100%;
      }

      .empty-state {
        padding: 28px;
        border-radius: var(--radius-lg);
        text-align: center;
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(148, 163, 184, 0.22);
      }

      .footer {
        position: relative;
        z-index: 1;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 26px 24px 42px;
        color: var(--text-faint);
      }

      .footer-inner {
        max-width: 1220px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
      }

      .footer-links {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }

      .footer-links a:hover {
        color: white;
      }

      @media (max-width: 1080px) {
        .hero-grid,
        .detail-columns,
        .form-grid,
        .two-column {
          grid-template-columns: 1fr;
        }

        .panel-grid,
        .catalog-grid,
        .metrics,
        .meta-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .header,
        .page,
        .footer {
          padding-left: 16px;
          padding-right: 16px;
        }

        .hero,
        .catalog-card,
        .submission-card,
        .form-card,
        .detail-block,
        .signal-card {
          padding: 18px;
        }

        .hero-copy h1 {
          font-size: clamp(2.3rem, 16vw, 3.8rem);
        }

        .card-top,
        .card-bottom,
        .detail-meta-row,
        .submission-top,
        .auth-strip {
          flex-direction: column;
          align-items: flex-start;
        }

        .auth-actions,
        .site-nav {
          justify-content: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="header-wrap">
        <header class="header">
          <a class="brand" href="/">
            <span class="brand-mark">FH</span>
            <span class="brand-text">
              <strong>${HUB_BRAND}</strong>
              <span>Registry • Review • Delivery</span>
            </span>
          </a>
          ${renderNav(auth, options.activePath)}
        </header>
      </div>
      <main class="page${options.centered ? " centered" : ""}">
        ${renderAuthStrip(auth)}
        ${body}
      </main>
      ${options.hideFooter ? "" : `<footer class="footer">
        <div class="footer-inner">
          <div>
            <strong>${HUB_BRAND}</strong>
            <div>Signed package delivery for ${CONSOLE_BRAND} and other local-first runtimes.</div>
          </div>
          <div class="footer-links">
            <a href="/downloads">Downloads</a>
            <a href="/community">Community</a>
            <a href="/submit">Submit</a>
            <a href="/admin">Admin</a>
          </div>
        </div>
      </footer>`}
    </div>
  </body>
</html>`;
}

function renderPackageCards(packages: PackageRecord[], auth: AuthContext, view: "downloads" | "community"): string {
  if (packages.length === 0) {
    return `<div class="empty-state">
      <h3>No published packages yet</h3>
      <p>${view === "downloads" ? "As soon as reviewed packages are published, they will appear here for signed download." : "Community submissions will appear here once they pass manual review."}</p>
    </div>`;
  }

  return `<div class="catalog-grid">
    ${packages
      .map((record) => {
        const manifest = latestManifest(record);
        const capabilityPills = (manifest?.capabilities ?? [])
          .slice(0, 3)
          .map((item) => renderPill(item.label, "muted"))
          .join("");
        const sourceTone = record.visibility === "official" ? "info" : record.visibility === "community" ? "violet" : "muted";
        return `<article class="catalog-card">
          <div class="card-top">
            <div>
              <div class="pill-row">
                ${renderPill(humanize(record.visibility), sourceTone)}
                ${renderPill(humanize(record.reviewStatus), toneForStatus(record.reviewStatus))}
                ${record.githubSyncStatus ? renderPill(`GitHub ${humanize(record.githubSyncStatus)}`, toneForStatus(record.githubSyncStatus)) : ""}
              </div>
              <h3><a href="/package/${encodeURIComponent(record.packageId)}">${escapeHtml(record.name)}</a></h3>
              <div class="card-code">${escapeHtml(record.packageId)}</div>
            </div>
            <div class="pill mono">v${escapeHtml(record.latestVersion)}</div>
          </div>
          <p class="card-description">${escapeHtml(manifest?.description || "Package metadata is available, but no description was provided.")}</p>
          <div class="meta-grid">
            <div class="meta-box">
              <span class="meta-label">Type</span>
              <span class="meta-value">${escapeHtml(humanize(record.type))}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Capabilities</span>
              <span class="meta-value">${String(manifest?.capabilities?.length ?? 0)}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Permissions</span>
              <span class="meta-value">${String(manifest?.permissions?.length ?? 0)}</span>
            </div>
          </div>
          ${capabilityPills ? `<div class="pill-row">${capabilityPills}</div>` : ""}
          <div class="card-bottom">
            <div class="subtle">Updated ${escapeHtml(formatDate(record.versions.find((item) => item.version === record.latestVersion)?.publishedAt || record.githubSyncAt))}</div>
            <div class="hero-actions">
              <a class="btn btn-ghost btn-small" href="/package/${encodeURIComponent(record.packageId)}">Open details</a>
              ${auth && view === "downloads" ? `<a class="btn btn-primary btn-small" href="/package/${encodeURIComponent(record.packageId)}/download">Signed download</a>` : ""}
            </div>
          </div>
        </article>`;
      })
      .join("")}
  </div>`;
}

function renderDefinitionItems(items: Array<{ title: string; body: string; meta?: string }>, empty: string): string {
  if (items.length === 0) {
    return `<div class="empty-state"><p>${escapeHtml(empty)}</p></div>`;
  }

  return `<div class="definition-grid">
    ${items
      .map(
        (item) => `<div class="definition-item">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
          ${item.meta ? `<div class="subtle">${escapeHtml(item.meta)}</div>` : ""}
        </div>`,
      )
      .join("")}
  </div>`;
}

function renderSubmissionCards(submissions: SubmissionRecord[], auth: { user: User; session: Session }, reviewMode: boolean): string {
  if (submissions.length === 0) {
    return `<div class="empty-state">
      <h3>${reviewMode ? "Queue is clear" : "No submissions yet"}</h3>
      <p>${reviewMode ? "There are no community submissions waiting for review right now." : "Upload a community package zip and it will show up here with review and publishing status."}</p>
    </div>`;
  }

  return `<div class="submission-grid">
    ${submissions
      .map(
        (item) => `<article class="submission-card">
          <div class="submission-top">
            <div>
              <div class="pill-row">
                ${renderPill(humanize(item.status), toneForStatus(item.status))}
                ${item.githubSyncStatus ? renderPill(`GitHub ${humanize(item.githubSyncStatus)}`, toneForStatus(item.githubSyncStatus)) : ""}
              </div>
              <h3>${escapeHtml(item.packageId)}</h3>
              <div class="card-code">Submission ${escapeHtml(item.id)}</div>
            </div>
            <div class="pill mono">v${escapeHtml(item.packageVersion)}</div>
          </div>
          <div class="meta-grid">
            <div class="meta-box">
              <span class="meta-label">Created</span>
              <span class="meta-value">${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Updated</span>
              <span class="meta-value">${escapeHtml(formatDate(item.updatedAt))}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Release</span>
              <span class="meta-value">${item.githubReleaseUrl ? "Synced" : "Local only"}</span>
            </div>
          </div>
          ${item.githubReleaseUrl ? `<a class="resource-link" href="${escapeHtml(item.githubReleaseUrl)}" target="_blank" rel="noreferrer"><span>GitHub release</span><strong>Open</strong></a>` : ""}
          ${
            reviewMode
              ? `<div class="review-actions">
                  <form method="post" action="/review/${encodeURIComponent(item.id)}/approve-form">
                    <input type="hidden" name="csrfToken" value="${escapeHtml(auth.session.csrfToken)}" />
                    <button class="btn btn-primary btn-small" type="submit">Approve & Publish</button>
                  </form>
                  <form method="post" action="/review/${encodeURIComponent(item.id)}/request-changes-form" class="note-row">
                    <input type="hidden" name="csrfToken" value="${escapeHtml(auth.session.csrfToken)}" />
                    <input type="text" name="note" placeholder="What needs to be fixed?" />
                    <button class="btn btn-outline btn-small" type="submit">Request changes</button>
                  </form>
                  <form method="post" action="/review/${encodeURIComponent(item.id)}/reject-form" class="note-row">
                    <input type="hidden" name="csrfToken" value="${escapeHtml(auth.session.csrfToken)}" />
                    <input type="text" name="note" placeholder="Reason for rejection" />
                    <button class="btn btn-ghost btn-small" type="submit">Reject</button>
                  </form>
                </div>`
              : `<div class="submission-actions">
                  <a class="btn btn-ghost btn-small" href="/package/${encodeURIComponent(item.packageId)}">View package page</a>
                  ${item.githubReleaseUrl ? `<a class="btn btn-outline btn-small" href="${escapeHtml(item.githubReleaseUrl)}" target="_blank" rel="noreferrer">Open GitHub release</a>` : ""}
                </div>`
          }
        </article>`,
      )
      .join("")}
  </div>`;
}

export function renderHome(packageCount: number, submissionCount: number, auth?: { user: User; session: Session } | null) {
  return shell(
    "Overview",
    `<section class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">Cloud registry with local-first boundaries</div>
          <h1>Ship reviewed packages with a <span>real product surface.</span></h1>
          <p class="lede">${HUB_BRAND} handles package discovery, contributor submissions, moderation, and signed downloads without exposing the local runtime. ${CONSOLE_BRAND} stays private. The public experience finally looks like a platform instead of an internal tool.</p>
          <div class="hero-actions">
            ${renderButton("Browse downloads", "/downloads", "primary")}
            ${renderButton("Explore community", "/community", "secondary")}
            ${auth ? renderButton("Submit a package", "/submit", "ghost") : renderButton("Sign in to submit", "/login", "ghost")}
          </div>
          <div class="terminal-callout">
            <span class="terminal-label">Release flow</span>
            <code>${escapeHtml("Export from Forge Console -> Submit to Forge Hub -> Review -> Signed download")}</code>
          </div>
          <div class="metrics">
            <div class="metric">
              <strong>${String(packageCount)}</strong>
              <span>Published packages</span>
            </div>
            <div class="metric">
              <strong>${String(submissionCount)}</strong>
              <span>Tracked submissions</span>
            </div>
            <div class="metric">
              <strong>Local-first</strong>
              <span>No public broker access</span>
            </div>
          </div>
        </div>
        <div class="stack">
          <section class="signal-card">
            <span class="card-kicker">Product split</span>
            <h3>${HUB_BRAND}</h3>
            <p>Discovery, review, downloads, and release handoff for reusable packages and tutorials.</p>
            <div class="signal-list">
              <div class="signal-row">
                <strong>${CONSOLE_BRAND}</strong>
                <span>Local runtime, install surface, resident agent, package import.</span>
              </div>
              <div class="signal-row">
                <strong>GitHub distribution</strong>
                <span>Public landing pages, releases, and optional community visibility.</span>
              </div>
            </div>
          </section>
          <section class="signal-card">
            <span class="card-kicker">Trust model</span>
            <h3>Signed delivery, manual review, explicit permissions</h3>
            <div class="signal-list">
              <div class="signal-row">
                <strong>Moderated submissions</strong>
                <span>Community uploads are published only after review.</span>
              </div>
              <div class="signal-row">
                <strong>Permission transparency</strong>
                <span>Each package advertises capabilities, dependencies, and required permissions.</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <h2>Platform surfaces</h2>
          <p>Everything needed to move a package from local export to reviewed distribution.</p>
        </div>
      </div>
      <div class="panel-grid">
        <article class="panel">
          <span class="card-kicker">Registry</span>
          <h3>Browse official and community packages</h3>
          <p>Curated download pages, package detail pages, and compatibility notes built from package manifests.</p>
          <div class="hero-actions">${renderButton("Open downloads", "/downloads", "outline")}</div>
        </article>
        <article class="panel">
          <span class="card-kicker">Submission</span>
          <h3>Accept package uploads with review gates</h3>
          <p>Sign in, upload a community package zip, and keep a status history for every submission.</p>
          <div class="hero-actions">${auth ? renderButton("Submit package", "/submit", "outline") : renderButton("Sign in first", "/login", "outline")}</div>
        </article>
        <article class="panel">
          <span class="card-kicker">Operations</span>
          <h3>Keep privileged flows inside the right boundary</h3>
          <p>${HUB_BRAND} never replaces the local operator console. Sensitive execution stays in ${CONSOLE_BRAND}.</p>
          <div class="hero-actions">${auth?.user.role === "super_admin" ? renderButton("Open admin", "/admin", "outline") : renderButton("Read community", "/community", "outline")}</div>
        </article>
      </div>
    </section>`,
    auth,
    { activePath: "/" },
  );
}

export function renderPackageList(title: string, packages: PackageRecord[], auth?: { user: User; session: Session } | null) {
  const downloadsView = title.toLowerCase() === "downloads";
  const officialCount = packages.filter((item) => item.visibility === "official").length;
  const communityCount = packages.filter((item) => item.visibility === "community").length;

  return shell(
    title,
    `<section class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">${downloadsView ? "Signed package delivery" : "Moderated community catalog"}</div>
          <h1>${downloadsView ? `Download packages that are <span>ready for local import.</span>` : `Browse packages the <span>community has shipped.</span>`}</h1>
          <p class="lede">${downloadsView ? `${HUB_BRAND} generates signed download links for published packages so they can be pulled into ${CONSOLE_BRAND} without exposing the local broker.` : `Every public community package listed here has already passed review and can be opened for manifest details, permissions, and compatibility.`}</p>
          <div class="metrics">
            <div class="metric">
              <strong>${String(packages.length)}</strong>
              <span>Published records</span>
            </div>
            <div class="metric">
              <strong>${String(officialCount)}</strong>
              <span>Official packages</span>
            </div>
            <div class="metric">
              <strong>${String(communityCount)}</strong>
              <span>Community packages</span>
            </div>
          </div>
        </div>
        <div class="stack">
          <section class="signal-card">
            <span class="card-kicker">${downloadsView ? "Download flow" : "Community flow"}</span>
            <h3>${downloadsView ? "Sign in, request, import locally" : "Submit, review, publish"}</h3>
            <div class="signal-list">
              <div class="signal-row">
                <strong>Step 1</strong>
                <span>${downloadsView ? "Open package details and request a signed download URL." : "Upload a community package zip from your local export."}</span>
              </div>
              <div class="signal-row">
                <strong>Step 2</strong>
                <span>${downloadsView ? `Import the archive inside ${CONSOLE_BRAND}.` : "A reviewer checks manifest quality, permissions, and package intent."}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${downloadsView ? "Open any package to inspect capabilities, permissions, docs, and the latest release state." : "The catalog below shows what is already public and installable."}</p>
        </div>
        <div class="pill-row">
          ${renderPill(downloadsView ? "Signed URLs" : "Manual review", downloadsView ? "info" : "warning")}
          ${renderPill("Manifest-driven", "muted")}
        </div>
      </div>
      ${renderPackageCards(packages, auth, downloadsView ? "downloads" : "community")}
    </section>`,
    auth,
    { activePath: downloadsView ? "/downloads" : "/community" },
  );
}

export function renderPackageDetail(record: PackageRecord, auth?: { user: User; session: Session } | null) {
  const latest = record.versions.find((item) => item.version === record.latestVersion) ?? record.versions[0];
  const manifest = latest?.manifest;
  const backPath = record.visibility === "community" ? "/community" : "/downloads";
  const versionHistory = record.versions
    .slice()
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));

  return shell(
    record.name,
    `<section class="hero hero-detail">
      <a class="back-link" href="${backPath}">← Back to ${backPath === "/community" ? "community" : "downloads"}</a>
      <div class="pill-row">
        ${renderPill(humanize(record.visibility), record.visibility === "official" ? "info" : record.visibility === "community" ? "violet" : "muted")}
        ${renderPill(humanize(record.reviewStatus), toneForStatus(record.reviewStatus))}
        ${latest?.githubSyncStatus ? renderPill(`GitHub ${humanize(latest.githubSyncStatus)}`, toneForStatus(latest.githubSyncStatus)) : ""}
      </div>
      <h1>${escapeHtml(record.name)}</h1>
      <p class="lede">${escapeHtml(manifest?.description || "This package does not include a human-readable description yet.")}</p>
      <div class="pill-row">
        ${renderPill(`Package ID ${record.packageId}`, "muted", true)}
        ${renderPill(`Version ${record.latestVersion}`, "info", true)}
        ${renderPill(humanize(record.type), "muted")}
      </div>
    </section>
    <section class="detail-columns">
      <div class="detail-main">
        <article class="detail-block">
          <h2>Overview</h2>
          <p>This package is distributed through ${HUB_BRAND} and intended for installation inside ${CONSOLE_BRAND}. Review the capability summary, dependencies, and permission scope below before requesting a signed archive.</p>
          <div class="meta-grid">
            <div class="meta-box">
              <span class="meta-label">Author</span>
              <span class="meta-value">${escapeHtml(manifest?.author.name || "Unknown")}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Install mode</span>
              <span class="meta-value">${escapeHtml(humanize(manifest?.compatibility.installMode || "local-console"))}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Minimum runtime</span>
              <span class="meta-value">${escapeHtml(manifest?.compatibility.openclawMinVersion || "Not declared")}</span>
            </div>
          </div>
        </article>
        <article class="detail-block">
          <h2>Capabilities</h2>
          ${renderDefinitionItems(
            (manifest?.capabilities ?? []).map((item) => ({
              title: item.label,
              body: item.summary || "No capability summary was included.",
              meta: item.entrypoint ? `Entrypoint: ${item.entrypoint}` : undefined,
            })),
            "No capabilities were declared in the manifest.",
          )}
        </article>
        <article class="detail-block">
          <h2>Dependencies</h2>
          ${renderDefinitionItems(
            (manifest?.dependencies ?? []).map((item) => ({
              title: `${item.label}${item.required ? " (required)" : ""}`,
              body: `${humanize(item.kind)} dependency${item.bundled ? ", bundled in package" : ""}.`,
              meta: item.installCommand || item.installUrl || undefined,
            })),
            "This package does not declare extra dependencies.",
          )}
        </article>
        <article class="detail-block">
          <h2>Permissions</h2>
          ${renderDefinitionItems(
            (manifest?.permissions ?? []).map((item) => ({
              title: `${item.key}${item.required ? " (required)" : " (optional)"}`,
              body: item.reason,
            })),
            "No permission requirements were declared.",
          )}
        </article>
        <article class="detail-block">
          <h2>Version history</h2>
          ${renderDefinitionItems(
            versionHistory.map((item) => ({
              title: `v${item.version}`,
              body: item.manifest.description || "No description attached to this version.",
              meta: item.publishedAt ? `Published ${formatDate(item.publishedAt)}` : "Stored locally",
            })),
            "No version history is available yet.",
          )}
        </article>
      </div>
      <aside class="detail-side">
        <article class="detail-block">
          <h2>Get package</h2>
          <p>${auth ? "Request a signed URL, then import the archive inside Forge Console." : "Sign in first to request a signed download URL."}</p>
          <div class="hero-actions">
            ${auth ? `<a class="btn btn-primary" href="/package/${encodeURIComponent(record.packageId)}/download">Request signed download</a>` : renderButton("Sign in to download", "/login", "primary")}
            <a class="btn btn-ghost" href="/downloads/${encodeURIComponent(record.packageId)}">Download API</a>
          </div>
        </article>
        <article class="detail-block">
          <h2>Package facts</h2>
          <div class="resource-list">
            <div class="resource-row">
              <strong>Platforms</strong>
              <span>${escapeHtml((manifest?.compatibility.platforms ?? ["Local console"]).join(", "))}</span>
            </div>
            <div class="resource-row">
              <strong>Docs bundled</strong>
              <span>${String(manifest?.docs.length ?? 0)}</span>
            </div>
            <div class="resource-row">
              <strong>Assets bundled</strong>
              <span>${String(manifest?.assets.length ?? 0)}</span>
            </div>
            <div class="resource-row">
              <strong>GitHub sync</strong>
              <span>${escapeHtml(humanize(latest?.githubSyncStatus || "not_synced"))}</span>
            </div>
          </div>
        </article>
        <article class="detail-block">
          <h2>References</h2>
          <div class="resource-list">
            ${manifest?.author.homepage ? `<a class="resource-link" href="${escapeHtml(manifest.author.homepage)}" target="_blank" rel="noreferrer"><span>Author homepage</span><strong>Open</strong></a>` : ""}
            ${manifest?.source?.repository ? `<a class="resource-link" href="${escapeHtml(manifest.source.repository)}" target="_blank" rel="noreferrer"><span>Source repository</span><strong>Open</strong></a>` : ""}
            ${latest?.githubReleaseUrl ? `<a class="resource-link" href="${escapeHtml(latest.githubReleaseUrl)}" target="_blank" rel="noreferrer"><span>GitHub release</span><strong>Open</strong></a>` : ""}
            ${manifest?.docs.map((doc) => `<div class="resource-row"><strong>${escapeHtml(doc.title)}</strong><span>${escapeHtml(doc.path)}</span></div>`).join("") || `<div class="resource-row"><strong>Docs</strong><span>No bundled docs declared</span></div>`}
          </div>
        </article>
      </aside>
    </section>`,
    auth,
    { activePath: backPath as ShellOptions["activePath"] },
  );
}

export function renderLoginPage(debugCode: string | null = null, auth?: { user: User; session: Session } | null) {
  const statusLabel = debugCode
    ? /^\d{6}$/.test(debugCode)
      ? `Development login code: ${debugCode}`
      : debugCode
    : "";

  return shell(
    "Login",
    `<section class="center-card form-card">
      <div>
        <div class="eyebrow">Secure access for downloads and submissions</div>
        <h2>Sign in to ${HUB_BRAND}</h2>
        <p class="lede">GitHub OAuth and email login both flow through the same review, submission, and signed-download system.</p>
      </div>
      ${statusLabel ? `<div class="signal-row"><strong>Status</strong><span>${escapeHtml(statusLabel)}</span></div>` : ""}
      <div class="form-grid">
        <article class="form-card">
          <h2>Continue with GitHub</h2>
          <p class="subtle">Use GitHub when you want the fastest path into package publishing and public attribution.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/auth/github/start">Continue with GitHub</a>
          </div>
        </article>
        <article class="form-card">
          <h2>Use email code</h2>
          <div class="stack">
            <form class="stack" method="post" action="/login/request">
              <div class="field">
                <label for="email-request">Email address</label>
                <input id="email-request" type="email" name="email" placeholder="name@example.com" required />
              </div>
              <button class="btn btn-secondary" type="submit">Send login code</button>
            </form>
            <form class="stack" method="post" action="/login/verify">
              <div class="field">
                <label for="email-verify">Email address</label>
                <input id="email-verify" type="email" name="email" placeholder="name@example.com" required />
              </div>
              <div class="field">
                <label for="code-verify">Verification code</label>
                <input id="code-verify" type="text" name="code" inputmode="numeric" placeholder="123456" required />
              </div>
              <button class="btn btn-primary" type="submit">Verify and sign in</button>
            </form>
          </div>
        </article>
      </div>
    </section>`,
    auth,
    { activePath: "/login", centered: true, hideFooter: true },
  );
}

export function renderAdminTwoFactorPage(auth: { user: User; session: Session }, message = "") {
  return shell(
    "Admin Verification",
    `<section class="center-card form-card">
      <div>
        <div class="eyebrow">Privileged session gate</div>
        <h2>Super-admin verification</h2>
        <p class="lede">Enter the authenticator code for ${escapeHtml(auth.user.email)} before opening admin and review controls.</p>
      </div>
      ${message ? `<div class="signal-row"><strong>Verification status</strong><span>${escapeHtml(message)}</span></div>` : ""}
      <form class="stack" method="post" action="/admin/2fa">
        <input type="hidden" name="csrfToken" value="${escapeHtml(auth.session.csrfToken)}" />
        <div class="field">
          <label for="admin-code">Authenticator code</label>
          <input id="admin-code" type="text" name="code" inputmode="numeric" placeholder="6-digit code" required />
        </div>
        <button class="btn btn-primary" type="submit">Verify 2FA</button>
      </form>
    </section>`,
    auth,
    { activePath: "/admin/2fa", centered: true, hideFooter: true },
  );
}

export function renderSubmitPage(auth: { user: User; session: Session }) {
  return shell(
    "Submit Package",
    `<section class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">Community package intake</div>
          <h1>Upload a package zip for <span>manual review.</span></h1>
          <p class="lede">Submissions stay private until a reviewer approves them. Upload the archive exported from ${CONSOLE_BRAND} and the manifest will be parsed on arrival.</p>
        </div>
        <div class="stack">
          <section class="signal-card">
            <span class="card-kicker">Before you upload</span>
            <div class="signal-list">
              <div class="signal-row">
                <strong>Manifest required</strong>
                <span>The archive must include <code>community-package.json</code> at the root or inside a top-level folder.</span>
              </div>
              <div class="signal-row">
                <strong>Review happens first</strong>
                <span>Public visibility is only granted after the package is manually reviewed.</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="form-grid">
        <article class="form-card">
          <h2>Upload package archive</h2>
          <form class="stack" method="post" action="/submit" enctype="multipart/form-data">
            <input type="hidden" name="csrfToken" value="${escapeHtml(auth.session.csrfToken)}" />
            <div class="field">
              <label for="package-upload">Community package zip</label>
              <input id="package-upload" type="file" name="package" accept=".zip" required />
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit">Upload submission</button>
              <a class="btn btn-ghost" href="/me">Back to my submissions</a>
            </div>
          </form>
        </article>
        <article class="form-card">
          <h2>Review checklist</h2>
          <div class="resource-list">
            <div class="resource-row">
              <strong>Describe capabilities clearly</strong>
              <span>Reviewers need enough information to understand what the package does and what it touches.</span>
            </div>
            <div class="resource-row">
              <strong>Keep permission scope honest</strong>
              <span>Filesystem, process, and network permissions should match the real behavior of the package.</span>
            </div>
            <div class="resource-row">
              <strong>Make install assumptions explicit</strong>
              <span>Dependencies, runtime expectations, and docs should be packaged together when possible.</span>
            </div>
          </div>
        </article>
      </div>
    </section>`,
    auth,
    { activePath: "/submit" },
  );
}

export function renderMySubmissionsPage(auth: { user: User; session: Session }, submissions: SubmissionRecord[]) {
  return shell(
    "My Submissions",
    `<section class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">Contributor workspace</div>
          <h1>Track what you’ve submitted <span>and what ships next.</span></h1>
          <p class="lede">Every upload keeps its own review state, package version, and optional GitHub release sync metadata.</p>
          <div class="hero-actions">
            ${renderButton("New submission", "/submit", "primary")}
          </div>
        </div>
        <div class="stack">
          <section class="signal-card">
            <span class="card-kicker">Account</span>
            <h3>${escapeHtml(auth.user.email)}</h3>
            <p>Your submissions stay attached to this account and can be audited across review decisions and releases.</p>
          </section>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <h2>Submission history</h2>
          <p>Package uploads, review outcomes, and optional release sync state.</p>
        </div>
      </div>
      ${renderSubmissionCards(submissions, auth, false)}
    </section>`,
    auth,
    { activePath: "/me" },
  );
}

export function renderReviewQueuePage(auth: { user: User; session: Session }, submissions: SubmissionRecord[]) {
  return shell(
    "Review Queue",
    `<section class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">Reviewer workflow</div>
          <h1>Moderate community submissions <span>without leaving the queue.</span></h1>
          <p class="lede">Approve, request changes, or reject directly from the review surface. The publish step promotes approved archives into the public package registry.</p>
          <div class="metrics">
            <div class="metric">
              <strong>${String(submissions.length)}</strong>
              <span>Waiting for review</span>
            </div>
            <div class="metric">
              <strong>${String(submissions.filter((item) => item.status === "submitted").length)}</strong>
              <span>Fresh submissions</span>
            </div>
            <div class="metric">
              <strong>${String(submissions.filter((item) => item.status === "under_review").length)}</strong>
              <span>Already under review</span>
            </div>
          </div>
        </div>
        <div class="stack">
          <section class="signal-card">
            <span class="card-kicker">Guardrails</span>
            <div class="signal-list">
              <div class="signal-row">
                <strong>Publish only approved submissions</strong>
                <span>The queue only shows items still waiting for a decision.</span>
              </div>
              <div class="signal-row">
                <strong>Leave a note when blocking</strong>
                <span>Use request-changes or reject to capture what authors need to fix.</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-header">
        <div>
          <h2>Pending submissions</h2>
          <p>Review decisions here update the submission state and, when approved, publish into the registry.</p>
        </div>
      </div>
      ${renderSubmissionCards(submissions, auth, true)}
    </section>`,
    auth,
    { activePath: "/review" },
  );
}

export function renderAdminPage(auth?: { user: User; session: Session } | null) {
  return shell(
    "Admin",
    `<section class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">Platform operations</div>
          <h1>Operate ${HUB_BRAND} like a product, <span>not a debug panel.</span></h1>
          <p class="lede">Admin access bundles review flow entry points, audit API surfaces, and security event inspection behind one privileged gate.</p>
          <div class="hero-actions">
            ${renderButton("Open review queue", "/review", "primary")}
            ${renderButton("Audit log API", "/admin/audit-logs", "outline")}
            ${renderButton("Security events API", "/admin/security-events", "ghost")}
          </div>
        </div>
        <div class="stack">
          <section class="signal-card">
            <span class="card-kicker">Current operator</span>
            <h3>${auth ? escapeHtml(auth.user.email) : "Authenticated admin"}</h3>
            <p>Super-admin sessions are separated with 2FA before review and audit operations become available.</p>
          </section>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="panel-grid">
        <article class="panel">
          <span class="card-kicker">Moderation</span>
          <h3>Submission and publish controls</h3>
          <p>Move packages through review, request changes, or reject them before public exposure.</p>
        </article>
        <article class="panel">
          <span class="card-kicker">Audit</span>
          <h3>Structured event history</h3>
          <p>Inspect audit logs and security events through the built-in admin API surfaces.</p>
        </article>
        <article class="panel">
          <span class="card-kicker">Boundary</span>
          <h3>Keep the local runtime private</h3>
          <p>${HUB_BRAND} is for distribution and moderation. Execution and high-privilege automation stay inside ${CONSOLE_BRAND}.</p>
        </article>
      </div>
    </section>`,
    auth,
    { activePath: "/admin" },
  );
}
