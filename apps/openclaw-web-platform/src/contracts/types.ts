export type UserRole = "guest" | "user" | "reviewer" | "super_admin";
export type AuthProvider = "github" | "email";
export type GithubSyncStatus = "pending" | "synced" | "failed";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  primaryAuthProvider?: AuthProvider;
  linkedProviders?: AuthProvider[];
  githubUserId?: string;
  githubLogin?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  csrfToken: string;
  twoFactorPassed: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface PackageRecord {
  packageId: string;
  name: string;
  type: string;
  latestVersion: string;
  visibility: "private" | "official" | "community";
  reviewStatus: SubmissionStatus;
  githubReleaseTag?: string;
  githubReleaseUrl?: string;
  githubAssetUrl?: string;
  githubPagesSourcePath?: string;
  githubSyncStatus?: GithubSyncStatus;
  githubSyncAt?: string;
  versions: Array<{
    version: string;
    archivePath: string;
    manifestPath: string;
    manifest: import("./community-package").CommunityPackageManifest;
    publishedAt?: string;
    githubReleaseTag?: string;
    githubReleaseUrl?: string;
    githubAssetUrl?: string;
    githubSyncStatus?: GithubSyncStatus;
    githubSyncAt?: string;
  }>;
}

export interface SubmissionRecord {
  id: string;
  packageId: string;
  authorUserId: string;
  status: SubmissionStatus;
  packageVersion: string;
  archivePath: string;
  manifestPath: string;
  githubReleaseTag?: string;
  githubReleaseUrl?: string;
  githubAssetUrl?: string;
  githubSyncStatus?: GithubSyncStatus;
  githubSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDecision {
  submissionId: string;
  reviewerUserId: string;
  action: "approve" | "request_changes" | "reject";
  note?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuthChallenge {
  id: string;
  email: string;
  code: string;
  expiresAt: string;
  createdAt: string;
}

export interface GithubOAuthState {
  id: string;
  mode: "login" | "link";
  userId?: string;
  redirectTo?: string;
  createdAt: string;
  expiresAt: string;
}

export interface SecurityEvent {
  id: string;
  category: string;
  detail: string;
  ip?: string;
  createdAt: string;
}
