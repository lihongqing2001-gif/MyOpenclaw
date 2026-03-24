import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AuditLogEntry,
  AuthChallenge,
  GithubOAuthState,
  PackageRecord,
  ReviewDecision,
  SecurityEvent,
  Session,
  SubmissionRecord,
  User,
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
}

const dataDir = path.resolve(
  process.env.OPENCLAW_WEB_DATA_DIR ||
    path.join(getRuntimeRoot(), "artifacts", "openclaw-web-platform", "data"),
);
const storageDir = path.join(dataDir, "storage");
const packagesDir = path.join(storageDir, "packages");
const submissionsDir = path.join(storageDir, "submissions");
const databasePath = path.join(dataDir, "db.json");

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
});

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureWebPlatformStorage() {
  ensureDir(dataDir);
  ensureDir(storageDir);
  ensureDir(packagesDir);
  ensureDir(submissionsDir);
  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, JSON.stringify(emptyDatabase(), null, 2), "utf-8");
  }
}

export function loadDatabase(): WebPlatformDatabase {
  ensureWebPlatformStorage();
  return JSON.parse(fs.readFileSync(databasePath, "utf-8")) as WebPlatformDatabase;
}

export function saveDatabase(payload: WebPlatformDatabase) {
  ensureWebPlatformStorage();
  fs.writeFileSync(databasePath, JSON.stringify(payload, null, 2), "utf-8");
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
