import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  AuditLogEntry,
  AuthChallenge,
  CloudConsoleAccessCode,
  CloudConsoleGrant,
  GithubOAuthState,
  PackageRecord,
  ReviewDecision,
  SecurityEvent,
  Session,
  SubmissionRecord,
  User,
  PlatformSettings,
} from "../contracts/types";
import { CommunityPackageManifest } from "../contracts/community-package";
import { getRuntimeRoot } from "./workspaceTopology";

export interface WebPlatformDatabase {
  users: User[];
  sessions: Session[];
  authChallenges: AuthChallenge[];
  oauthStates: GithubOAuthState[];
  submissions: SubmissionRecord[];
  packages: PackageRecord[];
  reviewDecisions: ReviewDecision[];
  auditLogs: AuditLogEntry[];
  securityEvents: SecurityEvent[];
  cloudConsoleAccessCodes: CloudConsoleAccessCode[];
  cloudConsoleGrants: CloudConsoleGrant[];
  settings: PlatformSettings;
}

const dataDir = path.resolve(
  process.env.OPENCLAW_WEB_DATA_DIR ||
    path.join(getRuntimeRoot(), "artifacts", "openclaw-web-platform", "data"),
);
const storageDir = path.join(dataDir, "storage");
const packagesDir = path.join(storageDir, "packages");
const submissionsDir = path.join(storageDir, "submissions");
const databasePath = path.join(dataDir, "db.json");
const postgresStateKey = "primary";

let cachedDatabase: WebPlatformDatabase | null = null;
let postgresInitialized = false;

const emptyDatabase = (): WebPlatformDatabase => ({
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
      token: "",
    },
    smtp: {
      provider: "qq",
      host: "",
      port: "465",
      user: "",
      pass: "",
      from: "",
    },
    authEmail: {
      codeTtlMinutes: 10,
      resendCooldownSeconds: 30,
      requestLimitPerWindow: 8,
      requestWindowMinutes: 15,
      verifyLimitPerWindow: 10,
      verifyWindowMinutes: 15,
    },
  },
});

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeDatabase(payload: Partial<WebPlatformDatabase> | null | undefined): WebPlatformDatabase {
  return {
    users: arrayOrEmpty<User>(payload?.users),
    sessions: arrayOrEmpty<Session>(payload?.sessions),
    authChallenges: arrayOrEmpty<AuthChallenge>(payload?.authChallenges),
    oauthStates: arrayOrEmpty<GithubOAuthState>(payload?.oauthStates),
    submissions: arrayOrEmpty<SubmissionRecord>(payload?.submissions),
    packages: arrayOrEmpty<PackageRecord>(payload?.packages),
    reviewDecisions: arrayOrEmpty<ReviewDecision>(payload?.reviewDecisions),
    auditLogs: arrayOrEmpty<AuditLogEntry>(payload?.auditLogs),
    securityEvents: arrayOrEmpty<SecurityEvent>(payload?.securityEvents),
    cloudConsoleAccessCodes: arrayOrEmpty<CloudConsoleAccessCode>(payload?.cloudConsoleAccessCodes),
    cloudConsoleGrants: arrayOrEmpty<CloudConsoleGrant>(payload?.cloudConsoleGrants),
    settings: {
      github: {
        clientId: payload?.settings?.github?.clientId || "",
        clientSecret: payload?.settings?.github?.clientSecret || "",
        callbackUrl: payload?.settings?.github?.callbackUrl || "",
        releaseRepo: payload?.settings?.github?.releaseRepo || "",
        token: payload?.settings?.github?.token || "",
      },
      smtp: {
        provider: payload?.settings?.smtp?.provider === "custom" ? "custom" : "qq",
        host: payload?.settings?.smtp?.host || "",
        port: payload?.settings?.smtp?.port || "465",
        user: payload?.settings?.smtp?.user || "",
        pass: payload?.settings?.smtp?.pass || "",
        from: payload?.settings?.smtp?.from || "",
      },
      authEmail: {
        codeTtlMinutes: Math.max(1, Number(payload?.settings?.authEmail?.codeTtlMinutes || 10)),
        resendCooldownSeconds: Math.max(0, Number(payload?.settings?.authEmail?.resendCooldownSeconds || 30)),
        requestLimitPerWindow: Math.max(1, Number(payload?.settings?.authEmail?.requestLimitPerWindow || 8)),
        requestWindowMinutes: Math.max(1, Number(payload?.settings?.authEmail?.requestWindowMinutes || 15)),
        verifyLimitPerWindow: Math.max(1, Number(payload?.settings?.authEmail?.verifyLimitPerWindow || 10)),
        verifyWindowMinutes: Math.max(1, Number(payload?.settings?.authEmail?.verifyWindowMinutes || 15)),
      },
    },
  };
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cloneDatabase(payload: WebPlatformDatabase): WebPlatformDatabase {
  return JSON.parse(JSON.stringify(payload)) as WebPlatformDatabase;
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

function writeLocalMirror(payload: WebPlatformDatabase) {
  ensureDir(dataDir);
  fs.writeFileSync(databasePath, JSON.stringify(payload, null, 2), "utf-8");
}

function runPostgresHelper(action: "init" | "load" | "save", payload?: WebPlatformDatabase) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-web-platform-pg-"));
  const payloadPath = path.join(tempDir, "payload.json");
  const resultPath = path.join(tempDir, "result.json");
  const emptyPath = path.join(tempDir, "empty.json");
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
    fs.writeFileSync(emptyPath, JSON.stringify(emptyDatabase(), null, 2), "utf-8");
    if (payload) {
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf-8");
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
        OPENCLAW_STORE_EMPTY_PATH: emptyPath,
      },
      maxBuffer: 1024 * 1024 * 32,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (action === "load") {
      return fs.readFileSync(resultPath, "utf-8");
    }
    return "";
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function ensurePostgresStorage() {
  if (!postgresEnabled() || postgresInitialized) {
    return;
  }
  runPostgresHelper("init");
  postgresInitialized = true;
}

export function getWebPlatformPaths() {
  return {
    dataDir,
    storageDir,
    packagesDir,
    submissionsDir,
    databasePath,
  };
}

export function ensureWebPlatformStorage() {
  ensureDir(dataDir);
  ensureDir(storageDir);
  ensureDir(packagesDir);
  ensureDir(submissionsDir);
  ensurePostgresStorage();
  if (!fs.existsSync(databasePath)) {
    writeLocalMirror(emptyDatabase());
  }
}

export function loadDatabase(): WebPlatformDatabase {
  if (cachedDatabase) {
    return cloneDatabase(cachedDatabase);
  }
  ensureWebPlatformStorage();
  const payload = postgresEnabled()
    ? JSON.parse(runPostgresHelper("load")) as WebPlatformDatabase
    : JSON.parse(fs.readFileSync(databasePath, "utf-8")) as WebPlatformDatabase;
  cachedDatabase = normalizeDatabase(payload);
  return cloneDatabase(cachedDatabase);
}

export function saveDatabase(payload: WebPlatformDatabase) {
  ensureWebPlatformStorage();
  const normalized = normalizeDatabase(payload);
  cachedDatabase = cloneDatabase(normalized);
  if (postgresEnabled()) {
    runPostgresHelper("save", normalized);
  }
  writeLocalMirror(normalized);
}

export function packageArchivePath(packageId: string, version: string) {
  return path.join(packagesDir, packageId.replaceAll("/", "__"), version, "package.zip");
}

export function packageManifestPath(packageId: string, version: string) {
  return path.join(packagesDir, packageId.replaceAll("/", "__"), version, "community-package.json");
}

export function submissionArchivePath(submissionId: string) {
  return path.join(submissionsDir, submissionId, "package.zip");
}

export function submissionManifestPath(submissionId: string) {
  return path.join(submissionsDir, submissionId, "community-package.json");
}

export function writeSubmissionPackage(submissionId: string, archiveBuffer: Buffer, manifest: CommunityPackageManifest) {
  const archivePath = submissionArchivePath(submissionId);
  const manifestPath = submissionManifestPath(submissionId);
  ensureDir(path.dirname(archivePath));
  fs.writeFileSync(archivePath, archiveBuffer);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  return { archivePath, manifestPath };
}

export function publishPackageArchive(packageId: string, version: string, archiveSourcePath: string, manifest: CommunityPackageManifest) {
  const archivePath = packageArchivePath(packageId, version);
  const manifestPath = packageManifestPath(packageId, version);
  ensureDir(path.dirname(archivePath));
  fs.copyFileSync(archiveSourcePath, archivePath);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  return { archivePath, manifestPath };
}

export function createId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}
