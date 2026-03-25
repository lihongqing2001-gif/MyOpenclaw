export type UserRole = "guest" | "user" | "reviewer" | "super_admin";
export type AuthProvider = "github" | "email";
export type GithubSyncStatus = "pending" | "synced" | "failed";
export type ResourceMirrorStatus = "official" | "mirrored" | "upstream-only";
export type CloudConsoleGrantStatus = "active" | "revoked" | "expired";

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
  resourceMeta?: {
    resourceType?: string;
    artifactType?: string;
    source?: {
      repository?: string;
      homepage?: string;
      license?: string;
      mirrorStatus?: ResourceMirrorStatus;
      upstreamRepository?: string;
      upstreamVersion?: string;
    };
    install?: {
      via?: string;
      command?: string;
      url?: string;
      notes?: string[];
    };
  };
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
    resourceMeta?: PackageRecord["resourceMeta"];
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

export interface AdminUserSummary {
  id: string;
  email: string;
  role: UserRole;
  primaryAuthProvider?: AuthProvider;
  linkedProviders?: AuthProvider[];
  githubUserId?: string;
  githubLogin?: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  sessionCount: number;
  activeSessionCount: number;
  submissionCount: number;
  reviewCount: number;
  auditCount: number;
  activeCloudGrantCount: number;
  lastActivityAt?: string;
  lastAuthAt?: string;
  recentAudit: AuditLogEntry[];
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

export interface CloudConsoleAccessCode {
  id: string;
  label: string;
  note?: string;
  codePreview: string;
  codeHash: string;
  maxUses: number;
  usedCount: number;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  lastRedeemedAt?: string;
  revokedAt?: string;
}

export interface CloudConsoleGrant {
  id: string;
  codeId: string;
  userId: string;
  userEmail: string;
  status: CloudConsoleGrantStatus;
  createdAt: string;
  expiresAt: string;
  lastLaunchedAt?: string;
  revokedAt?: string;
}

export interface GithubIntegrationSettings {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  releaseRepo: string;
  token: string;
}

export interface SmtpIntegrationSettings {
  provider: "custom" | "qq";
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
}

export interface AuthEmailSettings {
  codeTtlMinutes: number;
  resendCooldownSeconds: number;
  requestLimitPerWindow: number;
  requestWindowMinutes: number;
  verifyLimitPerWindow: number;
  verifyWindowMinutes: number;
}

export interface PlatformSettings {
  github: GithubIntegrationSettings;
  smtp: SmtpIntegrationSettings;
  authEmail: AuthEmailSettings;
}

export interface CloudConsoleAccessOverview {
  accessEnabled: boolean;
  publicBaseUrl: string;
  activeGrant: {
    id: string;
    codeId: string;
    expiresAt: string;
    lastLaunchedAt?: string;
  } | null;
}

export interface AdminCloudConsoleAccessSnapshot {
  accessEnabled: boolean;
  publicBaseUrl: string;
  codes: CloudConsoleAccessCode[];
  grants: CloudConsoleGrant[];
}

export interface CloudOpenClawSummary {
  consoleBaseUrl: string;
  reachable: boolean;
  health?: {
    status: string;
    heartbeat: {
      status: string;
      timestamp: number;
      agent: {
        id: string | null;
        online: boolean;
        lastSeenAt: number | null;
      };
      activeTasks: Array<{
        id: string;
        nodeId: string;
        nodeLabel: string;
        status: string;
        updatedAt: number;
        resultSummary?: string;
      }>;
      queuedTasks: Array<{
        id: string;
        nodeId: string;
        nodeLabel: string;
        status: string;
        updatedAt: number;
        resultSummary?: string;
      }>;
      recentTasks: Array<{
        id: string;
        nodeId: string;
        nodeLabel: string;
        status: string;
        updatedAt: number;
        resultSummary?: string;
      }>;
    };
  };
  controlPlane?: {
    assetRoot?: {
      path: string;
      configured: boolean;
    };
    decisionQueue?: Array<{
      id: string;
      priority: string;
      title: string;
      nextAction: string;
      status: string;
    }>;
  };
  localPackages?: Array<{
    packageId: string;
    name: string;
    type: string;
    activeVersion: string;
    distributionChannel?: string;
  }>;
  errors?: string[];
}
