import type {
  AdminCloudConsoleAccessSnapshot,
  AdminLocalComputeSnapshot,
  AuditLogEntry,
  CloudConsoleAccessCode,
  CloudConsoleAccessOverview,
  CloudOpenClawSummary,
  LocalComputeNode,
  LocalComputeTask,
  PackageRecord,
  SharedRuntimeSnapshot,
  SecurityEvent,
  SubmissionRecord,
  User,
  UserRole,
} from "@/contracts/types";

export interface SessionPayload {
  authenticated: boolean;
  user: User | null;
  csrfToken: string | null;
  twoFactorPassed: boolean;
  requiresAdminTwoFactor: boolean;
  githubOauthConfigured: boolean;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error)
          : `Request failed with ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function getSession() {
  return apiRequest<SessionPayload>("/auth/session");
}

export async function logout(csrfToken: string) {
  return apiRequest<{ success: true }>("/auth/logout", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({}),
  });
}

export async function requestEmailCode(email: string) {
  return apiRequest<{ success: boolean; delivery: string; debugCode?: string }>("/auth/email/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmailCode(email: string, code: string) {
  return apiRequest<{
    success: boolean;
    user: User;
    csrfToken: string;
    requiresAdminTwoFactor: boolean;
  }>("/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function verifyAdminTwoFactor(code: string, csrfToken: string) {
  return apiRequest<{ success: true }>("/auth/admin/2fa/verify", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({ code }),
  });
}

export async function getAdminTwoFactorSetup() {
  return apiRequest<{
    secret: string;
    otpauth: string;
    issuer: string;
    email: string;
  }>("/auth/admin/2fa/setup");
}

export async function getCloudConsoleAccess() {
  return apiRequest<CloudConsoleAccessOverview>("/cloud-console/access");
}

export async function redeemCloudConsoleAccessCode(code: string, csrfToken: string) {
  return apiRequest<{
    success: true;
    access: CloudConsoleAccessOverview;
    launchUrl: string;
  }>("/cloud-console/access/redeem", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({ code }),
  });
}

export async function launchCloudConsole(csrfToken: string) {
  return apiRequest<{
    success: true;
    access: CloudConsoleAccessOverview;
    launchUrl: string;
  }>("/cloud-console/access/launch", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({}),
  });
}

export async function getPackages() {
  return apiRequest<{ packages: PackageRecord[] }>("/packages");
}

export async function getForgeConsoleReleaseMeta() {
  return apiRequest<{
    available: boolean;
    fileName: string;
    updatedAt: string;
    version: string;
    artifactType: string;
    launchers: Record<string, string>;
    downloadUrl: string;
  }>("/downloads/forge-console/meta");
}

export async function getPackage(packageId: string) {
  return apiRequest<PackageRecord>(`/packages/${encodeURIComponent(packageId)}`);
}

export async function getPackageSource(packageId: string) {
  return apiRequest<{
    packageId: string;
    latestVersion: string;
    githubReleaseTag: string;
    githubReleaseUrl: string;
    githubAssetUrl: string;
    githubSyncStatus: string;
    githubSyncAt: string;
  }>(`/packages/${encodeURIComponent(packageId)}/source`);
}

export async function createSubmission(file: File, csrfToken: string) {
  const packageBase64 = await fileToBase64(file);
  return apiRequest<{ success: boolean; submissionId: string; packageId: string }>("/submissions", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({
      fileName: file.name,
      packageBase64,
    }),
  });
}

export async function validateSubmissionPackage(file: File, csrfToken: string) {
  const packageBase64 = await fileToBase64(file);
  return apiRequest<{
    success: boolean;
    manifest: {
      packageId: string;
      name: string;
      version: string;
      type: string;
      description: string;
      capabilities: number;
      dependencies: number;
      permissions: number;
      docs: number;
    };
  }>("/submissions/validate", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({
      fileName: file.name,
      packageBase64,
    }),
  });
}

export async function getMySubmissions() {
  return apiRequest<{ submissions: SubmissionRecord[] }>("/me/submissions");
}

export async function getReviewQueue() {
  return apiRequest<{ submissions: SubmissionRecord[] }>("/review/queue");
}

export async function reviewSubmission(
  submissionId: string,
  action: "approve" | "request_changes" | "reject",
  csrfToken: string,
  note = "",
) {
  return apiRequest<{ success: boolean; status: string }>(`/review/${encodeURIComponent(submissionId)}/${action}`, {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function publishSubmissionToGithub(submissionId: string, csrfToken: string) {
  return apiRequest<{ success: boolean; githubReleaseUrl?: string }>(
    `/publish/${encodeURIComponent(submissionId)}/github-release`,
    {
      method: "POST",
      headers: {
        "x-openclaw-csrf": csrfToken,
      },
      body: JSON.stringify({}),
    },
  );
}

export async function getAuditLogs() {
  return apiRequest<{ auditLogs: AuditLogEntry[] }>("/admin/audit-logs");
}

export async function getSecurityEvents() {
  return apiRequest<{ securityEvents: SecurityEvent[] }>("/admin/security-events");
}

export async function getPlatformSummary() {
  return apiRequest<{
    baseUrl: string;
    githubOauthConfigured: boolean;
    smtpConfigured: boolean;
    storage: {
      dataDir: string;
      releaseBundle: string;
      releaseBundleUpdatedAt: string;
    };
    counts: {
      users: number;
      sessions: number;
      submissions: number;
      packages: number;
      auditLogs: number;
      securityEvents: number;
    };
  }>("/admin/platform-summary");
}

export async function getAdminCloudConsoleAccessSnapshot() {
  return apiRequest<AdminCloudConsoleAccessSnapshot>("/admin/cloud-console/access-codes");
}

export async function createAdminCloudConsoleAccessCode(
  payload: {
    label: string;
    note?: string;
    expiresInHours?: number;
    maxUses?: number;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: true;
    code: CloudConsoleAccessCode;
    plainCode: string;
  }>("/admin/cloud-console/access-codes", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function revokeAdminCloudConsoleAccessCode(codeId: string, csrfToken: string) {
  return apiRequest<{ success: true }>(`/admin/cloud-console/access-codes/${encodeURIComponent(codeId)}/revoke`, {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify({}),
  });
}

export async function getAdminLocalComputeSnapshot() {
  return apiRequest<AdminLocalComputeSnapshot>("/admin/local-compute/nodes");
}

export async function registerAdminLocalComputeNode(
  payload: {
    label: string;
    allowedPackageIds?: string[];
    allowedNodeIds?: string[];
    sharingMode?: "author-only" | "trusted-shared";
    sharedWithEmails?: string[];
    allowedPathScopes?: string[];
    allowedAuthCapabilities?: string[];
    capabilities?: Array<{ id: string; label: string; kind: "package" | "skill-node" | "system"; command?: string }>;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: true;
    node: LocalComputeNode;
    plainToken: string;
  }>("/admin/local-compute/nodes/register", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminLocalComputeNodeSharePolicy(
  nodeId: string,
  payload: {
    sharingMode: "author-only" | "trusted-shared";
    sharedWithEmails?: string[];
    allowedPathScopes?: string[];
    allowedAuthCapabilities?: string[];
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: true;
    node: LocalComputeNode;
  }>(`/admin/local-compute/nodes/${encodeURIComponent(nodeId)}/share-policy`, {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function createAdminLocalComputeTask(
  payload: {
    nodeId: string;
    taskKind: "package" | "skill-node";
    packageId?: string;
    packageVersion?: string;
    targetNodeId?: string;
    targetLabel?: string;
    command?: string;
    inputValues?: Record<string, string>;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: true;
    task: LocalComputeTask;
  }>("/admin/local-compute/tasks", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getMySharedRuntimeSnapshot() {
  return apiRequest<SharedRuntimeSnapshot>("/me/shared-runtime");
}

export async function createMySharedRuntimeTask(
  payload: {
    nodeId: string;
    taskKind: "package" | "skill-node";
    packageId?: string;
    packageVersion?: string;
    targetNodeId?: string;
    targetLabel?: string;
    command?: string;
    inputValues?: Record<string, string>;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: true;
    task: LocalComputeTask;
  }>("/me/shared-runtime/tasks", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getCloudOpenClawSummary() {
  return apiRequest<CloudOpenClawSummary>("/admin/cloud-openclaw/summary");
}

export async function getCloudOpenClawSkillTree() {
  return apiRequest<{
    nodes: Array<{
      id: string;
      level: 1 | 2 | 3;
      label: string;
      parentId: string | null;
      drawerContent?: {
        summary?: string;
        invoke?: string;
        commands?: string[];
        inputs?: Array<{
          field: string;
          required?: boolean;
          placeholder?: string;
        }>;
      };
    }>;
    source: string;
  }>("/admin/cloud-openclaw/skill-tree");
}

export async function queueCloudOpenClawExecution(
  payload: {
    nodeId: string;
    command: string;
    inputValues: Record<string, string>;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: boolean;
    task: {
      id: string;
      nodeId: string;
      nodeLabel: string;
      status: string;
    };
  }>("/admin/cloud-openclaw/execute", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function installCloudOpenClawPackage(
  payload: {
    packageId: string;
    version?: string;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: boolean;
    packageId: string;
    version: string;
    installPath: string;
  }>("/admin/cloud-openclaw/packages/install-official", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getGithubSettings() {
  return apiRequest<{
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    releaseRepo: string;
    token: string;
  }>("/admin/settings/github");
}

export async function saveGithubSettings(
  payload: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    releaseRepo: string;
    token: string;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: boolean;
    githubOauthConfigured: boolean;
  }>("/admin/settings/github", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getSmtpSettings() {
  return apiRequest<{
    provider: "custom" | "qq";
    host: string;
    port: string;
    user: string;
    pass: string;
    from: string;
  }>("/admin/settings/smtp");
}

export async function saveSmtpSettings(
  payload: {
    provider: "custom" | "qq";
    host: string;
    port: string;
    user: string;
    pass: string;
    from: string;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: boolean;
    smtpConfigured: boolean;
  }>("/admin/settings/smtp", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function sendSmtpTestEmail(
  payload: {
    to: string;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: boolean;
    delivered: boolean;
  }>("/admin/settings/smtp/test", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export async function getAuthEmailSettings() {
  return apiRequest<{
    codeTtlMinutes: number;
    resendCooldownSeconds: number;
    requestLimitPerWindow: number;
    requestWindowMinutes: number;
    verifyLimitPerWindow: number;
    verifyWindowMinutes: number;
  }>("/admin/settings/auth-email");
}

export async function saveAuthEmailSettings(
  payload: {
    codeTtlMinutes: number;
    resendCooldownSeconds: number;
    requestLimitPerWindow: number;
    requestWindowMinutes: number;
    verifyLimitPerWindow: number;
    verifyWindowMinutes: number;
  },
  csrfToken: string,
) {
  return apiRequest<{
    success: boolean;
    settings: {
      codeTtlMinutes: number;
      resendCooldownSeconds: number;
      requestLimitPerWindow: number;
      requestWindowMinutes: number;
      verifyLimitPerWindow: number;
      verifyWindowMinutes: number;
    };
  }>("/admin/settings/auth-email", {
    method: "POST",
    headers: {
      "x-openclaw-csrf": csrfToken,
    },
    body: JSON.stringify(payload),
  });
}

export function isRoleAllowed(role: UserRole | undefined, allowed: UserRole[]) {
  return role ? allowed.includes(role) : false;
}
