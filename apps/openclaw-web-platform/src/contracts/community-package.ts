export type CommunityPackageType =
  | "skill-pack"
  | "sop-pack"
  | "demo-pack"
  | "tutorial-pack"
  | "case-pack";

export type CommunityPackageVisibility = "private" | "official" | "community";
export type CommunityResourceMirrorStatus = "official" | "mirrored" | "upstream-only";

export type CommunityPackageReviewStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export interface CommunityPackageManifest {
  schemaVersion: "community-package-v1";
  packageId: string;
  type: CommunityPackageType;
  name: string;
  version: string;
  author: {
    name: string;
    id?: string;
    homepage?: string;
  };
  description: string;
  source?: {
    kind?: "official" | "community" | "local-export";
    repository?: string;
    homepage?: string;
    license?: string;
    mirrorStatus?: CommunityResourceMirrorStatus;
    upstreamRepository?: string;
    upstreamVersion?: string;
    createdAt?: string;
  };
  install?: {
    via?: "forge-console" | "github" | "upstream";
    command?: string;
    url?: string;
    notes?: string[];
  };
  capabilities: Array<{
    id: string;
    label: string;
    summary?: string;
    entrypoint?: string;
  }>;
  dependencies: Array<{
    id: string;
    label: string;
    kind: "skill" | "foundation" | "integration" | "runtime" | "package";
    required: boolean;
    installCommand?: string;
    installUrl?: string;
    bundled?: boolean;
  }>;
  compatibility: {
    openclawMinVersion: string;
    installMode: "local-console";
    platforms?: string[];
  };
  permissions: Array<{
    key:
      | "filesystem.read"
      | "filesystem.write"
      | "process.exec"
      | "network.http"
      | "agent.orchestration"
      | "knowledge.write";
    required: boolean;
    reason: string;
  }>;
  checksums: {
    algorithm: "sha256";
    files: Array<{ path: string; sha256: string }>;
    archive?: { path?: string; sha256?: string };
  };
  docs: Array<{ title: string; path: string }>;
  assets: Array<{ path: string; kind: string; label?: string }>;
  reviewStatus: CommunityPackageReviewStatus;
  visibility: CommunityPackageVisibility;
  signature?: {
    algorithm?: string;
    value?: string;
    issuedBy?: string;
  };
}
