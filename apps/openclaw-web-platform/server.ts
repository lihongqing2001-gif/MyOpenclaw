import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { authenticator } from "otplib";
import AdmZip from "adm-zip";
import multer from "multer";
import {
  createId,
  ensureWebPlatformStorage,
  loadDatabase,
  publishPackageArchive,
  saveDatabase,
  submissionManifestPath,
  writeSubmissionPackage,
} from "./src/server/store";
import {
  clearSessionCookie,
  enforceCsrf,
  generateToken,
  rateLimit,
  requireAdminTwoFactor,
  requireAuth,
  requireRole,
  sessionFromRequest,
  setSessionCookie,
  signDownloadToken,
  verifyDownloadToken,
} from "./src/server/security";
import { CommunityPackageManifest } from "./src/contracts/community-package";
import {
  buildGithubAuthorizeUrl,
  consumeGithubOAuthState,
  createGithubOAuthState,
  exchangeGithubCode,
  fetchGithubIdentity,
  githubOauthConfigured,
  syncPackageToGithubRelease,
} from "./src/server/github";
import {
  renderAdminPage,
  renderAdminTwoFactorPage,
  renderHome,
  renderLoginPage,
  renderMySubmissionsPage,
  renderPackageDetail,
  renderPackageList,
  renderReviewQueuePage,
  renderSubmitPage,
} from "./src/server/html";
import { sendLoginCodeEmail } from "./src/server/mailer";

dotenv.config();
ensureWebPlatformStorage();

const app = express();
const port = Number(process.env.PORT || 3400);
const baseUrl = process.env.OPENCLAW_WEB_BASE_URL || `http://127.0.0.1:${port}`;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
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

function audit(action: string, targetType: string, targetId: string, actorUserId: string | null, metadata?: Record<string, unknown>) {
  const db = loadDatabase();
  db.auditLogs.push({
    id: createId("audit"),
    actorUserId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: new Date().toISOString(),
  });
  saveDatabase(db);
}

function authContext(req: Request) {
  return sessionFromRequest(req);
}

function requirePageAuth(req: Request, res: Response): { session: any; user: any } | null {
  const auth = authContext(req);
  if (!auth) {
    res.redirect("/login");
    return null;
  }
  return auth;
}

function verifyCsrfToken(req: Request, auth: { session: { csrfToken: string } }) {
  const token = typeof req.body?.csrfToken === "string" ? req.body.csrfToken : "";
  return token === auth.session.csrfToken;
}

function reviewActionAndRedirect(req: Request, res: Response, action: "approve" | "request_changes" | "reject") {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      return originalJson(body);
    }
    res.redirect("/review");
    return res;
  }) as Response["json"];
  return reviewAction(req, res, action);
}

function parseCommunityManifestFromBase64(name: string, contentBase64: string): CommunityPackageManifest {
  const buffer = Buffer.from(contentBase64, "base64");
  const tempPath = path.join(process.env.OPENCLAW_WEB_DATA_DIR || "./data", "tmp-upload.zip");
  fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  fs.writeFileSync(tempPath, buffer);
  const archive = new AdmZip(tempPath);
  const entry = archive.getEntries().find((item: any) => item.entryName.endsWith("/community-package.json") || item.entryName === "community-package.json");
  if (!entry) {
    throw new Error("community-package.json not found");
  }
  const manifest = JSON.parse(archive.readAsText(entry)) as CommunityPackageManifest;
  fs.unlinkSync(tempPath);
  return manifest;
}

app.get("/", (req, res) => {
  const db = loadDatabase();
  res.type("html").send(renderHome(db.packages.filter((item) => item.reviewStatus === "published").length, db.submissions.length, authContext(req)));
});

app.get("/downloads", (req, res) => {
  const db = loadDatabase();
  res.type("html").send(renderPackageList("Downloads", db.packages.filter((item) => item.reviewStatus === "published"), authContext(req)));
});

app.get("/community", (req, res) => {
  const db = loadDatabase();
  res.type("html").send(renderPackageList("Community", db.packages.filter((item) => item.visibility === "community" && item.reviewStatus === "published"), authContext(req)));
});

app.get("/package/:id", (req, res) => {
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.id);
  if (!record) {
    return res.status(404).send("Package not found");
  }
  res.type("html").send(renderPackageDetail(record, authContext(req)));
});

app.get("/packages/:id/view", (req, res) => {
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.id);
  if (!record) {
    return res.status(404).send("Package not found");
  }
  res.type("html").send(renderPackageDetail(record, authContext(req)));
});

app.get("/package/:id/download", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.id && item.reviewStatus === "published");
  if (!record) {
    return res.status(404).send("Package not found");
  }
  const version = record.latestVersion;
  const expires = String(Date.now() + 10 * 60 * 1000);
  const signature = signDownloadToken({ packageId: record.packageId, version, expires });
  const url = `${baseUrl}/downloads/file?packageId=${encodeURIComponent(record.packageId)}&version=${encodeURIComponent(version)}&expires=${expires}&sig=${signature}`;
  res.redirect(url);
});

app.get("/login", (req, res) => {
  res.type("html").send(renderLoginPage(null, authContext(req)));
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

    let user = state.mode === "link" && state.userId
      ? db.users.find((item) => item.id === state.userId)
      : db.users.find((item) => item.githubUserId === identity.githubUserId);
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
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
    } else {
      user.githubUserId = identity.githubUserId;
      user.githubLogin = identity.githubLogin;
      user.primaryAuthProvider = user.primaryAuthProvider || "github";
      user.linkedProviders = Array.from(new Set([...(user.linkedProviders || []), "github"]));
    }

    const session = {
      id: generateToken(24),
      userId: user.id,
      csrfToken: generateToken(16),
      twoFactorPassed: user.role !== "super_admin",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    db.sessions = db.sessions.filter((item) => item.userId !== user!.id);
    db.sessions.push(session);
    saveDatabase(db);
    setSessionCookie(res, session.id);
    audit("auth_github_callback", "user", user.id, user.id, {
      githubLogin: identity.githubLogin,
      githubUserId: identity.githubUserId,
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
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  const state = createGithubOAuthState({
    mode: "link",
    userId: auth.user.id,
    redirectTo: "/me",
  });
  return res.json({
    success: true,
    authorizeUrl: buildGithubAuthorizeUrl(state.id),
  });
});

app.post("/login/request", rateLimit("auth-email-request-form", 8, 15 * 60 * 1000), (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    return res.redirect("/login");
  }
  const db = loadDatabase();
  const code = `${randomInt(100000, 999999)}`;
  db.authChallenges = db.authChallenges.filter((item) => item.email !== email);
  db.authChallenges.push({
    id: createId("challenge"),
    email,
    code,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  saveDatabase(db);
  audit("auth_email_request_form", "user", email, null);
  sendLoginCodeEmail(email, code)
    .then((delivery) => {
      res
        .type("html")
        .send(
          renderLoginPage(
            process.env.NODE_ENV !== "production" || !delivery.delivered
              ? code
              : null,
            authContext(req),
          ),
        );
    })
    .catch((error) => {
      res
        .type("html")
        .send(renderLoginPage(`Email send failed: ${error instanceof Error ? error.message : "unknown error"}`, authContext(req)));
    });
});

app.post("/login/verify", rateLimit("auth-email-verify-form", 10, 15 * 60 * 1000), (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!email || !code) {
    return res.redirect("/login");
  }
  const db = loadDatabase();
  const challenge = db.authChallenges.find((item) => item.email === email && item.code === code);
  if (!challenge || Date.parse(challenge.expiresAt) < Date.now()) {
    return res.type("html").send(renderLoginPage("Invalid or expired code", authContext(req)));
  }
  let user = db.users.find((item) => item.email === email);
  if (!user) {
    user = {
      id: createId("user"),
      email,
      role: "user",
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  }
  const session = {
    id: generateToken(24),
    userId: user.id,
    csrfToken: generateToken(16),
    twoFactorPassed: user.role !== "super_admin",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  db.sessions = db.sessions.filter((item) => item.userId !== user.id);
  db.sessions.push(session);
  db.authChallenges = db.authChallenges.filter((item) => item.id !== challenge.id);
  saveDatabase(db);
  setSessionCookie(res, session.id);
  res.redirect(user.role === "super_admin" ? "/admin/2fa" : "/me");
});

app.get("/admin/2fa", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (auth.user.role !== "super_admin") {
    return res.redirect("/me");
  }
  if (auth.session.twoFactorPassed) {
    return res.redirect("/admin");
  }
  res.type("html").send(renderAdminTwoFactorPage(auth));
});

app.post("/admin/2fa", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (!verifyCsrfToken(req, auth)) {
    return res.status(403).send("Invalid CSRF token");
  }
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!auth.user.twoFactorSecret || !code || !authenticator.check(code, auth.user.twoFactorSecret)) {
    return res.type("html").send(renderAdminTwoFactorPage(auth, "Invalid 2FA code"));
  }
  const db = loadDatabase();
  const session = db.sessions.find((item) => item.id === auth.session.id);
  if (!session) {
    return res.redirect("/login");
  }
  session.twoFactorPassed = true;
  saveDatabase(db);
  audit("admin_2fa_verify_form", "session", session.id, auth.user.id);
  res.redirect("/admin");
});

app.get("/submit", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  res.type("html").send(renderSubmitPage(auth));
});

app.post("/submit", upload.single("package"), (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (!verifyCsrfToken(req, auth)) {
    return res.status(403).send("Invalid CSRF token");
  }
  if (!req.file) {
    return res.status(400).send("Package file is required");
  }
  let manifest: CommunityPackageManifest;
  try {
    manifest = parseCommunityManifestFromBase64(req.file.originalname, req.file.buffer.toString("base64"));
  } catch (error) {
    return res.status(400).send(error instanceof Error ? error.message : "Failed to parse package");
  }
  const db = loadDatabase();
  const submissionId = createId("submission");
  const written = writeSubmissionPackage(submissionId, req.file.buffer, manifest);
  db.submissions.push({
    id: submissionId,
    packageId: manifest.packageId,
    authorUserId: auth.user.id,
    status: "submitted",
    packageVersion: manifest.version,
    archivePath: written.archivePath,
    manifestPath: written.manifestPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveDatabase(db);
  audit("submission_created_form", "submission", submissionId, auth.user.id);
  res.redirect("/me");
});

app.get("/me", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  const db = loadDatabase();
  const submissions = db.submissions.filter((item) => item.authorUserId === auth.user.id);
  res.type("html").send(renderMySubmissionsPage(auth, submissions));
});

app.get("/review", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (!["reviewer", "super_admin"].includes(auth.user.role)) {
    return res.status(403).send("Forbidden");
  }
  if (auth.user.role === "super_admin" && !auth.session.twoFactorPassed) {
    return res.status(403).send("Admin 2FA required");
  }
  const db = loadDatabase();
  const submissions = db.submissions.filter((item) => ["submitted", "under_review"].includes(item.status));
  res.type("html").send(renderReviewQueuePage(auth, submissions));
});

app.post("/review/:submissionId/approve-form", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (!verifyCsrfToken(req, auth)) {
    return res.status(403).send("Invalid CSRF token");
  }
  return reviewActionAndRedirect(req, res, "approve");
});

app.post("/review/:submissionId/request-changes-form", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (!verifyCsrfToken(req, auth)) {
    return res.status(403).send("Invalid CSRF token");
  }
  return reviewActionAndRedirect(req, res, "request_changes");
});

app.post("/review/:submissionId/reject-form", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (!verifyCsrfToken(req, auth)) {
    return res.status(403).send("Invalid CSRF token");
  }
  return reviewActionAndRedirect(req, res, "reject");
});

app.get("/admin", (req, res) => {
  const auth = requirePageAuth(req, res);
  if (!auth) {
    return;
  }
  if (auth.user.role !== "super_admin") {
    return res.status(403).send("Forbidden");
  }
  res.type("html").send(renderAdminPage(auth));
});

app.post("/auth/email/request", rateLimit("auth-email-request", 8, 15 * 60 * 1000), (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }
  const db = loadDatabase();
  const code = `${randomInt(100000, 999999)}`;
  db.authChallenges = db.authChallenges.filter((item) => item.email !== email);
  db.authChallenges.push({
    id: createId("challenge"),
    email,
    code,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  saveDatabase(db);
  const payload: Record<string, unknown> = { success: true, delivery: "console" };
  if (process.env.NODE_ENV !== "production") {
    payload.debugCode = code;
  }
  audit("auth_email_request", "user", email, null);
  return res.json(payload);
});

app.post("/auth/email/verify", rateLimit("auth-email-verify", 10, 15 * 60 * 1000), (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }
  const db = loadDatabase();
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
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  }
  const session = {
    id: generateToken(24),
    userId: user.id,
    csrfToken: generateToken(16),
    twoFactorPassed: user.role !== "super_admin",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  db.sessions = db.sessions.filter((item) => item.userId !== user.id);
  db.sessions.push(session);
  db.authChallenges = db.authChallenges.filter((item) => item.id !== challenge.id);
  saveDatabase(db);
  setSessionCookie(res, session.id);
  audit("auth_email_verify", "user", user.id, user.id);
  return res.json({
    success: true,
    user,
    csrfToken: session.csrfToken,
    requiresAdminTwoFactor: user.role === "super_admin",
  });
});

app.post("/auth/admin/2fa/verify", requireAuth, enforceCsrf, rateLimit("auth-admin-2fa", 12, 15 * 60 * 1000), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
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

app.get("/packages", (_req, res) => {
  const db = loadDatabase();
  res.json({
    packages: db.packages.filter((item) => item.reviewStatus === "published"),
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
    githubSyncAt: record.githubSyncAt || "",
  });
});

app.post("/submissions", requireAuth, enforceCsrf, rateLimit("submissions", 20, 60 * 60 * 1000), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const packageBase64 = typeof req.body?.packageBase64 === "string" ? req.body.packageBase64 : "";
  if (!fileName || !packageBase64) {
    return res.status(400).json({ error: "fileName and packageBase64 are required" });
  }
  let manifest: CommunityPackageManifest;
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveDatabase(db);
  audit("submission_created", "submission", submissionId, auth.user.id, {
    packageId: manifest.packageId,
    version: manifest.version,
  });
  return res.json({ success: true, submissionId, packageId: manifest.packageId });
});

app.get("/me/submissions", requireAuth, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  const db = loadDatabase();
  return res.json({
    submissions: db.submissions.filter((item) => item.authorUserId === auth.user.id),
  });
});

app.get("/review/queue", requireAuth, requireRole(["reviewer", "super_admin"]), requireAdminTwoFactor, (req, res) => {
  const db = loadDatabase();
  res.json({
    submissions: db.submissions.filter((item) => ["submitted", "under_review"].includes(item.status)),
  });
});

function reviewAction(req: Request, res: Response, action: "approve" | "request_changes" | "reject") {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  const db = loadDatabase();
  const submission = db.submissions.find((item) => item.id === req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ error: "Submission not found" });
  }
  submission.status =
    action === "approve"
      ? "published"
      : action === "request_changes"
        ? "changes_requested"
        : "rejected";
  submission.updatedAt = new Date().toISOString();
  const manifest = JSON.parse(fs.readFileSync(submission.manifestPath, "utf-8")) as CommunityPackageManifest;
  if (action === "approve") {
    const stored = publishPackageArchive(manifest.packageId, manifest.version, submission.archivePath, {
      ...manifest,
      reviewStatus: "published",
      visibility: manifest.visibility === "private" ? "community" : manifest.visibility,
    });
    const existing = db.packages.find((item) => item.packageId === manifest.packageId);
    const versionRecord = {
      version: manifest.version,
      archivePath: stored.archivePath,
      manifestPath: stored.manifestPath,
      manifest: {
        ...manifest,
        reviewStatus: "published",
        visibility: manifest.visibility === "private" ? "community" : manifest.visibility,
      },
      publishedAt: new Date().toISOString(),
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
        versions: [versionRecord],
      });
    }
  }
  db.reviewDecisions.push({
    submissionId: submission.id,
    reviewerUserId: auth.user.id,
    action: action === "request_changes" ? "request_changes" : action,
    note: typeof req.body?.note === "string" ? req.body.note : undefined,
    createdAt: new Date().toISOString(),
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
    const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
    const db = loadDatabase();
    const submission = db.submissions.find((item) => item.id === req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }
    const manifest = JSON.parse(fs.readFileSync(submission.manifestPath, "utf-8")) as CommunityPackageManifest;
    const sync = await syncPackageToGithubRelease({
      packageId: manifest.packageId,
      version: manifest.version,
      archivePath: submission.archivePath,
      manifest,
      official: manifest.visibility === "official",
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
      error: error instanceof Error ? error.message : "Failed to sync GitHub release",
    });
  }
});

app.get("/downloads/:packageId", requireAuth, (req, res) => {
  const db = loadDatabase();
  const record = db.packages.find((item) => item.packageId === req.params.packageId && item.reviewStatus === "published");
  if (!record) {
    return res.status(404).json({ error: "Package not found" });
  }
  const version = record.latestVersion;
  const expires = String(Date.now() + 10 * 60 * 1000);
  const signature = signDownloadToken({ packageId: record.packageId, version, expires });
  const url = `${baseUrl}/downloads/file?packageId=${encodeURIComponent(record.packageId)}&version=${encodeURIComponent(version)}&expires=${expires}&sig=${signature}`;
  return res.json({ success: true, signedUrl: url, expiresAt: new Date(Number(expires)).toISOString() });
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
  if (!versionRecord || !fs.existsSync(versionRecord.archivePath)) {
    return res.status(404).send("Package archive not found");
  }
  audit("download_package", "package", packageId, null, { version });
  return res.download(versionRecord.archivePath, `${packageId.replaceAll("/", "__")}-${version}.zip`);
});

app.get("/admin/audit-logs", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  res.json({ auditLogs: db.auditLogs });
});

app.get("/admin/security-events", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, (_req, res) => {
  const db = loadDatabase();
  res.json({ securityEvents: db.securityEvents });
});

app.post("/auth/logout", requireAuth, enforceCsrf, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  const db = loadDatabase();
  db.sessions = db.sessions.filter((item) => item.id !== auth.session.id);
  saveDatabase(db);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "openclaw-web-platform",
  });
});

app.listen(port, () => {
  console.log(`OpenClaw Web Platform running on ${baseUrl}`);
});
