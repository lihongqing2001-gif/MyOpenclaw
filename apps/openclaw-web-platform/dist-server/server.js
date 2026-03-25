// server.ts
import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import fs4 from "node:fs";
import os2 from "node:os";
import path4 from "node:path";
import { randomInt } from "node:crypto";
import { authenticator } from "otplib";
import AdmZip from "adm-zip";
import multer from "multer";

// src/server/store.ts
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

// src/server/workspaceTopology.ts
import fs from "node:fs";
import path from "node:path";
var topologyPath = process.env.OPENCLAW_TOPOLOGY_PATH ? path.resolve(process.env.OPENCLAW_TOPOLOGY_PATH) : path.resolve(process.cwd(), "..", "..", "workspace-topology.json");
var cached = null;
function loadTopology() {
  if (cached) {
    return cached;
  }
  if (!fs.existsSync(topologyPath)) {
    throw new Error(`workspace-topology.json not found: ${topologyPath}`);
  }
  cached = JSON.parse(fs.readFileSync(topologyPath, "utf-8"));
  return cached;
}
function getRuntimeRoot() {
  return loadTopology().runtimeRoot;
}

// src/server/store.ts
var dataDir = path2.resolve(
  process.env.OPENCLAW_WEB_DATA_DIR || path2.join(getRuntimeRoot(), "artifacts", "openclaw-web-platform", "data")
);
var storageDir = path2.join(dataDir, "storage");
var packagesDir = path2.join(storageDir, "packages");
var submissionsDir = path2.join(storageDir, "submissions");
var databasePath = path2.join(dataDir, "db.json");
var postgresStateKey = "primary";
var cachedDatabase = null;
var postgresInitialized = false;
var emptyDatabase = () => ({
  users: [],
  sessions: [],
  authChallenges: [],
  oauthStates: [],
  submissions: [],
  packages: [],
  reviewDecisions: [],
  auditLogs: [],
  securityEvents: [],
  cloudConsoleAccessCodes: [],
  cloudConsoleGrants: [],
  settings: {
    github: {
      clientId: "",
      clientSecret: "",
      callbackUrl: "",
      releaseRepo: "",
      token: ""
    },
    smtp: {
      provider: "qq",
      host: "",
      port: "465",
      user: "",
      pass: "",
      from: ""
    },
    authEmail: {
      codeTtlMinutes: 10,
      resendCooldownSeconds: 30,
      requestLimitPerWindow: 8,
      requestWindowMinutes: 15,
      verifyLimitPerWindow: 10,
      verifyWindowMinutes: 15
    }
  }
});
function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}
function normalizeDatabase(payload) {
  return {
    users: arrayOrEmpty(payload?.users),
    sessions: arrayOrEmpty(payload?.sessions),
    authChallenges: arrayOrEmpty(payload?.authChallenges),
    oauthStates: arrayOrEmpty(payload?.oauthStates),
    submissions: arrayOrEmpty(payload?.submissions),
    packages: arrayOrEmpty(payload?.packages),
    reviewDecisions: arrayOrEmpty(payload?.reviewDecisions),
    auditLogs: arrayOrEmpty(payload?.auditLogs),
    securityEvents: arrayOrEmpty(payload?.securityEvents),
    cloudConsoleAccessCodes: arrayOrEmpty(payload?.cloudConsoleAccessCodes),
    cloudConsoleGrants: arrayOrEmpty(payload?.cloudConsoleGrants),
    settings: {
      github: {
        clientId: payload?.settings?.github?.clientId || "",
        clientSecret: payload?.settings?.github?.clientSecret || "",
        callbackUrl: payload?.settings?.github?.callbackUrl || "",
        releaseRepo: payload?.settings?.github?.releaseRepo || "",
        token: payload?.settings?.github?.token || ""
      },
      smtp: {
        provider: payload?.settings?.smtp?.provider === "custom" ? "custom" : "qq",
        host: payload?.settings?.smtp?.host || "",
        port: payload?.settings?.smtp?.port || "465",
        user: payload?.settings?.smtp?.user || "",
        pass: payload?.settings?.smtp?.pass || "",
        from: payload?.settings?.smtp?.from || ""
      },
      authEmail: {
        codeTtlMinutes: Math.max(1, Number(payload?.settings?.authEmail?.codeTtlMinutes || 10)),
        resendCooldownSeconds: Math.max(0, Number(payload?.settings?.authEmail?.resendCooldownSeconds || 30)),
        requestLimitPerWindow: Math.max(1, Number(payload?.settings?.authEmail?.requestLimitPerWindow || 8)),
        requestWindowMinutes: Math.max(1, Number(payload?.settings?.authEmail?.requestWindowMinutes || 15)),
        verifyLimitPerWindow: Math.max(1, Number(payload?.settings?.authEmail?.verifyLimitPerWindow || 10)),
        verifyWindowMinutes: Math.max(1, Number(payload?.settings?.authEmail?.verifyWindowMinutes || 15))
      }
    }
  };
}
function ensureDir(dirPath) {
  fs2.mkdirSync(dirPath, { recursive: true });
}
function cloneDatabase(payload) {
  return JSON.parse(JSON.stringify(payload));
}
function postgresConnectionString() {
  return (process.env.DATABASE_URL || "").trim();
}
function postgresStateTable() {
  const table = (process.env.OPENCLAW_WEB_POSTGRES_TABLE || "openclaw_state").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error(`Invalid PostgreSQL state table name: ${table}`);
  }
  return table;
}
function postgresEnabled() {
  return Boolean(postgresConnectionString());
}
function writeLocalMirror(payload) {
  ensureDir(dataDir);
  fs2.writeFileSync(databasePath, JSON.stringify(payload, null, 2), "utf-8");
}
function runPostgresHelper(action, payload) {
  const tempDir = fs2.mkdtempSync(path2.join(os.tmpdir(), "openclaw-web-platform-pg-"));
  const payloadPath = path2.join(tempDir, "payload.json");
  const resultPath = path2.join(tempDir, "result.json");
  const emptyPath = path2.join(tempDir, "empty.json");
  const helperSource = `
const fs = require("node:fs");
const { Pool } = require("pg");

const table = process.env.OPENCLAW_WEB_POSTGRES_TABLE;
const action = process.env.OPENCLAW_STORE_ACTION;
const stateKey = process.env.OPENCLAW_STORE_KEY;
const payloadPath = process.env.OPENCLAW_STORE_PAYLOAD_PATH;
const resultPath = process.env.OPENCLAW_STORE_RESULT_PATH;
const emptyPath = process.env.OPENCLAW_STORE_EMPTY_PATH;

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
  throw new Error("Invalid PostgreSQL table name");
}

const ensureSql = "CREATE TABLE IF NOT EXISTS " + table + " (state_key TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(ensureSql);
    if (action === "load") {
      const result = await pool.query("SELECT payload FROM " + table + " WHERE state_key = $1", [stateKey]);
      const payload = result.rows[0]?.payload ?? JSON.parse(fs.readFileSync(emptyPath, "utf8"));
      fs.writeFileSync(resultPath, JSON.stringify(payload, null, 2), "utf8");
      return;
    }
    if (action === "save") {
      const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
      await pool.query(
        "INSERT INTO " + table + " (state_key, payload, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (state_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
        [stateKey, JSON.stringify(payload)],
      );
      return;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
`;
  try {
    fs2.writeFileSync(emptyPath, JSON.stringify(emptyDatabase(), null, 2), "utf-8");
    if (payload) {
      fs2.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf-8");
    }
    execFileSync(process.execPath, ["-e", helperSource], {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        DATABASE_URL: postgresConnectionString(),
        OPENCLAW_WEB_POSTGRES_TABLE: postgresStateTable(),
        OPENCLAW_STORE_ACTION: action,
        OPENCLAW_STORE_KEY: postgresStateKey,
        OPENCLAW_STORE_PAYLOAD_PATH: payloadPath,
        OPENCLAW_STORE_RESULT_PATH: resultPath,
        OPENCLAW_STORE_EMPTY_PATH: emptyPath
      },
      maxBuffer: 1024 * 1024 * 32,
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (action === "load") {
      return fs2.readFileSync(resultPath, "utf-8");
    }
    return "";
  } finally {
    fs2.rmSync(tempDir, { recursive: true, force: true });
  }
}
function ensurePostgresStorage() {
  if (!postgresEnabled() || postgresInitialized) {
    return;
  }
  runPostgresHelper("init");
  postgresInitialized = true;
}
function ensureWebPlatformStorage() {
  ensureDir(dataDir);
  ensureDir(storageDir);
  ensureDir(packagesDir);
  ensureDir(submissionsDir);
  ensurePostgresStorage();
  if (!fs2.existsSync(databasePath)) {
    writeLocalMirror(emptyDatabase());
  }
}
function loadDatabase() {
  if (cachedDatabase) {
    return cloneDatabase(cachedDatabase);
  }
  ensureWebPlatformStorage();
  const payload = postgresEnabled() ? JSON.parse(runPostgresHelper("load")) : JSON.parse(fs2.readFileSync(databasePath, "utf-8"));
  cachedDatabase = normalizeDatabase(payload);
  return cloneDatabase(cachedDatabase);
}
function saveDatabase(payload) {
  ensureWebPlatformStorage();
  const normalized = normalizeDatabase(payload);
  cachedDatabase = cloneDatabase(normalized);
  if (postgresEnabled()) {
    runPostgresHelper("save", normalized);
  }
  writeLocalMirror(normalized);
}
function packageArchivePath(packageId, version) {
  return path2.join(packagesDir, packageId.replaceAll("/", "__"), version, "package.zip");
}
function packageManifestPath(packageId, version) {
  return path2.join(packagesDir, packageId.replaceAll("/", "__"), version, "community-package.json");
}
function submissionArchivePath(submissionId) {
  return path2.join(submissionsDir, submissionId, "package.zip");
}
function submissionManifestPath(submissionId) {
  return path2.join(submissionsDir, submissionId, "community-package.json");
}
function writeSubmissionPackage(submissionId, archiveBuffer, manifest) {
  const archivePath = submissionArchivePath(submissionId);
  const manifestPath = submissionManifestPath(submissionId);
  ensureDir(path2.dirname(archivePath));
  fs2.writeFileSync(archivePath, archiveBuffer);
  fs2.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  return { archivePath, manifestPath };
}
function publishPackageArchive(packageId, version, archiveSourcePath, manifest) {
  const archivePath = packageArchivePath(packageId, version);
  const manifestPath = packageManifestPath(packageId, version);
  ensureDir(path2.dirname(archivePath));
  fs2.copyFileSync(archiveSourcePath, archivePath);
  fs2.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  return { archivePath, manifestPath };
}
function createId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

// src/server/security.ts
import crypto from "node:crypto";
var sessionSecret = process.env.OPENCLAW_WEB_SESSION_SECRET || "change-me";
var downloadSecret = process.env.OPENCLAW_WEB_DOWNLOAD_SECRET || "change-me-too";
function secureCookiesEnabled() {
  if (process.env.OPENCLAW_WEB_SECURE_COOKIE === "1") {
    return true;
  }
  if (process.env.OPENCLAW_WEB_SECURE_COOKIE === "0") {
    return false;
  }
  const baseUrl2 = process.env.OPENCLAW_WEB_BASE_URL || "";
  return baseUrl2.startsWith("https://");
}
var buckets = /* @__PURE__ */ new Map();
function generateToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}
function signDownloadToken(parts) {
  const payload = Object.entries(parts).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  return crypto.createHmac("sha256", downloadSecret).update(payload).digest("hex");
}
function verifyDownloadToken(parts, signature) {
  const expected = signDownloadToken(parts);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
function rateLimit(prefix, limit, windowMs) {
  return (req, res, next) => {
    const key = `${prefix}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (current.count >= limit) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    current.count += 1;
    next();
  };
}
function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1e3))
    };
  }
  current.count += 1;
  return {
    allowed: true,
    retryAfterSeconds: 0
  };
}
function setSessionCookie(res, sessionId) {
  res.cookie("oc_web_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    maxAge: 1e3 * 60 * 60 * 24 * 7
  });
}
function clearSessionCookie(res) {
  res.clearCookie("oc_web_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled()
  });
}
function sessionFromRequest(req) {
  const sessionId = typeof req.cookies?.oc_web_session === "string" ? req.cookies.oc_web_session : "";
  if (!sessionId) {
    return null;
  }
  const db = loadDatabase();
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return null;
  }
  if (Date.parse(session.expiresAt) < Date.now()) {
    db.sessions = db.sessions.filter((item) => item.id !== sessionId);
    saveDatabase(db);
    return null;
  }
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) {
    return null;
  }
  return { session, user };
}
function requireAuth(req, res, next) {
  const auth = sessionFromRequest(req);
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.auth = auth;
  next();
}
function requireRole(roles) {
  return (req, res, next) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(auth.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
function requireAdminTwoFactor(req, res, next) {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (auth.user.role === "super_admin" && !auth.session.twoFactorPassed) {
    res.status(403).json({ error: "Admin 2FA required" });
    return;
  }
  next();
}
function enforceCsrf(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const auth = req.auth;
  if (!auth) {
    next();
    return;
  }
  const token = req.header("x-openclaw-csrf") || "";
  if (token !== auth.session.csrfToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }
  next();
}

// src/server/github.ts
import fs3 from "node:fs";
import path3 from "node:path";
function githubConfig() {
  const db = loadDatabase();
  const saved = db.settings.github;
  return {
    githubClientId: process.env.GITHUB_CLIENT_ID || saved.clientId || "",
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || saved.clientSecret || "",
    githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || saved.callbackUrl || "http://127.0.0.1:3400/auth/github/callback",
    githubReleaseRepo: process.env.GITHUB_RELEASE_REPO || saved.releaseRepo || "",
    githubToken: process.env.GITHUB_TOKEN || saved.token || ""
  };
}
function githubOauthConfigured() {
  const config = githubConfig();
  return Boolean(config.githubClientId && config.githubClientSecret && config.githubCallbackUrl);
}
function createGithubOAuthState(input) {
  const db = loadDatabase();
  const state = {
    id: createId("ghstate"),
    mode: input.mode,
    userId: input.userId,
    redirectTo: input.redirectTo,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1e3).toISOString()
  };
  db.oauthStates.push(state);
  saveDatabase(db);
  return state;
}
function consumeGithubOAuthState(stateId) {
  const db = loadDatabase();
  const state = db.oauthStates.find((item) => item.id === stateId);
  if (!state) {
    return null;
  }
  db.oauthStates = db.oauthStates.filter((item) => item.id !== stateId);
  saveDatabase(db);
  if (Date.parse(state.expiresAt) < Date.now()) {
    return null;
  }
  return state;
}
function buildGithubAuthorizeUrl(stateId) {
  const config = githubConfig();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.githubClientId);
  url.searchParams.set("redirect_uri", config.githubCallbackUrl);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", stateId);
  return url.toString();
}
async function exchangeGithubCode(code) {
  const config = githubConfig();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: config.githubCallbackUrl
    })
  });
  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error(payload.error || "GitHub access token missing");
  }
  return payload.access_token;
}
async function fetchGithubIdentity(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "OpenClaw-Web-Platform"
  };
  const userResponse = await fetch("https://api.github.com/user", { headers });
  if (!userResponse.ok) {
    throw new Error(`GitHub user fetch failed: ${userResponse.status}`);
  }
  const user = await userResponse.json();
  let email = user.email || "";
  if (!email) {
    const emailResponse = await fetch("https://api.github.com/user/emails", { headers });
    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      email = emails.find((item) => item.primary)?.email || emails[0]?.email || "";
    }
  }
  if (!email) {
    throw new Error("GitHub account email is unavailable");
  }
  return {
    githubUserId: String(user.id),
    githubLogin: user.login,
    email
  };
}
function releaseRepoParts() {
  const { githubReleaseRepo } = githubConfig();
  const [owner, repo] = githubReleaseRepo.split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_RELEASE_REPO must be set as owner/repo");
  }
  return { owner, repo };
}
function githubHeaders() {
  const { githubToken } = githubConfig();
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required for GitHub release sync");
  }
  return {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "OpenClaw-Web-Platform"
  };
}
async function syncPackageToGithubRelease(options) {
  const { owner, repo } = releaseRepoParts();
  const tag = `${options.packageId.replaceAll("/", "__")}-v${options.version}`;
  const releaseName = `${options.manifest.name} v${options.version}`;
  const body = [
    options.manifest.description,
    "",
    `Package ID: ${options.packageId}`,
    `Visibility: ${options.official ? "official" : "community"}`
  ].join("\n");
  const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tag_name: tag,
      name: releaseName,
      body,
      draft: false,
      prerelease: false
    })
  });
  let releasePayload;
  if (createResponse.status === 422) {
    const existingResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
      headers: githubHeaders()
    });
    if (!existingResponse.ok) {
      throw new Error(`Failed to fetch existing GitHub release for ${tag}`);
    }
    releasePayload = await existingResponse.json();
  } else {
    if (!createResponse.ok) {
      throw new Error(`Failed to create GitHub release: ${createResponse.status}`);
    }
    releasePayload = await createResponse.json();
  }
  const archiveName = path3.basename(options.archivePath);
  const uploadUrl = String(releasePayload.upload_url).replace("{?name,label}", `?name=${encodeURIComponent(archiveName)}`);
  const archiveBuffer = fs3.readFileSync(options.archivePath);
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/zip",
      "Content-Length": String(archiveBuffer.length)
    },
    body: archiveBuffer
  });
  let assetPayload = null;
  if (uploadResponse.ok) {
    assetPayload = await uploadResponse.json();
  } else if (uploadResponse.status === 422) {
    assetPayload = (releasePayload.assets || []).find((item) => item.name === archiveName) || null;
  } else {
    throw new Error(`Failed to upload GitHub release asset: ${uploadResponse.status}`);
  }
  return {
    githubReleaseTag: tag,
    githubReleaseUrl: releasePayload.html_url,
    githubAssetUrl: assetPayload?.browser_download_url || "",
    githubSyncStatus: "synced",
    githubSyncAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/server/mailer.ts
import nodemailer from "nodemailer";
function smtpConfig() {
  const saved = loadDatabase().settings.smtp;
  const provider = saved.provider === "custom" ? "custom" : "qq";
  const host = process.env.SMTP_HOST || saved.host || (provider === "qq" ? "smtp.qq.com" : "");
  const port2 = Number(process.env.SMTP_PORT || saved.port || (provider === "qq" ? "465" : "587"));
  const user = process.env.SMTP_USER || saved.user || "";
  const pass = process.env.SMTP_PASS || saved.pass || "";
  const from = process.env.SMTP_FROM || saved.from || (user ? `SoloCore Hub <${user}>` : "");
  if (!host || !user || !pass || !from) {
    return null;
  }
  return {
    provider,
    host,
    port: port2,
    user,
    pass,
    from
  };
}
function smtpConfigured() {
  return Boolean(smtpConfig());
}
function createTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
}
async function sendTestEmail(email) {
  const config = smtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured");
  }
  const transport = createTransport(config);
  await transport.sendMail({
    from: config.from,
    to: email,
    subject: "SoloCore Hub SMTP test",
    text: "SoloCore Hub SMTP connectivity is working.",
    html: "<p>SoloCore Hub SMTP connectivity is working.</p>"
  });
  return {
    delivered: true,
    mode: "smtp"
  };
}
async function sendLoginCodeEmail(email, code) {
  const config = smtpConfig();
  if (!config) {
    return {
      delivered: false,
      mode: "console",
      debugCode: code
    };
  }
  const transport = createTransport(config);
  await transport.sendMail({
    from: config.from,
    to: email,
    subject: "SoloCore Hub login code",
    text: `Your SoloCore Hub login code is: ${code}`,
    html: `<p>Your SoloCore Hub login code is:</p><p><strong style="font-size: 22px;">${code}</strong></p>`
  });
  return {
    delivered: true,
    mode: "smtp"
  };
}

// src/server/consoleAccess.ts
import crypto2 from "node:crypto";
var grantAudience = "solocore-console";
function accessSecret() {
  return (process.env.SOLOCORE_CONSOLE_ACCESS_SECRET || process.env.OPENCLAW_CONSOLE_ACCESS_SECRET || "").trim();
}
function cloudConsolePublicBaseUrl() {
  return (process.env.SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL || process.env.OPENCLAW_CLOUD_CONSOLE_PUBLIC_URL || process.env.SOLOCORE_CLOUD_CONSOLE_URL || process.env.OPENCLAW_CLOUD_CONSOLE_URL || "").replace(/\/+$/, "");
}
function launchTtlMinutes() {
  const raw = Number(process.env.SOLOCORE_CONSOLE_LAUNCH_TTL_MINUTES || "5");
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}
function grantTtlHours() {
  const raw = Number(process.env.SOLOCORE_CONSOLE_GRANT_TTL_HOURS || "12");
  return Number.isFinite(raw) && raw > 0 ? raw : 12;
}
function base64UrlEncode(input) {
  return Buffer.from(input, "utf-8").toString("base64url");
}
function normalizeAccessCode(code) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
function hashAccessCode(code) {
  return crypto2.createHash("sha256").update(normalizeAccessCode(code)).digest("hex");
}
function signPayload(payload) {
  const secret = accessSecret();
  if (!secret) {
    throw new Error("SOLOCORE_CONSOLE_ACCESS_SECRET is not configured");
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto2.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function generateHumanCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = Array.from(
    { length: 4 },
    () => Array.from({ length: 4 }, () => alphabet[crypto2.randomInt(0, alphabet.length)]).join("")
  );
  return `SC-${segments.join("-")}`;
}
function cloudConsoleAccessEnabled() {
  return Boolean(accessSecret() && cloudConsolePublicBaseUrl());
}
function expireCloudConsoleRecords(db) {
  const now = Date.now();
  db.cloudConsoleAccessCodes = db.cloudConsoleAccessCodes.map((item) => {
    if (!item.revokedAt && Date.parse(item.expiresAt) <= now) {
      return {
        ...item,
        revokedAt: item.revokedAt || new Date(now).toISOString()
      };
    }
    return item;
  });
  db.cloudConsoleGrants = db.cloudConsoleGrants.map((item) => {
    if (item.status === "active" && Date.parse(item.expiresAt) <= now) {
      return {
        ...item,
        status: "expired"
      };
    }
    return item;
  });
}
function findActiveCloudConsoleGrant(db, userId) {
  expireCloudConsoleRecords(db);
  const now = Date.now();
  return db.cloudConsoleGrants.filter((item) => item.userId === userId && item.status === "active" && Date.parse(item.expiresAt) > now).sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0] || null;
}
function createCloudConsoleAccessCode(db, createdByUserId, input) {
  const plainCode = generateHumanCode();
  const now = /* @__PURE__ */ new Date();
  const expiresInHours = input.expiresInHours && input.expiresInHours > 0 ? input.expiresInHours : 72;
  const maxUses = input.maxUses && input.maxUses > 0 ? Math.floor(input.maxUses) : 1;
  const record = {
    id: createId("console_code"),
    label: input.label.trim() || "SoloCore Cloud Access",
    note: input.note?.trim() || void 0,
    codePreview: `${plainCode.slice(0, 7)}****${plainCode.slice(-4)}`,
    codeHash: hashAccessCode(plainCode),
    maxUses,
    usedCount: 0,
    createdByUserId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInHours * 60 * 60 * 1e3).toISOString()
  };
  db.cloudConsoleAccessCodes.push(record);
  return { record, plainCode };
}
function redeemCloudConsoleAccessCode(db, user, rawCode) {
  expireCloudConsoleRecords(db);
  const codeHash = hashAccessCode(rawCode);
  const now = /* @__PURE__ */ new Date();
  const code = db.cloudConsoleAccessCodes.find(
    (item) => item.codeHash === codeHash && !item.revokedAt && item.usedCount < item.maxUses && Date.parse(item.expiresAt) > now.getTime()
  );
  if (!code) {
    throw new Error("Authorization code is invalid or expired");
  }
  db.cloudConsoleGrants = db.cloudConsoleGrants.map(
    (item) => item.userId === user.id && item.status === "active" ? { ...item, status: "revoked", revokedAt: now.toISOString() } : item
  );
  code.usedCount += 1;
  code.lastRedeemedAt = now.toISOString();
  const grant = {
    id: createId("console_grant"),
    codeId: code.id,
    userId: user.id,
    userEmail: user.email,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + grantTtlHours() * 60 * 60 * 1e3).toISOString()
  };
  db.cloudConsoleGrants.push(grant);
  return { code, grant };
}
function issueCloudConsoleLaunchToken(grant, user) {
  if (grant.status !== "active" || Date.parse(grant.expiresAt) <= Date.now()) {
    throw new Error("Cloud console grant is not active");
  }
  const now = Math.floor(Date.now() / 1e3);
  const exp = now + launchTtlMinutes() * 60;
  return signPayload({
    aud: grantAudience,
    jti: createId("console_launch"),
    grantId: grant.id,
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp,
    sessionExp: Math.floor(Date.parse(grant.expiresAt) / 1e3)
  });
}
function buildCloudConsoleLaunchUrl(token) {
  const baseUrl2 = cloudConsolePublicBaseUrl();
  if (!baseUrl2) {
    throw new Error("SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL is not configured");
  }
  return `${baseUrl2}/auth/access?grant=${encodeURIComponent(token)}`;
}

// server.ts
dotenv.config();
ensureWebPlatformStorage();
var app = express();
var port = Number(process.env.PORT || 3400);
var baseUrl = process.env.OPENCLAW_WEB_BASE_URL || `http://127.0.0.1:${port}`;
var cloudOpenClawBaseUrl = (process.env.SOLOCORE_CLOUD_CONSOLE_URL || process.env.OPENCLAW_CLOUD_CONSOLE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
var cloudOpenClawPublicBaseUrl = cloudConsolePublicBaseUrl();
var cloudOpenClawWorkdir = process.env.SOLOCORE_CLOUD_CONSOLE_WORKDIR || process.env.OPENCLAW_CLOUD_CONSOLE_WORKDIR || "/opt/solocore/workspace/apps/mission-control";
var cloudOpenClawTopologyPath = process.env.SOLOCORE_CLOUD_TOPOLOGY_PATH || process.env.OPENCLAW_CLOUD_TOPOLOGY_PATH || "/etc/solocore/workspace-topology.json";
var cloudOpenClawInternalToken = (process.env.SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN || process.env.OPENCLAW_CLOUD_CONSOLE_INTERNAL_TOKEN || "").trim();
var forgeConsoleReleasesDir = path4.resolve(
  process.env.OPENCLAW_FORGE_CONSOLE_RELEASES_DIR || path4.join(process.cwd(), "../mission-control/releases")
);
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
function audit(action, targetType, targetId, actorUserId, metadata) {
  const db = loadDatabase();
  db.auditLogs.push({
    id: createId("audit"),
    actorUserId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  saveDatabase(db);
}
function authContext(req) {
  return sessionFromRequest(req);
}
function collectUserAuditLogs(db, userId) {
  return db.auditLogs.filter((item) => item.actorUserId === userId || item.targetType === "user" && item.targetId === userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
function buildAdminUserSummary(db, user) {
  const now = Date.now();
  const sessions = db.sessions.filter((item) => item.userId === user.id);
  const activeSessions = sessions.filter((item) => Date.parse(item.expiresAt) > now);
  const submissions = db.submissions.filter((item) => item.authorUserId === user.id);
  const reviews = db.reviewDecisions.filter((item) => item.reviewerUserId === user.id);
  const auditLogs = collectUserAuditLogs(db, user.id);
  const authLogs = auditLogs.filter((item) => item.action.startsWith("auth_") || item.action === "admin_2fa_verify");
  const activeCloudGrantCount = db.cloudConsoleGrants.filter(
    (item) => item.userId === user.id && item.status === "active" && Date.parse(item.expiresAt) > now
  ).length;
  const lastActivityAt = [
    ...activeSessions.map((item) => item.createdAt),
    ...submissions.map((item) => item.updatedAt),
    ...reviews.map((item) => item.createdAt),
    ...auditLogs.map((item) => item.createdAt)
  ].filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return {
    ...user,
    sessionCount: sessions.length,
    activeSessionCount: activeSessions.length,
    submissionCount: submissions.length,
    reviewCount: reviews.length,
    auditCount: auditLogs.length,
    activeCloudGrantCount,
    lastActivityAt,
    lastAuthAt: authLogs[0]?.createdAt,
    recentAudit: auditLogs.slice(0, 8)
  };
}
async function cloudOpenClawFetch(targetPath, init) {
  const nextHeaders = new Headers(init?.headers || {});
  if (cloudOpenClawInternalToken) {
    nextHeaders.set("x-solocore-internal-token", cloudOpenClawInternalToken);
  }
  const response = await fetch(`${cloudOpenClawBaseUrl}${targetPath}`, {
    ...init,
    headers: nextHeaders
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(
      typeof body === "string" ? body : typeof body === "object" && body && "error" in body ? String(body.error) : `Cloud OpenClaw request failed: ${response.status}`
    );
  }
  return body;
}
function runCloudConsoleRegistryInstall(packagePath) {
  const scriptPath = path4.join(cloudOpenClawWorkdir, "scripts", "local_package_registry.py");
  const result = spawnSync(
    "python3",
    [scriptPath, "install", "--package-path", packagePath],
    {
      cwd: cloudOpenClawWorkdir,
      env: {
        ...process.env,
        OPENCLAW_TOPOLOGY_PATH: cloudOpenClawTopologyPath
      },
      encoding: "utf-8",
      timeout: 12e4
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "Cloud package install failed");
  }
  return JSON.parse(result.stdout);
}
function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    primaryAuthProvider: user.primaryAuthProvider,
    linkedProviders: user.linkedProviders,
    githubUserId: user.githubUserId,
    githubLogin: user.githubLogin,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt
  };
}
function buildCloudConsoleAccessResponse(userId) {
  const db = loadDatabase();
  expireCloudConsoleRecords(db);
  saveDatabase(db);
  const activeGrant = findActiveCloudConsoleGrant(db, userId);
  return {
    accessEnabled: cloudConsoleAccessEnabled(),
    publicBaseUrl: cloudOpenClawPublicBaseUrl,
    activeGrant: activeGrant ? {
      id: activeGrant.id,
      codeId: activeGrant.codeId,
      expiresAt: activeGrant.expiresAt,
      lastLaunchedAt: activeGrant.lastLaunchedAt
    } : null
  };
}
function parseCommunityManifestFromBase64(name, contentBase64) {
  const buffer = Buffer.from(contentBase64, "base64");
  const tempDir = fs4.mkdtempSync(path4.join(os2.tmpdir(), "openclaw-upload-"));
  const tempPath = path4.join(tempDir, name || "upload.zip");
  try {
    fs4.writeFileSync(tempPath, buffer);
    const archive = new AdmZip(tempPath);
    const entry = archive.getEntries().find((item) => item.entryName.endsWith("/community-package.json") || item.entryName === "community-package.json");
    if (!entry) {
      throw new Error("community-package.json not found");
    }
    return JSON.parse(archive.readAsText(entry));
  } finally {
    fs4.rmSync(tempDir, { recursive: true, force: true });
  }
}
function latestForgeConsoleBundle() {
  if (!fs4.existsSync(forgeConsoleReleasesDir)) {
    return null;
  }
  const releaseDirs = fs4.readdirSync(forgeConsoleReleasesDir).map((entry) => path4.join(forgeConsoleReleasesDir, entry)).filter((entryPath) => fs4.existsSync(path4.join(entryPath, "release-manifest.json")));
  const manifestCandidates = releaseDirs.map((releasePath) => {
    const manifestPath = path4.join(releasePath, "release-manifest.json");
    try {
      const manifest = JSON.parse(fs4.readFileSync(manifestPath, "utf-8"));
      const archiveName = manifest.archiveFile || `${path4.basename(releasePath)}.zip`;
      const archivePath = path4.join(forgeConsoleReleasesDir, archiveName);
      if (!fs4.existsSync(archivePath)) {
        return null;
      }
      return {
        fileName: archiveName,
        fullPath: archivePath,
        updatedAt: manifest.builtAt || fs4.statSync(archivePath).mtime.toISOString(),
        version: manifest.version || "0.0.0",
        artifactType: manifest.artifactType || "local-runtime-bundle",
        launchers: manifest.launchers || {}
      };
    } catch {
      return null;
    }
  }).filter((item) => Boolean(item)).sort((a, b) => {
    const versionOrder = b.version.localeCompare(a.version, void 0, { numeric: true, sensitivity: "base" });
    if (versionOrder !== 0) {
      return versionOrder;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  if (manifestCandidates[0]) {
    return manifestCandidates[0];
  }
  const zipCandidates = fs4.readdirSync(forgeConsoleReleasesDir).filter((entry) => entry.endsWith(".zip")).map((entry) => {
    const fullPath = path4.join(forgeConsoleReleasesDir, entry);
    const stat = fs4.statSync(fullPath);
    return {
      fileName: entry,
      fullPath,
      updatedAt: stat.mtime.toISOString(),
      version: "0.0.0",
      artifactType: "legacy-dist-archive",
      launchers: {}
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return zipCandidates[0] || null;
}
app.get("/package/:id/download", (req, res) => {
  const auth = authContext(req);
  if (!auth) {
    res.redirect("/login");
    return;
  }
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.id && item.reviewStatus === "published");
  if (!record) {
    return res.status(404).send("Package not found");
  }
  const version = record.latestVersion;
  const expires = String(Date.now() + 10 * 60 * 1e3);
  const signature = signDownloadToken({ packageId: record.packageId, version, expires });
  const url = `${baseUrl}/downloads/file?packageId=${encodeURIComponent(record.packageId)}&version=${encodeURIComponent(version)}&expires=${expires}&sig=${signature}`;
  res.redirect(url);
});
app.get("/auth/github/start", (req, res) => {
  if (!githubOauthConfigured()) {
    return res.status(503).json({ error: "GitHub OAuth is not configured" });
  }
  const redirectTo = typeof req.query.redirectTo === "string" ? req.query.redirectTo : "/me";
  const state = createGithubOAuthState({ mode: "login", redirectTo });
  res.redirect(buildGithubAuthorizeUrl(state.id));
});
app.get("/auth/github/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateId = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !stateId) {
      return res.status(400).send("Missing GitHub callback parameters");
    }
    const state = consumeGithubOAuthState(stateId);
    if (!state) {
      return res.status(400).send("GitHub auth state is invalid or expired");
    }
    const accessToken = await exchangeGithubCode(code);
    const identity = await fetchGithubIdentity(accessToken);
    const db = loadDatabase();
    let user = state.mode === "link" && state.userId ? db.users.find((item) => item.id === state.userId) : db.users.find((item) => item.githubUserId === identity.githubUserId);
    if (!user && state.mode !== "link") {
      user = db.users.find((item) => item.email === identity.email);
    }
    if (!user) {
      user = {
        id: createId("user"),
        email: identity.email,
        role: "user",
        primaryAuthProvider: "github",
        linkedProviders: ["github"],
        githubUserId: identity.githubUserId,
        githubLogin: identity.githubLogin,
        twoFactorEnabled: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.users.push(user);
    } else {
      user.githubUserId = identity.githubUserId;
      user.githubLogin = identity.githubLogin;
      user.primaryAuthProvider = user.primaryAuthProvider || "github";
      user.linkedProviders = Array.from(/* @__PURE__ */ new Set([...user.linkedProviders || [], "github"]));
    }
    const session = {
      id: generateToken(24),
      userId: user.id,
      csrfToken: generateToken(16),
      twoFactorPassed: user.role !== "super_admin",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString()
    };
    db.sessions = db.sessions.filter((item) => item.userId !== user.id);
    db.sessions.push(session);
    saveDatabase(db);
    setSessionCookie(res, session.id);
    audit("auth_github_callback", "user", user.id, user.id, {
      githubLogin: identity.githubLogin,
      githubUserId: identity.githubUserId
    });
    res.redirect(user.role === "super_admin" ? "/admin/2fa" : state.redirectTo || "/me");
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "GitHub OAuth failed");
  }
});
app.post("/auth/provider/link/github", requireAuth, enforceCsrf, (req, res) => {
  if (!githubOauthConfigured()) {
    return res.status(503).json({ error: "GitHub OAuth is not configured" });
  }
  const auth = req.auth;
  const state = createGithubOAuthState({
    mode: "link",
    userId: auth.user.id,
    redirectTo: "/me"
  });
  return res.json({
    success: true,
    authorizeUrl: buildGithubAuthorizeUrl(state.id)
  });
});
app.get("/auth/session", (req, res) => {
  const auth = authContext(req);
  if (!auth) {
    return res.json({
      authenticated: false,
      user: null,
      csrfToken: null,
      twoFactorPassed: false,
      requiresAdminTwoFactor: false,
      githubOauthConfigured: githubOauthConfigured()
    });
  }
  return res.json({
    authenticated: true,
    user: safeUser(auth.user),
    csrfToken: auth.session.csrfToken,
    twoFactorPassed: auth.session.twoFactorPassed,
    requiresAdminTwoFactor: auth.user.role === "super_admin" && !auth.session.twoFactorPassed,
    githubOauthConfigured: githubOauthConfigured()
  });
});
app.get("/cloud-console/access", requireAuth, (req, res) => {
  const auth = req.auth;
  return res.json(buildCloudConsoleAccessResponse(auth.user.id));
});
app.post("/cloud-console/access/redeem", requireAuth, enforceCsrf, rateLimit("cloud-console-redeem", 12, 15 * 60 * 1e3), (req, res) => {
  const auth = req.auth;
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!cloudConsoleAccessEnabled()) {
    return res.status(503).json({ error: "Cloud console access is not configured" });
  }
  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }
  try {
    const db = loadDatabase();
    const { grant, code: accessCode } = redeemCloudConsoleAccessCode(db, auth.user, code);
    const launchToken = issueCloudConsoleLaunchToken(grant, auth.user);
    grant.lastLaunchedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDatabase(db);
    audit("cloud_console_access_redeem", "cloud_console_code", accessCode.id, auth.user.id, {
      grantId: grant.id
    });
    return res.json({
      success: true,
      access: buildCloudConsoleAccessResponse(auth.user.id),
      launchUrl: buildCloudConsoleLaunchUrl(launchToken)
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to redeem authorization code"
    });
  }
});
app.post("/cloud-console/access/launch", requireAuth, enforceCsrf, rateLimit("cloud-console-launch", 60, 15 * 60 * 1e3), (req, res) => {
  const auth = req.auth;
  if (!cloudConsoleAccessEnabled()) {
    return res.status(503).json({ error: "Cloud console access is not configured" });
  }
  const db = loadDatabase();
  expireCloudConsoleRecords(db);
  const grant = findActiveCloudConsoleGrant(db, auth.user.id);
  if (!grant) {
    saveDatabase(db);
    return res.status(403).json({ error: "No active cloud console grant" });
  }
  const launchToken = issueCloudConsoleLaunchToken(grant, auth.user);
  grant.lastLaunchedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDatabase(db);
  audit("cloud_console_launch", "cloud_console_grant", grant.id, auth.user.id);
  return res.json({
    success: true,
    access: buildCloudConsoleAccessResponse(auth.user.id),
    launchUrl: buildCloudConsoleLaunchUrl(launchToken)
  });
});
app.get("/downloads/forge-console/meta", (_req, res) => {
  const bundle = latestForgeConsoleBundle();
  if (!bundle) {
    return res.json({
      available: false,
      fileName: "",
      updatedAt: "",
      downloadUrl: ""
    });
  }
  return res.json({
    available: true,
    fileName: bundle.fileName,
    updatedAt: bundle.updatedAt,
    version: bundle.version,
    artifactType: bundle.artifactType,
    launchers: bundle.launchers,
    downloadUrl: "/downloads/forge-console/latest"
  });
});
app.post("/submissions/validate", requireAuth, enforceCsrf, rateLimit("submissions-validate", 30, 60 * 60 * 1e3), (req, res) => {
  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const packageBase64 = typeof req.body?.packageBase64 === "string" ? req.body.packageBase64 : "";
  if (!fileName || !packageBase64) {
    return res.status(400).json({ error: "fileName and packageBase64 are required" });
  }
  try {
    const manifest = parseCommunityManifestFromBase64(fileName, packageBase64);
    return res.json({
      success: true,
      manifest: {
        packageId: manifest.packageId,
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        description: manifest.description,
        capabilities: manifest.capabilities.length,
        dependencies: manifest.dependencies.length,
        permissions: manifest.permissions.length,
        docs: manifest.docs.length
      }
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to validate package"
    });
  }
});
app.get("/downloads/forge-console/latest", (_req, res) => {
  const bundle = latestForgeConsoleBundle();
  if (!bundle) {
    return res.status(404).json({
      error: "SoloCore Console release bundle is not available yet"
    });
  }
  return res.download(bundle.fullPath, bundle.fileName);
});
app.post("/auth/email/request", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }
  const db = loadDatabase();
  const settings = db.settings.authEmail;
  const nowMs = Date.now();
  db.authChallenges = db.authChallenges.filter((item) => Date.parse(item.expiresAt) > nowMs);
  const cooldownMs = settings.resendCooldownSeconds * 1e3;
  const lastChallenge = db.authChallenges.filter((item) => item.email === email).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  if (lastChallenge && Date.parse(lastChallenge.createdAt) + cooldownMs > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(lastChallenge.createdAt) + cooldownMs - nowMs) / 1e3));
    return res.status(429).json({
      error: `Please wait ${retryAfterSeconds}s before requesting another code for this email`,
      retryAfterSeconds
    });
  }
  const requestLimitDecision = checkRateLimit(
    `auth-email-request:${email}`,
    settings.requestLimitPerWindow,
    settings.requestWindowMinutes * 60 * 1e3
  );
  if (!requestLimitDecision.allowed) {
    return res.status(429).json({
      error: "Too many code requests for this email",
      retryAfterSeconds: requestLimitDecision.retryAfterSeconds
    });
  }
  const reusableChallenge = lastChallenge && Date.parse(lastChallenge.expiresAt) > nowMs ? lastChallenge : null;
  const code = reusableChallenge?.code || `${randomInt(1e5, 999999)}`;
  if (!reusableChallenge) {
    db.authChallenges = db.authChallenges.filter((item) => item.email !== email);
    db.authChallenges.push({
      id: createId("challenge"),
      email,
      code,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: new Date(Date.now() + settings.codeTtlMinutes * 60 * 1e3).toISOString()
    });
  }
  saveDatabase(db);
  const delivery = await sendLoginCodeEmail(email, code);
  const payload = {
    success: true,
    delivery: delivery.mode
  };
  if (process.env.NODE_ENV !== "production" || !delivery.delivered) {
    payload.debugCode = code;
  }
  audit("auth_email_request", "user", email, null);
  return res.json(payload);
});
app.post("/auth/email/verify", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }
  const db = loadDatabase();
  const settings = db.settings.authEmail;
  const verifyLimitDecision = checkRateLimit(
    `auth-email-verify:${email}:${req.ip ?? "unknown"}`,
    settings.verifyLimitPerWindow,
    settings.verifyWindowMinutes * 60 * 1e3
  );
  if (!verifyLimitDecision.allowed) {
    return res.status(429).json({
      error: "Too many verification attempts",
      retryAfterSeconds: verifyLimitDecision.retryAfterSeconds
    });
  }
  const challenge = db.authChallenges.find((item) => item.email === email && item.code === code);
  if (!challenge || Date.parse(challenge.expiresAt) < Date.now()) {
    return res.status(401).json({ error: "Invalid or expired code" });
  }
  let user = db.users.find((item) => item.email === email);
  if (!user) {
    user = {
      id: createId("user"),
      email,
      role: "user",
      twoFactorEnabled: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.users.push(user);
  }
  const session = {
    id: generateToken(24),
    userId: user.id,
    csrfToken: generateToken(16),
    twoFactorPassed: user.role !== "super_admin",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString()
  };
  db.sessions = db.sessions.filter((item) => item.userId !== user.id);
  db.sessions.push(session);
  db.authChallenges = db.authChallenges.filter((item) => item.id !== challenge.id);
  saveDatabase(db);
  setSessionCookie(res, session.id);
  audit("auth_email_verify", "user", user.id, user.id);
  return res.json({
    success: true,
    user: safeUser(user),
    csrfToken: session.csrfToken,
    requiresAdminTwoFactor: user.role === "super_admin"
  });
});
app.post("/auth/admin/2fa/verify", requireAuth, enforceCsrf, rateLimit("auth-admin-2fa", 12, 15 * 60 * 1e3), (req, res) => {
  const auth = req.auth;
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (auth.user.role !== "super_admin") {
    return res.status(403).json({ error: "Not a super admin" });
  }
  if (!auth.user.twoFactorSecret || !code || !authenticator.check(code, auth.user.twoFactorSecret)) {
    return res.status(401).json({ error: "Invalid 2FA code" });
  }
  const db = loadDatabase();
  const session = db.sessions.find((item) => item.id === auth.session.id);
  if (!session) {
    return res.status(401).json({ error: "Session not found" });
  }
  session.twoFactorPassed = true;
  saveDatabase(db);
  audit("admin_2fa_verify", "session", session.id, auth.user.id);
  return res.json({ success: true });
});
app.get("/auth/admin/2fa/setup", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const auth = req.auth;
  if (!auth.user.twoFactorSecret) {
    return res.status(404).json({ error: "Admin 2FA is not configured yet" });
  }
  return res.json({
    secret: auth.user.twoFactorSecret,
    otpauth: authenticator.keyuri(auth.user.email, "SoloCore Hub", auth.user.twoFactorSecret),
    issuer: "SoloCore Hub",
    email: auth.user.email
  });
});
app.get("/packages", (_req, res) => {
  const db = loadDatabase();
  res.json({
    packages: db.packages.filter((item) => item.reviewStatus === "published")
  });
});
app.get("/packages/:id", (req, res) => {
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.id);
  if (!record) {
    return res.status(404).json({ error: "Package not found" });
  }
  return res.json(record);
});
app.get("/packages/:id/source", (req, res) => {
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.id);
  if (!record) {
    return res.status(404).json({ error: "Package not found" });
  }
  return res.json({
    packageId: record.packageId,
    latestVersion: record.latestVersion,
    githubReleaseTag: record.githubReleaseTag || "",
    githubReleaseUrl: record.githubReleaseUrl || "",
    githubAssetUrl: record.githubAssetUrl || "",
    githubSyncStatus: record.githubSyncStatus || "",
    githubSyncAt: record.githubSyncAt || ""
  });
});
app.post("/submissions", requireAuth, enforceCsrf, rateLimit("submissions", 20, 60 * 60 * 1e3), (req, res) => {
  const auth = req.auth;
  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const packageBase64 = typeof req.body?.packageBase64 === "string" ? req.body.packageBase64 : "";
  if (!fileName || !packageBase64) {
    return res.status(400).json({ error: "fileName and packageBase64 are required" });
  }
  let manifest;
  try {
    manifest = parseCommunityManifestFromBase64(fileName, packageBase64);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to parse package manifest" });
  }
  const db = loadDatabase();
  const submissionId = createId("submission");
  const written = writeSubmissionPackage(submissionId, Buffer.from(packageBase64, "base64"), manifest);
  db.submissions.push({
    id: submissionId,
    packageId: manifest.packageId,
    authorUserId: auth.user.id,
    status: "submitted",
    packageVersion: manifest.version,
    archivePath: written.archivePath,
    manifestPath: written.manifestPath,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  saveDatabase(db);
  audit("submission_created", "submission", submissionId, auth.user.id, {
    packageId: manifest.packageId,
    version: manifest.version
  });
  return res.json({ success: true, submissionId, packageId: manifest.packageId });
});
app.get("/me/submissions", requireAuth, (req, res) => {
  const auth = req.auth;
  const db = loadDatabase();
  return res.json({
    submissions: db.submissions.filter((item) => item.authorUserId === auth.user.id)
  });
});
app.get("/review/queue", requireAuth, requireRole(["reviewer", "super_admin"]), requireAdminTwoFactor, (req, res) => {
  const db = loadDatabase();
  res.json({
    submissions: db.submissions.filter((item) => ["submitted", "under_review"].includes(item.status))
  });
});
function reviewAction(req, res, action) {
  const auth = req.auth;
  const db = loadDatabase();
  const submission = db.submissions.find((item) => item.id === req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ error: "Submission not found" });
  }
  submission.status = action === "approve" ? "published" : action === "request_changes" ? "changes_requested" : "rejected";
  submission.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const manifest = JSON.parse(fs4.readFileSync(submission.manifestPath, "utf-8"));
  if (action === "approve") {
    const publishedManifest = {
      ...manifest,
      reviewStatus: "published",
      visibility: manifest.visibility === "private" ? "community" : manifest.visibility
    };
    const stored = publishPackageArchive(manifest.packageId, manifest.version, submission.archivePath, {
      ...publishedManifest
    });
    const existing = db.packages.find((item) => item.packageId === manifest.packageId);
    const versionRecord = {
      version: manifest.version,
      archivePath: stored.archivePath,
      manifestPath: stored.manifestPath,
      manifest: publishedManifest,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (existing) {
      existing.latestVersion = manifest.version;
      existing.reviewStatus = "published";
      existing.visibility = versionRecord.manifest.visibility;
      existing.versions = existing.versions.filter((item) => item.version !== manifest.version);
      existing.versions.push(versionRecord);
    } else {
      db.packages.push({
        packageId: manifest.packageId,
        name: manifest.name,
        type: manifest.type,
        latestVersion: manifest.version,
        visibility: versionRecord.manifest.visibility,
        reviewStatus: "published",
        versions: [versionRecord]
      });
    }
  }
  db.reviewDecisions.push({
    submissionId: submission.id,
    reviewerUserId: auth.user.id,
    action: action === "request_changes" ? "request_changes" : action,
    note: typeof req.body?.note === "string" ? req.body.note : void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  saveDatabase(db);
  audit(`review_${action}`, "submission", submission.id, auth.user.id);
  return res.json({ success: true, status: submission.status });
}
app.post("/review/:submissionId/approve", requireAuth, enforceCsrf, requireRole(["reviewer", "super_admin"]), requireAdminTwoFactor, (req, res) => reviewAction(req, res, "approve"));
app.post("/review/:submissionId/request-changes", requireAuth, enforceCsrf, requireRole(["reviewer", "super_admin"]), requireAdminTwoFactor, (req, res) => reviewAction(req, res, "request_changes"));
app.post("/review/:submissionId/reject", requireAuth, enforceCsrf, requireRole(["reviewer", "super_admin"]), requireAdminTwoFactor, (req, res) => reviewAction(req, res, "reject"));
app.post("/publish/:submissionId/github-release", requireAuth, enforceCsrf, requireRole(["reviewer", "super_admin"]), requireAdminTwoFactor, async (req, res) => {
  try {
    const auth = req.auth;
    const db = loadDatabase();
    const submission = db.submissions.find((item) => item.id === req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }
    const manifest = JSON.parse(fs4.readFileSync(submission.manifestPath, "utf-8"));
    const sync = await syncPackageToGithubRelease({
      packageId: manifest.packageId,
      version: manifest.version,
      archivePath: submission.archivePath,
      manifest,
      official: manifest.visibility === "official"
    });
    submission.githubReleaseTag = sync.githubReleaseTag;
    submission.githubReleaseUrl = sync.githubReleaseUrl;
    submission.githubAssetUrl = sync.githubAssetUrl;
    submission.githubSyncStatus = sync.githubSyncStatus;
    submission.githubSyncAt = sync.githubSyncAt;
    const record = db.packages.find((item) => item.packageId === manifest.packageId);
    if (record) {
      record.githubReleaseTag = sync.githubReleaseTag;
      record.githubReleaseUrl = sync.githubReleaseUrl;
      record.githubAssetUrl = sync.githubAssetUrl;
      record.githubSyncStatus = sync.githubSyncStatus;
      record.githubSyncAt = sync.githubSyncAt;
      const versionRecord = record.versions.find((item) => item.version === manifest.version);
      if (versionRecord) {
        versionRecord.githubReleaseTag = sync.githubReleaseTag;
        versionRecord.githubReleaseUrl = sync.githubReleaseUrl;
        versionRecord.githubAssetUrl = sync.githubAssetUrl;
        versionRecord.githubSyncStatus = sync.githubSyncStatus;
        versionRecord.githubSyncAt = sync.githubSyncAt;
      }
    }
    saveDatabase(db);
    audit("publish_github_release", "submission", submission.id, auth.user.id, sync);
    return res.json({ success: true, ...sync });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to sync GitHub release"
    });
  }
});
app.get("/downloads/file", (req, res) => {
  const packageId = typeof req.query.packageId === "string" ? req.query.packageId : "";
  const version = typeof req.query.version === "string" ? req.query.version : "";
  const expires = typeof req.query.expires === "string" ? req.query.expires : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  if (!packageId || !version || !expires || !sig) {
    return res.status(400).send("Missing download signature");
  }
  if (Number(expires) < Date.now()) {
    return res.status(403).send("Download link expired");
  }
  if (!verifyDownloadToken({ packageId, version, expires }, sig)) {
    return res.status(403).send("Invalid download signature");
  }
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === packageId);
  const versionRecord = record?.versions.find((item) => item.version === version);
  if (!versionRecord || !fs4.existsSync(versionRecord.archivePath)) {
    return res.status(404).send("Package archive not found");
  }
  audit("download_package", "package", packageId, null, { version });
  return res.download(versionRecord.archivePath, `${packageId.replaceAll("/", "__")}-${version}.zip`);
});
app.get("/downloads/:packageId", requireAuth, (req, res) => {
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.packageId && item.reviewStatus === "published");
  if (!record) {
    return res.status(404).json({ error: "Package not found" });
  }
  const version = record.latestVersion;
  const expires = String(Date.now() + 10 * 60 * 1e3);
  const signature = signDownloadToken({ packageId: record.packageId, version, expires });
  const url = `${baseUrl}/downloads/file?packageId=${encodeURIComponent(record.packageId)}&version=${encodeURIComponent(version)}&expires=${expires}&sig=${signature}`;
  return res.json({ success: true, signedUrl: url, expiresAt: new Date(Number(expires)).toISOString() });
});
app.get("/admin/audit-logs", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  res.json({ auditLogs: db.auditLogs });
});
app.get("/admin/security-events", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  res.json({ securityEvents: db.securityEvents });
});
app.get("/admin/users", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  const roleWeight = {
    super_admin: 0,
    reviewer: 1,
    user: 2,
    guest: 3
  };
  const users = [...db.users].map((user) => buildAdminUserSummary(db, safeUser(user))).sort((a, b) => {
    const byRole = (roleWeight[a.role] ?? 99) - (roleWeight[b.role] ?? 99);
    if (byRole !== 0) {
      return byRole;
    }
    return Date.parse(b.lastActivityAt || b.createdAt) - Date.parse(a.lastActivityAt || a.createdAt);
  });
  res.json({ users });
});
app.post("/admin/users/:userId/role", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = req.auth;
  const nextRole = typeof req.body?.role === "string" ? req.body.role.trim() : "";
  if (!["user", "reviewer", "super_admin"].includes(nextRole)) {
    return res.status(400).json({ error: "role must be user, reviewer, or super_admin" });
  }
  const db = loadDatabase();
  const targetUser = db.users.find((item) => item.id === req.params.userId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }
  if (targetUser.id === auth.user.id) {
    return res.status(400).json({ error: "Use another super admin to change your own role" });
  }
  if (targetUser.role === nextRole) {
    return res.json({ success: true, user: buildAdminUserSummary(db, safeUser(targetUser)) });
  }
  const superAdminCount = db.users.filter((item) => item.role === "super_admin").length;
  if (targetUser.role === "super_admin" && nextRole !== "super_admin" && superAdminCount <= 1) {
    return res.status(400).json({ error: "At least one super admin must remain" });
  }
  const previousRole = targetUser.role;
  targetUser.role = nextRole;
  saveDatabase(db);
  audit("user_role_update", "user", targetUser.id, auth.user.id, {
    fromRole: previousRole,
    toRole: nextRole
  });
  return res.json({ success: true, user: buildAdminUserSummary(loadDatabase(), safeUser(targetUser)) });
});
app.post("/admin/users/:userId/revoke-sessions", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = req.auth;
  const db = loadDatabase();
  const targetUser = db.users.find((item) => item.id === req.params.userId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }
  if (targetUser.id === auth.user.id) {
    return res.status(400).json({ error: "Use sign out if you want to close your own current session" });
  }
  const revokedCount = db.sessions.filter((item) => item.userId === targetUser.id).length;
  db.sessions = db.sessions.filter((item) => item.userId !== targetUser.id);
  saveDatabase(db);
  audit("user_sessions_revoked", "user", targetUser.id, auth.user.id, { revokedCount });
  return res.json({ success: true, revokedCount, user: buildAdminUserSummary(loadDatabase(), safeUser(targetUser)) });
});
app.get("/admin/platform-summary", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  const bundle = latestForgeConsoleBundle();
  res.json({
    baseUrl,
    githubOauthConfigured: githubOauthConfigured(),
    smtpConfigured: smtpConfigured(),
    storage: {
      dataDir: process.env.OPENCLAW_WEB_DATA_DIR || "",
      releaseBundle: bundle?.fullPath || "",
      releaseBundleUpdatedAt: bundle?.updatedAt || ""
    },
    counts: {
      users: db.users.length,
      sessions: db.sessions.length,
      submissions: db.submissions.length,
      packages: db.packages.length,
      auditLogs: db.auditLogs.length,
      securityEvents: db.securityEvents.length
    }
  });
});
app.get("/admin/cloud-console/access-codes", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  expireCloudConsoleRecords(db);
  saveDatabase(db);
  return res.json({
    accessEnabled: cloudConsoleAccessEnabled(),
    publicBaseUrl: cloudOpenClawPublicBaseUrl,
    codes: [...db.cloudConsoleAccessCodes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    grants: [...db.cloudConsoleGrants].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  });
});
app.post("/admin/cloud-console/access-codes", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = req.auth;
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  const expiresInHours = Number(req.body?.expiresInHours || 72);
  const maxUses = Number(req.body?.maxUses || 1);
  if (!label) {
    return res.status(400).json({ error: "label is required" });
  }
  const db = loadDatabase();
  const { record, plainCode } = createCloudConsoleAccessCode(db, auth.user.id, {
    label,
    note,
    expiresInHours,
    maxUses
  });
  saveDatabase(db);
  audit("cloud_console_code_create", "cloud_console_code", record.id, auth.user.id, {
    label: record.label,
    maxUses: record.maxUses,
    expiresAt: record.expiresAt
  });
  return res.json({
    success: true,
    code: record,
    plainCode
  });
});
app.post("/admin/cloud-console/access-codes/:codeId/revoke", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = req.auth;
  const db = loadDatabase();
  const code = db.cloudConsoleAccessCodes.find((item) => item.id === req.params.codeId);
  if (!code) {
    return res.status(404).json({ error: "Authorization code not found" });
  }
  code.revokedAt = code.revokedAt || (/* @__PURE__ */ new Date()).toISOString();
  db.cloudConsoleGrants = db.cloudConsoleGrants.map(
    (item) => item.codeId === code.id && item.status === "active" ? { ...item, status: "revoked", revokedAt: (/* @__PURE__ */ new Date()).toISOString() } : item
  );
  saveDatabase(db);
  audit("cloud_console_code_revoke", "cloud_console_code", code.id, auth.user.id);
  return res.json({ success: true });
});
app.get("/admin/cloud-openclaw/summary", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, async (_req, res) => {
  const summary = {
    consoleBaseUrl: cloudOpenClawBaseUrl,
    reachable: false,
    errors: []
  };
  const errors = [];
  try {
    summary.health = await cloudOpenClawFetch("/api/health");
    summary.reachable = true;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to reach cloud OpenClaw health");
  }
  try {
    summary.controlPlane = await cloudOpenClawFetch("/api/v1/control-plane/state");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to read cloud control-plane state");
  }
  try {
    const localPackages = await cloudOpenClawFetch("/api/v1/local-packages");
    summary.localPackages = Array.isArray(localPackages.packages) ? localPackages.packages : [];
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to read cloud package registry");
  }
  summary.errors = errors;
  return res.json(summary);
});
app.get("/admin/cloud-openclaw/skill-tree", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, async (_req, res) => {
  try {
    const payload = await cloudOpenClawFetch("/api/v1/skill-tree");
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load cloud OpenClaw skill tree"
    });
  }
});
app.post("/admin/cloud-openclaw/execute", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, async (req, res) => {
  const nodeId = typeof req.body?.nodeId === "string" ? req.body.nodeId.trim() : "";
  const command = typeof req.body?.command === "string" ? req.body.command.trim() : "";
  const inputValues = req.body?.inputValues && typeof req.body.inputValues === "object" ? req.body.inputValues : {};
  if (!nodeId || !command) {
    return res.status(400).json({ error: "nodeId and command are required" });
  }
  try {
    const payload = await cloudOpenClawFetch("/api/v1/node-execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nodeId,
        command,
        inputValues
      })
    });
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to queue cloud OpenClaw execution"
    });
  }
});
app.post("/admin/cloud-openclaw/packages/install-official", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, async (req, res) => {
  const packageId = typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";
  const version = typeof req.body?.version === "string" ? req.body.version.trim() : "";
  if (!packageId) {
    return res.status(400).json({ error: "packageId is required" });
  }
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === packageId);
  if (!record) {
    return res.status(404).json({ error: "Package not found" });
  }
  const selectedVersion = version || record.latestVersion;
  const versionRecord = record.versions.find((item) => item.version === selectedVersion);
  if (!versionRecord) {
    return res.status(404).json({ error: "Package version not found" });
  }
  if (!fs4.existsSync(versionRecord.archivePath)) {
    return res.status(404).json({ error: "Package archive is missing on server" });
  }
  try {
    const payload = runCloudConsoleRegistryInstall(versionRecord.archivePath);
    audit("install_cloud_package", "package", packageId, req.auth?.user.id || null, {
      version: selectedVersion,
      installPath: payload.installPath || ""
    });
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to install package into cloud OpenClaw"
    });
  }
});
app.get("/admin/settings/github", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  return res.json(db.settings.github);
});
app.post("/admin/settings/github", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const db = loadDatabase();
  db.settings.github = {
    clientId: typeof req.body?.clientId === "string" ? req.body.clientId.trim() : "",
    clientSecret: typeof req.body?.clientSecret === "string" ? req.body.clientSecret.trim() : "",
    callbackUrl: typeof req.body?.callbackUrl === "string" ? req.body.callbackUrl.trim() : "",
    releaseRepo: typeof req.body?.releaseRepo === "string" ? req.body.releaseRepo.trim() : "",
    token: typeof req.body?.token === "string" ? req.body.token.trim() : ""
  };
  saveDatabase(db);
  return res.json({
    success: true,
    githubOauthConfigured: githubOauthConfigured()
  });
});
app.get("/admin/settings/smtp", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  return res.json(db.settings.smtp);
});
app.post("/admin/settings/smtp", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const db = loadDatabase();
  const provider = typeof req.body?.provider === "string" && req.body.provider === "custom" ? "custom" : "qq";
  db.settings.smtp = {
    provider,
    host: typeof req.body?.host === "string" ? req.body.host.trim() : "",
    port: typeof req.body?.port === "string" ? req.body.port.trim() : provider === "qq" ? "465" : "587",
    user: typeof req.body?.user === "string" ? req.body.user.trim() : "",
    pass: typeof req.body?.pass === "string" ? req.body.pass.trim() : "",
    from: typeof req.body?.from === "string" ? req.body.from.trim() : ""
  };
  saveDatabase(db);
  return res.json({
    success: true,
    smtpConfigured: smtpConfigured()
  });
});
app.post("/admin/settings/smtp/test", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, async (req, res) => {
  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  if (!to) {
    return res.status(400).json({ error: "Recipient email is required" });
  }
  try {
    const delivery = await sendTestEmail(to);
    return res.json({
      success: true,
      delivered: delivery.delivered
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send SMTP test email"
    });
  }
});
app.get("/admin/settings/auth-email", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  return res.json(db.settings.authEmail);
});
app.post("/admin/settings/auth-email", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const db = loadDatabase();
  db.settings.authEmail = {
    codeTtlMinutes: Math.max(1, Number(req.body?.codeTtlMinutes || 10)),
    resendCooldownSeconds: Math.max(0, Number(req.body?.resendCooldownSeconds || 30)),
    requestLimitPerWindow: Math.max(1, Number(req.body?.requestLimitPerWindow || 8)),
    requestWindowMinutes: Math.max(1, Number(req.body?.requestWindowMinutes || 15)),
    verifyLimitPerWindow: Math.max(1, Number(req.body?.verifyLimitPerWindow || 10)),
    verifyWindowMinutes: Math.max(1, Number(req.body?.verifyWindowMinutes || 15))
  };
  saveDatabase(db);
  return res.json({
    success: true,
    settings: db.settings.authEmail
  });
});
app.post("/auth/logout", requireAuth, enforceCsrf, (req, res) => {
  const auth = req.auth;
  const db = loadDatabase();
  db.sessions = db.sessions.filter((item) => item.id !== auth.session.id);
  saveDatabase(db);
  clearSessionCookie(res);
  res.json({ success: true });
});
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "forge-hub"
  });
});
async function attachFrontend() {
  const isProd = process.env.NODE_ENV === "production";
  const appRoot = process.cwd();
  if (isProd) {
    const distPath = path4.resolve(appRoot, "dist");
    app.use(express.static(distPath, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      res.sendFile(path4.join(distPath, "index.html"));
    });
    return;
  }
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: appRoot,
    server: {
      middlewareMode: true
    },
    appType: "spa"
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    try {
      const templatePath = path4.resolve(appRoot, "index.html");
      const template = fs4.readFileSync(templatePath, "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });
}
void attachFrontend().then(() => {
  app.listen(port, () => {
    console.log(`SoloCore Hub running on ${baseUrl}`);
  });
});
