import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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
  adminTwoFactorRequiredForRole,
  clearSessionCookie,
  checkRateLimit,
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
import { sendLoginCodeEmail, sendTestEmail } from "./src/server/mailer";
import { smtpConfigured } from "./src/server/mailer";
import {
  buildCloudConsoleLaunchUrl,
  cloudConsoleAccessEnabled,
  cloudConsolePublicBaseUrl,
  createCloudConsoleAccessCode,
  expireCloudConsoleRecords,
  findActiveCloudConsoleGrant,
  issueCloudConsoleLaunchToken,
  redeemCloudConsoleAccessCode,
} from "./src/server/consoleAccess";

dotenv.config();
ensureWebPlatformStorage();

const app = express();
const port = Number(process.env.PORT || 3400);
const baseUrl = process.env.OPENCLAW_WEB_BASE_URL || `http://127.0.0.1:${port}`;
const cloudOpenClawBaseUrl = (process.env.SOLOCORE_CLOUD_CONSOLE_URL || process.env.OPENCLAW_CLOUD_CONSOLE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const cloudOpenClawPublicBaseUrl = cloudConsolePublicBaseUrl();
const cloudOpenClawWorkdir = process.env.SOLOCORE_CLOUD_CONSOLE_WORKDIR || process.env.OPENCLAW_CLOUD_CONSOLE_WORKDIR || "/opt/solocore/workspace/apps/mission-control";
const cloudOpenClawTopologyPath = process.env.SOLOCORE_CLOUD_TOPOLOGY_PATH || process.env.OPENCLAW_CLOUD_TOPOLOGY_PATH || "/etc/solocore/workspace-topology.json";
const cloudOpenClawInternalToken = (process.env.SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN || process.env.OPENCLAW_CLOUD_CONSOLE_INTERNAL_TOKEN || "").trim();
const forgeConsoleReleasesDir = path.resolve(
  process.env.OPENCLAW_FORGE_CONSOLE_RELEASES_DIR || path.join(process.cwd(), "../mission-control/releases"),
);
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

function authEmailSettings() {
  return loadDatabase().settings.authEmail;
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "off", "no"].includes(normalized)) {
      return false;
    }
    if (["true", "1", "on", "yes"].includes(normalized)) {
      return true;
    }
  }
  return fallback;
}

function collectUserAuditLogs(db: ReturnType<typeof loadDatabase>, userId: string) {
  return db.auditLogs
    .filter((item) => item.actorUserId === userId || (item.targetType === "user" && item.targetId === userId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function buildAdminUserSummary(db: ReturnType<typeof loadDatabase>, user: ReturnType<typeof safeUser>) {
  const now = Date.now();
  const sessions = db.sessions.filter((item) => item.userId === user.id);
  const activeSessions = sessions.filter((item) => Date.parse(item.expiresAt) > now);
  const submissions = db.submissions.filter((item) => item.authorUserId === user.id);
  const reviews = db.reviewDecisions.filter((item) => item.reviewerUserId === user.id);
  const auditLogs = collectUserAuditLogs(db, user.id);
  const authLogs = auditLogs.filter((item) => item.action.startsWith("auth_") || item.action === "admin_2fa_verify");
  const activeCloudGrantCount = db.cloudConsoleGrants.filter(
    (item) => item.userId === user.id && item.status === "active" && Date.parse(item.expiresAt) > now,
  ).length;
  const lastActivityAt = [
    ...activeSessions.map((item) => item.createdAt),
    ...submissions.map((item) => item.updatedAt),
    ...reviews.map((item) => item.createdAt),
    ...auditLogs.map((item) => item.createdAt),
  ]
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

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
    recentAudit: auditLogs.slice(0, 8),
  };
}

async function cloudOpenClawFetch(targetPath: string, init?: RequestInit) {
  const nextHeaders = new Headers(init?.headers || {});
  if (cloudOpenClawInternalToken) {
    nextHeaders.set("x-solocore-internal-token", cloudOpenClawInternalToken);
  }
  const response = await fetch(`${cloudOpenClawBaseUrl}${targetPath}`, {
    ...init,
    headers: nextHeaders,
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new Error(
      typeof body === "string"
        ? body
        : typeof body === "object" && body && "error" in body
          ? String((body as { error?: unknown }).error)
          : `Cloud OpenClaw request failed: ${response.status}`,
    );
  }
  return body;
}

function runCloudConsoleRegistryInstall(packagePath: string) {
  const scriptPath = path.join(cloudOpenClawWorkdir, "scripts", "local_package_registry.py");
  const result = spawnSync(
    "python3",
    [scriptPath, "install", "--package-path", packagePath],
    {
      cwd: cloudOpenClawWorkdir,
      env: {
        ...process.env,
        OPENCLAW_TOPOLOGY_PATH: cloudOpenClawTopologyPath,
      },
      encoding: "utf-8",
      timeout: 120000,
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "Cloud package install failed");
  }
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function safeUser(user: {
  id: string;
  email: string;
  role: string;
  primaryAuthProvider?: string;
  linkedProviders?: string[];
  githubUserId?: string;
  githubLogin?: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    primaryAuthProvider: user.primaryAuthProvider,
    linkedProviders: user.linkedProviders,
    githubUserId: user.githubUserId,
    githubLogin: user.githubLogin,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
  };
}

function buildCloudConsoleAccessResponse(userId: string) {
  const db = loadDatabase();
  expireCloudConsoleRecords(db);
  saveDatabase(db);
  const activeGrant = findActiveCloudConsoleGrant(db, userId);
  return {
    accessEnabled: cloudConsoleAccessEnabled(),
    publicBaseUrl: cloudOpenClawPublicBaseUrl,
    activeGrant: activeGrant
      ? {
          id: activeGrant.id,
          codeId: activeGrant.codeId,
          expiresAt: activeGrant.expiresAt,
          lastLaunchedAt: activeGrant.lastLaunchedAt,
        }
      : null,
  };
}

function parseCommunityManifestFromBase64(name: string, contentBase64: string): CommunityPackageManifest {
  const buffer = Buffer.from(contentBase64, "base64");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-upload-"));
  const tempPath = path.join(tempDir, name || "upload.zip");
  try {
    fs.writeFileSync(tempPath, buffer);
    const archive = new AdmZip(tempPath);
    const entry = archive.getEntries().find((item: any) => item.entryName.endsWith("/community-package.json") || item.entryName === "community-package.json");
    if (!entry) {
      throw new Error("community-package.json not found");
    }
    return JSON.parse(archive.readAsText(entry)) as CommunityPackageManifest;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function latestForgeConsoleBundle() {
  if (!fs.existsSync(forgeConsoleReleasesDir)) {
    return null;
  }
  const releaseDirs = fs
    .readdirSync(forgeConsoleReleasesDir)
    .map((entry) => path.join(forgeConsoleReleasesDir, entry))
    .filter((entryPath) => fs.existsSync(path.join(entryPath, "release-manifest.json")));

  const manifestCandidates = releaseDirs
    .map((releasePath) => {
      const manifestPath = path.join(releasePath, "release-manifest.json");
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
          version?: string;
          builtAt?: string;
          artifactType?: string;
          launchers?: Record<string, string>;
          archiveFile?: string;
        };
        const archiveName = manifest.archiveFile || `${path.basename(releasePath)}.zip`;
        const archivePath = path.join(forgeConsoleReleasesDir, archiveName);
        if (!fs.existsSync(archivePath)) {
          return null;
        }
        return {
          fileName: archiveName,
          fullPath: archivePath,
          updatedAt: manifest.builtAt || fs.statSync(archivePath).mtime.toISOString(),
          version: manifest.version || "0.0.0",
          artifactType: manifest.artifactType || "local-runtime-bundle",
          launchers: manifest.launchers || {},
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const versionOrder = b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: "base" });
      if (versionOrder !== 0) {
        return versionOrder;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  if (manifestCandidates[0]) {
    return manifestCandidates[0];
  }

  const zipCandidates = fs
    .readdirSync(forgeConsoleReleasesDir)
    .filter((entry) => entry.endsWith(".zip"))
    .map((entry) => {
      const fullPath = path.join(forgeConsoleReleasesDir, entry);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry,
        fullPath,
        updatedAt: stat.mtime.toISOString(),
        version: "0.0.0",
        artifactType: "legacy-dist-archive",
        launchers: {},
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
  const expires = String(Date.now() + 10 * 60 * 1000);
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
      twoFactorPassed: !adminTwoFactorRequiredForRole(user.role),
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
    res.redirect(adminTwoFactorRequiredForRole(user.role) ? "/admin/2fa" : state.redirectTo || "/me");
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

app.get("/auth/session", (req, res) => {
  const auth = authContext(req);
  if (!auth) {
    return res.json({
      authenticated: false,
      user: null,
      csrfToken: null,
      twoFactorPassed: false,
      requiresAdminTwoFactor: false,
      githubOauthConfigured: githubOauthConfigured(),
    });
  }
  return res.json({
    authenticated: true,
    user: safeUser(auth.user),
    csrfToken: auth.session.csrfToken,
    twoFactorPassed: auth.session.twoFactorPassed,
    requiresAdminTwoFactor: adminTwoFactorRequiredForRole(auth.user.role) && !auth.session.twoFactorPassed,
    githubOauthConfigured: githubOauthConfigured(),
  });
});

app.get("/cloud-console/access", requireAuth, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  return res.json(buildCloudConsoleAccessResponse(auth.user.id));
});

app.post("/cloud-console/access/redeem", requireAuth, enforceCsrf, rateLimit("cloud-console-redeem", 12, 15 * 60 * 1000), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
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
    grant.lastLaunchedAt = new Date().toISOString();
    saveDatabase(db);
    audit("cloud_console_access_redeem", "cloud_console_code", accessCode.id, auth.user.id, {
      grantId: grant.id,
    });
    return res.json({
      success: true,
      access: buildCloudConsoleAccessResponse(auth.user.id),
      launchUrl: buildCloudConsoleLaunchUrl(launchToken),
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to redeem authorization code",
    });
  }
});

app.post("/cloud-console/access/launch", requireAuth, enforceCsrf, rateLimit("cloud-console-launch", 60, 15 * 60 * 1000), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
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
  grant.lastLaunchedAt = new Date().toISOString();
  saveDatabase(db);
  audit("cloud_console_launch", "cloud_console_grant", grant.id, auth.user.id);
  return res.json({
    success: true,
    access: buildCloudConsoleAccessResponse(auth.user.id),
    launchUrl: buildCloudConsoleLaunchUrl(launchToken),
  });
});

app.get("/downloads/forge-console/meta", (_req, res) => {
  const bundle = latestForgeConsoleBundle();
  if (!bundle) {
    return res.json({
      available: false,
      fileName: "",
      updatedAt: "",
      downloadUrl: "",
    });
  }

  return res.json({
    available: true,
    fileName: bundle.fileName,
    updatedAt: bundle.updatedAt,
    version: bundle.version,
    artifactType: bundle.artifactType,
    launchers: bundle.launchers,
    downloadUrl: "/downloads/forge-console/latest",
  });
});

app.post("/submissions/validate", requireAuth, enforceCsrf, rateLimit("submissions-validate", 30, 60 * 60 * 1000), (req, res) => {
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
        docs: manifest.docs.length,
      },
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to validate package",
    });
  }
});

app.get("/downloads/forge-console/latest", (_req, res) => {
  const bundle = latestForgeConsoleBundle();
  if (!bundle) {
    return res.status(404).json({
      error: "SoloCore Console release bundle is not available yet",
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

  const cooldownMs = settings.resendCooldownSeconds * 1000;
  const lastChallenge = db.authChallenges
    .filter((item) => item.email === email)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  if (lastChallenge && Date.parse(lastChallenge.createdAt) + cooldownMs > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(lastChallenge.createdAt) + cooldownMs - nowMs) / 1000));
    return res.status(429).json({
      error: `Please wait ${retryAfterSeconds}s before requesting another code for this email`,
      retryAfterSeconds,
    });
  }

  const requestLimitDecision = checkRateLimit(
    `auth-email-request:${email}`,
    settings.requestLimitPerWindow,
    settings.requestWindowMinutes * 60 * 1000,
  );
  if (!requestLimitDecision.allowed) {
    return res.status(429).json({
      error: "Too many code requests for this email",
      retryAfterSeconds: requestLimitDecision.retryAfterSeconds,
    });
  }

  const reusableChallenge =
    lastChallenge && Date.parse(lastChallenge.expiresAt) > nowMs
      ? lastChallenge
      : null;
  const code = reusableChallenge?.code || `${randomInt(100000, 999999)}`;
  if (!reusableChallenge) {
    db.authChallenges = db.authChallenges.filter((item) => item.email !== email);
    db.authChallenges.push({
      id: createId("challenge"),
      email,
      code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + settings.codeTtlMinutes * 60 * 1000).toISOString(),
    });
  }
  saveDatabase(db);
  const delivery = await sendLoginCodeEmail(email, code);
  const payload: Record<string, unknown> = {
    success: true,
    delivery: delivery.mode,
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
    settings.verifyWindowMinutes * 60 * 1000,
  );
  if (!verifyLimitDecision.allowed) {
    return res.status(429).json({
      error: "Too many verification attempts",
      retryAfterSeconds: verifyLimitDecision.retryAfterSeconds,
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
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  }
  const session = {
    id: generateToken(24),
    userId: user.id,
    csrfToken: generateToken(16),
    twoFactorPassed: !adminTwoFactorRequiredForRole(user.role),
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
    user: safeUser(user),
    csrfToken: session.csrfToken,
    requiresAdminTwoFactor: adminTwoFactorRequiredForRole(user.role),
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

app.get("/auth/admin/2fa/setup", requireAuth, requireRole(["super_admin"]), (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  if (!auth.user.twoFactorSecret) {
    return res.status(404).json({ error: "Admin 2FA is not configured yet" });
  }
  return res.json({
    secret: auth.user.twoFactorSecret,
    otpauth: authenticator.keyuri(auth.user.email, "SoloCore Hub", auth.user.twoFactorSecret),
    issuer: "SoloCore Hub",
    email: auth.user.email,
  });
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
    const publishedManifest: CommunityPackageManifest = {
      ...manifest,
      reviewStatus: "published",
      visibility: manifest.visibility === "private" ? "community" : manifest.visibility,
    };
    const stored = publishPackageArchive(manifest.packageId, manifest.version, submission.archivePath, {
      ...publishedManifest,
    });
    const existing = db.packages.find((item) => item.packageId === manifest.packageId);
    const versionRecord = {
      version: manifest.version,
      archivePath: stored.archivePath,
      manifestPath: stored.manifestPath,
      manifest: publishedManifest,
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
  const roleWeight: Record<string, number> = {
    super_admin: 0,
    reviewer: 1,
    user: 2,
    guest: 3,
  };
  const users = [...db.users]
    .map((user) => buildAdminUserSummary(db, safeUser(user)))
    .sort((a, b) => {
      const byRole = (roleWeight[a.role] ?? 99) - (roleWeight[b.role] ?? 99);
      if (byRole !== 0) {
        return byRole;
      }
      return Date.parse(b.lastActivityAt || b.createdAt) - Date.parse(a.lastActivityAt || a.createdAt);
    });
  res.json({ users });
});

app.post("/admin/users/:userId/role", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
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
  targetUser.role = nextRole as typeof targetUser.role;
  saveDatabase(db);
  audit("user_role_update", "user", targetUser.id, auth.user.id, {
    fromRole: previousRole,
    toRole: nextRole,
  });
  return res.json({ success: true, user: buildAdminUserSummary(loadDatabase(), safeUser(targetUser)) });
});

app.post("/admin/users/:userId/revoke-sessions", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
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
      releaseBundleUpdatedAt: bundle?.updatedAt || "",
    },
    counts: {
      users: db.users.length,
      sessions: db.sessions.length,
      submissions: db.submissions.length,
      packages: db.packages.length,
      auditLogs: db.auditLogs.length,
      securityEvents: db.securityEvents.length,
    },
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
    grants: [...db.cloudConsoleGrants].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  });
});

app.post("/admin/cloud-console/access-codes", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
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
    maxUses,
  });
  saveDatabase(db);
  audit("cloud_console_code_create", "cloud_console_code", record.id, auth.user.id, {
    label: record.label,
    maxUses: record.maxUses,
    expiresAt: record.expiresAt,
  });
  return res.json({
    success: true,
    code: record,
    plainCode,
  });
});

app.post("/admin/cloud-console/access-codes/:codeId/revoke", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, (req, res) => {
  const auth = (req as Request & { auth?: ReturnType<typeof authContext> }).auth!;
  const db = loadDatabase();
  const code = db.cloudConsoleAccessCodes.find((item) => item.id === req.params.codeId);
  if (!code) {
    return res.status(404).json({ error: "Authorization code not found" });
  }
  code.revokedAt = code.revokedAt || new Date().toISOString();
  db.cloudConsoleGrants = db.cloudConsoleGrants.map((item) =>
    item.codeId === code.id && item.status === "active"
      ? { ...item, status: "revoked", revokedAt: new Date().toISOString() }
      : item,
  );
  saveDatabase(db);
  audit("cloud_console_code_revoke", "cloud_console_code", code.id, auth.user.id);
  return res.json({ success: true });
});

app.get("/admin/cloud-openclaw/summary", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, async (_req, res) => {
  const summary: Record<string, unknown> = {
    consoleBaseUrl: cloudOpenClawBaseUrl,
    reachable: false,
    errors: [] as string[],
  };

  const errors: string[] = [];
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
    const localPackages = await cloudOpenClawFetch("/api/v1/local-packages") as { packages?: unknown[] };
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
      error: error instanceof Error ? error.message : "Failed to load cloud OpenClaw skill tree",
    });
  }
});

app.post("/admin/cloud-openclaw/execute", requireAuth, requireRole(["super_admin"]), requireAdminTwoFactor, enforceCsrf, async (req, res) => {
  const nodeId = typeof req.body?.nodeId === "string" ? req.body.nodeId.trim() : "";
  const command = typeof req.body?.command === "string" ? req.body.command.trim() : "";
  const inputValues = req.body?.inputValues && typeof req.body.inputValues === "object"
    ? req.body.inputValues as Record<string, string>
    : {};

  if (!nodeId || !command) {
    return res.status(400).json({ error: "nodeId and command are required" });
  }

  try {
    const payload = await cloudOpenClawFetch("/api/v1/node-execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nodeId,
        command,
        inputValues,
      }),
    });
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to queue cloud OpenClaw execution",
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
  if (!fs.existsSync(versionRecord.archivePath)) {
    return res.status(404).json({ error: "Package archive is missing on server" });
  }

  try {
    const payload = runCloudConsoleRegistryInstall(versionRecord.archivePath);
    audit("install_cloud_package", "package", packageId, (req as Request & { auth?: ReturnType<typeof authContext> }).auth?.user.id || null, {
      version: selectedVersion,
      installPath: payload.installPath || "",
    });
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to install package into cloud OpenClaw",
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
    token: typeof req.body?.token === "string" ? req.body.token.trim() : "",
  };
  saveDatabase(db);
  return res.json({
    success: true,
    githubOauthConfigured: githubOauthConfigured(),
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
    from: typeof req.body?.from === "string" ? req.body.from.trim() : "",
  };
  saveDatabase(db);
  return res.json({
    success: true,
    smtpConfigured: smtpConfigured(),
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
      delivered: delivery.delivered,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send SMTP test email",
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
    verifyWindowMinutes: Math.max(1, Number(req.body?.verifyWindowMinutes || 15)),
    adminTwoFactorRequired: parseBoolean(req.body?.adminTwoFactorRequired, true),
  };
  saveDatabase(db);
  return res.json({
    success: true,
    settings: db.settings.authEmail,
  });
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
    service: "forge-hub",
  });
});

async function attachFrontend() {
  const isProd = process.env.NODE_ENV === "production";
  const appRoot = process.cwd();

  if (isProd) {
    const distPath = path.resolve(appRoot, "dist");
    app.use(express.static(distPath, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: appRoot,
    server: {
      middlewareMode: true,
    },
    appType: "spa",
  });

  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    try {
      const templatePath = path.resolve(appRoot, "index.html");
      const template = fs.readFileSync(templatePath, "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

void attachFrontend().then(() => {
  app.listen(port, () => {
    console.log(`SoloCore Hub running on ${baseUrl}`);
  });
});
