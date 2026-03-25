import fs from "node:fs";
import path from "node:path";
import { ensureWebPlatformStorage, getWebPlatformPaths, normalizeDatabase, saveDatabase } from "../src/server/store";

function rewritePath(value: string | undefined, prefixes: string[], targetDataDir: string) {
  if (!value) {
    return value;
  }
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) {
      return path.join(targetDataDir, value.slice(prefix.length));
    }
  }
  return value;
}

const sourceIndex = process.argv.indexOf("--source");
const sourcePath = sourceIndex >= 0 && process.argv[sourceIndex + 1]
  ? path.resolve(process.argv[sourceIndex + 1])
  : getWebPlatformPaths().databasePath;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Source db.json not found: ${sourcePath}`);
  process.exit(1);
}

ensureWebPlatformStorage();

const sourceDir = path.dirname(sourcePath);
const targetPaths = getWebPlatformPaths();
const targetDataDir = targetPaths.dataDir;
const pathPrefixes = Array.from(new Set([
  sourceDir,
  "/Users/liumobei/.openclaw/runtime/artifacts/openclaw-web-platform/data",
  "/Users/liumobei/.openclaw/workspace/apps/openclaw-web-platform/data",
]));

const sourcePayload = normalizeDatabase(JSON.parse(fs.readFileSync(sourcePath, "utf-8")));
let rewrittenPaths = 0;

for (const submission of sourcePayload.submissions) {
  const nextArchivePath = rewritePath(submission.archivePath, pathPrefixes, targetDataDir);
  const nextManifestPath = rewritePath(submission.manifestPath, pathPrefixes, targetDataDir);
  if (nextArchivePath !== submission.archivePath) {
    rewrittenPaths += 1;
    submission.archivePath = nextArchivePath || submission.archivePath;
  }
  if (nextManifestPath !== submission.manifestPath) {
    rewrittenPaths += 1;
    submission.manifestPath = nextManifestPath || submission.manifestPath;
  }
}

for (const pkg of sourcePayload.packages) {
  for (const version of pkg.versions) {
    const nextArchivePath = rewritePath(version.archivePath, pathPrefixes, targetDataDir);
    const nextManifestPath = rewritePath(version.manifestPath, pathPrefixes, targetDataDir);
    if (nextArchivePath !== version.archivePath) {
      rewrittenPaths += 1;
      version.archivePath = nextArchivePath || version.archivePath;
    }
    if (nextManifestPath !== version.manifestPath) {
      rewrittenPaths += 1;
      version.manifestPath = nextManifestPath || version.manifestPath;
    }
  }
}

saveDatabase(sourcePayload);

console.log(JSON.stringify({
  success: true,
  sourcePath,
  targetDataDir,
  rewrittenPaths,
  counts: {
    users: sourcePayload.users.length,
    sessions: sourcePayload.sessions.length,
    submissions: sourcePayload.submissions.length,
    packages: sourcePayload.packages.length,
    reviewDecisions: sourcePayload.reviewDecisions.length,
    auditLogs: sourcePayload.auditLogs.length,
    securityEvents: sourcePayload.securityEvents.length,
  },
}, null, 2));
