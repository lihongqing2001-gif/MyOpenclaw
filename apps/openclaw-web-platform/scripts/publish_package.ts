import fs from "node:fs";
import path from "node:path";
import { loadDatabase, saveDatabase, ensureWebPlatformStorage, publishPackageArchive } from "../src/server/store";
import { CommunityPackageManifest } from "../src/contracts/community-package";
import { createId } from "../src/server/store";
import AdmZip from "adm-zip";
import { syncPackageToGithubRelease } from "../src/server/github";

function usage() {
  console.error("Usage: npm run publish-package -- <zip-path> [official|community]");
  process.exit(1);
}

const zipPath = process.argv[2];
const visibility = (process.argv[3] as "official" | "community" | undefined) || "official";
if (!zipPath) {
  usage();
}

const targetPath = path.resolve(zipPath);
if (!fs.existsSync(targetPath)) {
  console.error(`Package not found: ${targetPath}`);
  process.exit(1);
}

const archive = new AdmZip(targetPath);
const communityEntry = archive.getEntries().find((entry) => entry.entryName.endsWith("/community-package.json") || entry.entryName === "community-package.json");
if (!communityEntry) {
  console.error("community-package.json not found in archive");
  process.exit(1);
}
const manifest = JSON.parse(archive.readAsText(communityEntry)) as CommunityPackageManifest;

ensureWebPlatformStorage();
const db = loadDatabase();
const stored = publishPackageArchive(manifest.packageId, manifest.version, targetPath, manifest);
const record = db.packages.find((item) => item.packageId === manifest.packageId);
const versionRecord = {
  version: manifest.version,
  archivePath: stored.archivePath,
  manifestPath: stored.manifestPath,
  manifest,
  publishedAt: new Date().toISOString(),
  githubReleaseTag: undefined as string | undefined,
  githubReleaseUrl: undefined as string | undefined,
  githubAssetUrl: undefined as string | undefined,
  githubSyncStatus: undefined as "pending" | "synced" | "failed" | undefined,
  githubSyncAt: undefined as string | undefined,
};
let githubSync: {
  githubReleaseTag: string;
  githubReleaseUrl: string;
  githubAssetUrl: string;
  githubSyncStatus: "synced";
  githubSyncAt: string;
} | null = null;

try {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_RELEASE_REPO) {
    githubSync = await syncPackageToGithubRelease({
      packageId: manifest.packageId,
      version: manifest.version,
      archivePath: targetPath,
      manifest,
      official: visibility === "official",
    });
  }
} catch (error) {
  console.warn(`GitHub release sync skipped/failed: ${error instanceof Error ? error.message : "unknown error"}`);
}

if (githubSync) {
  versionRecord.githubReleaseTag = githubSync.githubReleaseTag;
  versionRecord.githubReleaseUrl = githubSync.githubReleaseUrl;
  versionRecord.githubAssetUrl = githubSync.githubAssetUrl;
  versionRecord.githubSyncStatus = githubSync.githubSyncStatus;
  versionRecord.githubSyncAt = githubSync.githubSyncAt;
}

if (record) {
  record.latestVersion = manifest.version;
  record.visibility = visibility;
  record.reviewStatus = "published";
  if (githubSync) {
    record.githubReleaseTag = githubSync.githubReleaseTag;
    record.githubReleaseUrl = githubSync.githubReleaseUrl;
    record.githubAssetUrl = githubSync.githubAssetUrl;
    record.githubSyncStatus = githubSync.githubSyncStatus;
    record.githubSyncAt = githubSync.githubSyncAt;
  }
  record.versions = (record.versions || []).filter((item) => item.version !== manifest.version);
  record.versions.push(versionRecord);
} else {
  db.packages.push({
    packageId: manifest.packageId,
    name: manifest.name,
    type: manifest.type,
    latestVersion: manifest.version,
    visibility,
    reviewStatus: "published",
    githubReleaseTag: githubSync?.githubReleaseTag,
    githubReleaseUrl: githubSync?.githubReleaseUrl,
    githubAssetUrl: githubSync?.githubAssetUrl,
    githubSyncStatus: githubSync?.githubSyncStatus,
    githubSyncAt: githubSync?.githubSyncAt,
    versions: [versionRecord],
  });
}
db.auditLogs.push({
  id: createId("audit"),
  actorUserId: null,
  action: "publish_package_script",
  targetType: "package",
  targetId: manifest.packageId,
  metadata: { visibility, version: manifest.version },
  createdAt: new Date().toISOString(),
});
saveDatabase(db);
console.log(JSON.stringify({
  success: true,
  packageId: manifest.packageId,
  version: manifest.version,
  visibility,
  githubSyncStatus: githubSync?.githubSyncStatus || "pending",
  githubReleaseUrl: githubSync?.githubReleaseUrl || "",
  githubAssetUrl: githubSync?.githubAssetUrl || "",
}, null, 2));
