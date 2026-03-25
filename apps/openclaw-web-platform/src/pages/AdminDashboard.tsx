import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Bot, Database, KeyRound, Package, Settings, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createAdminLocalComputeTask,
  createAdminCloudConsoleAccessCode,
  getAdminLocalComputeSnapshot,
  getAdminCloudConsoleAccessSnapshot,
  getAuditLogs,
  getGithubSettings,
  registerAdminLocalComputeNode,
  getPackages,
  getPlatformSummary,
  getReviewQueue,
  getAuthEmailSettings,
  getSmtpSettings,
  getSecurityEvents,
  revokeAdminCloudConsoleAccessCode,
  saveAuthEmailSettings,
  saveGithubSettings,
  saveSmtpSettings,
  sendSmtpTestEmail,
  updateAdminLocalComputeNodeSharePolicy,
} from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { usePlatform } from "@/lib/platform";

export function AdminDashboard() {
  const { session, refreshSession } = usePlatform();
  const [packages, setPackages] = useState<Awaited<ReturnType<typeof getPackages>>["packages"]>([]);
  const [packageCount, setPackageCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [securityCount, setSecurityCount] = useState(0);
  const [activity, setActivity] = useState<Array<{ action: string; target: string; actor: string; createdAt: string }>>([]);
  const [platformSummary, setPlatformSummary] = useState<null | Awaited<ReturnType<typeof getPlatformSummary>>>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [cloudConsoleSnapshot, setCloudConsoleSnapshot] = useState<null | Awaited<ReturnType<typeof getAdminCloudConsoleAccessSnapshot>>>(null);
  const [cloudConsoleForm, setCloudConsoleForm] = useState({
    label: "SoloCore Cloud Trial",
    note: "",
    expiresInHours: "72",
    maxUses: "1",
  });
  const [cloudConsoleMessage, setCloudConsoleMessage] = useState("");
  const [latestCloudConsoleCode, setLatestCloudConsoleCode] = useState("");
  const [localComputeSnapshot, setLocalComputeSnapshot] = useState<null | Awaited<ReturnType<typeof getAdminLocalComputeSnapshot>>>(null);
  const [localComputeForm, setLocalComputeForm] = useState({
    label: "Mobei Local Node",
    allowedPackageIds: "",
    allowedNodeIds: "",
    sharingMode: "author-only" as "author-only" | "trusted-shared",
    sharedWithEmails: "",
    allowedPathScopes: "",
    allowedAuthCapabilities: "",
  });
  const [localComputeShareForms, setLocalComputeShareForms] = useState<Record<string, {
    sharingMode: "author-only" | "trusted-shared";
    sharedWithEmails: string;
    allowedPathScopes: string;
    allowedAuthCapabilities: string;
  }>>({});
  const [localComputeTaskForm, setLocalComputeTaskForm] = useState({
    nodeId: "",
    taskKind: "package" as "package" | "skill-node",
    packageId: "",
    targetNodeId: "",
    targetLabel: "",
    command: "",
    inputValuesJson: "{}",
  });
  const [localComputeMessage, setLocalComputeMessage] = useState("");
  const [latestLocalComputeToken, setLatestLocalComputeToken] = useState("");
  const [latestLocalComputeNodeId, setLatestLocalComputeNodeId] = useState("");
  const [githubForm, setGithubForm] = useState({
    clientId: "",
    clientSecret: "",
    callbackUrl: "",
    releaseRepo: "",
    token: "",
  });
  const [smtpForm, setSmtpForm] = useState({
    provider: "qq" as "custom" | "qq",
    host: "smtp.qq.com",
    port: "465",
    user: "",
    pass: "",
    from: "",
    testTo: "",
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [smtpMessage, setSmtpMessage] = useState("");
  const [authEmailForm, setAuthEmailForm] = useState({
    codeTtlMinutes: "10",
    resendCooldownSeconds: "30",
    requestLimitPerWindow: "8",
    requestWindowMinutes: "15",
    verifyLimitPerWindow: "10",
    verifyWindowMinutes: "15",
  });
  const [authEmailMessage, setAuthEmailMessage] = useState("");
  const [error, setError] = useState("");
  const activeCloudCodes = (cloudConsoleSnapshot?.codes || []).filter((code) => !code.revokedAt);
  const activeCloudGrants = (cloudConsoleSnapshot?.grants || []).filter((grant) => grant.status === "active");
  const onlineLocalComputeNodes = (localComputeSnapshot?.nodes || []).filter((node) => node.status === "online" || node.status === "busy");

  async function refreshCloudConsoleSnapshot() {
    const snapshot = await getAdminCloudConsoleAccessSnapshot();
    setCloudConsoleSnapshot(snapshot);
  }

  async function refreshLocalComputeSnapshot() {
    const snapshot = await getAdminLocalComputeSnapshot();
    setLocalComputeSnapshot(snapshot);
    setLocalComputeShareForms(
      Object.fromEntries(
        snapshot.nodes.map((node) => [
          node.nodeId,
          {
            sharingMode: node.sharingMode || "author-only",
            sharedWithEmails: (node.sharedWithUsers || []).map((user) => user.email).join("\n"),
            allowedPathScopes: (node.allowedPathScopes || []).join("\n"),
            allowedAuthCapabilities: (node.allowedAuthCapabilities || []).join("\n"),
          },
        ]),
      ),
    );
    setLocalComputeTaskForm((current) => ({
      ...current,
      nodeId: current.nodeId || snapshot.nodes[0]?.nodeId || "",
      packageId: current.packageId || "",
    }));
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getPackages(), getReviewQueue(), getAuditLogs(), getSecurityEvents(), getPlatformSummary(), getGithubSettings(), getSmtpSettings(), getAuthEmailSettings(), getAdminCloudConsoleAccessSnapshot(), getAdminLocalComputeSnapshot()])
      .then(([packages, reviewQueue, auditLogs, securityEvents, summary, githubSettings, smtpSettings, authEmailSettings, consoleSnapshot, localCompute]) => {
        if (cancelled) return;
        setPackages(packages.packages);
        setPackageCount(packages.packages.length);
        setReviewCount(reviewQueue.submissions.length);
        setAuditCount(auditLogs.auditLogs.length);
        setSecurityCount(securityEvents.securityEvents.length);
        setPlatformSummary(summary);
        setGithubForm(githubSettings);
        setSmtpForm((cur) => ({
          ...cur,
          provider: smtpSettings.provider,
          host: smtpSettings.host || (smtpSettings.provider === "qq" ? "smtp.qq.com" : ""),
          port: smtpSettings.port || (smtpSettings.provider === "qq" ? "465" : "587"),
          user: smtpSettings.user,
          pass: smtpSettings.pass,
          from: smtpSettings.from,
          testTo: smtpSettings.user,
        }));
        setAuthEmailForm({
          codeTtlMinutes: String(authEmailSettings.codeTtlMinutes),
          resendCooldownSeconds: String(authEmailSettings.resendCooldownSeconds),
          requestLimitPerWindow: String(authEmailSettings.requestLimitPerWindow),
          requestWindowMinutes: String(authEmailSettings.requestWindowMinutes),
          verifyLimitPerWindow: String(authEmailSettings.verifyLimitPerWindow),
          verifyWindowMinutes: String(authEmailSettings.verifyWindowMinutes),
        });
        setCloudConsoleSnapshot(consoleSnapshot);
        setLocalComputeSnapshot(localCompute);
        setLocalComputeShareForms(
          Object.fromEntries(
            localCompute.nodes.map((node) => [
              node.nodeId,
              {
                sharingMode: node.sharingMode || "author-only",
                sharedWithEmails: (node.sharedWithUsers || []).map((user) => user.email).join("\n"),
                allowedPathScopes: (node.allowedPathScopes || []).join("\n"),
                allowedAuthCapabilities: (node.allowedAuthCapabilities || []).join("\n"),
              },
            ]),
          ),
        );
        setLocalComputeTaskForm((current) => ({
          ...current,
          nodeId: current.nodeId || localCompute.nodes[0]?.nodeId || "",
          packageId: current.packageId || packages.packages[0]?.packageId || "",
        }));
        setActivity(
          auditLogs.auditLogs
            .slice(-4)
            .reverse()
            .map((item) => ({
              action: item.action,
              target: item.targetId,
              actor: item.actorUserId || "system",
              createdAt: item.createdAt,
            })),
        );
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load admin dashboard");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveGithubSettings() {
    if (!session?.csrfToken) {
      return;
    }
    try {
      const response = await saveGithubSettings(githubForm, session.csrfToken);
      setSettingsMessage(response.githubOauthConfigured ? "GitHub OAuth settings saved." : "Settings saved, but GitHub OAuth is still incomplete.");
      await refreshSession();
    } catch (cause) {
      setSettingsMessage(cause instanceof Error ? cause.message : "Failed to save GitHub settings");
    }
  }

  async function handleSaveSmtpSettings() {
    if (!session?.csrfToken) {
      return;
    }
    try {
      const payload = {
        provider: smtpForm.provider,
        host: smtpForm.provider === "qq" ? "smtp.qq.com" : smtpForm.host,
        port: smtpForm.provider === "qq" ? "465" : smtpForm.port,
        user: smtpForm.user,
        pass: smtpForm.pass,
        from: smtpForm.from || (smtpForm.user ? `SoloCore Hub <${smtpForm.user}>` : ""),
      };
      const response = await saveSmtpSettings(payload, session.csrfToken);
      setSmtpForm((cur) => ({
        ...cur,
        host: payload.host,
        port: payload.port,
        from: payload.from,
        testTo: cur.testTo || payload.user,
      }));
      setSmtpMessage(response.smtpConfigured ? "SMTP settings saved." : "SMTP settings saved, but configuration is still incomplete.");
      await refreshSession();
    } catch (cause) {
      setSmtpMessage(cause instanceof Error ? cause.message : "Failed to save SMTP settings");
    }
  }

  async function handleSendSmtpTest() {
    if (!session?.csrfToken) {
      return;
    }
    try {
      const response = await sendSmtpTestEmail({ to: smtpForm.testTo || smtpForm.user }, session.csrfToken);
      setSmtpMessage(response.delivered ? "SMTP test email sent." : "SMTP test request completed, but delivery was not confirmed.");
    } catch (cause) {
      setSmtpMessage(cause instanceof Error ? cause.message : "Failed to send SMTP test email");
    }
  }

  async function handleSaveAuthEmailSettings() {
    if (!session?.csrfToken) {
      return;
    }
    try {
      const response = await saveAuthEmailSettings({
        codeTtlMinutes: Number(authEmailForm.codeTtlMinutes || 10),
        resendCooldownSeconds: Number(authEmailForm.resendCooldownSeconds || 30),
        requestLimitPerWindow: Number(authEmailForm.requestLimitPerWindow || 8),
        requestWindowMinutes: Number(authEmailForm.requestWindowMinutes || 15),
        verifyLimitPerWindow: Number(authEmailForm.verifyLimitPerWindow || 10),
        verifyWindowMinutes: Number(authEmailForm.verifyWindowMinutes || 15),
      }, session.csrfToken);
      setAuthEmailForm({
        codeTtlMinutes: String(response.settings.codeTtlMinutes),
        resendCooldownSeconds: String(response.settings.resendCooldownSeconds),
        requestLimitPerWindow: String(response.settings.requestLimitPerWindow),
        requestWindowMinutes: String(response.settings.requestWindowMinutes),
        verifyLimitPerWindow: String(response.settings.verifyLimitPerWindow),
        verifyWindowMinutes: String(response.settings.verifyWindowMinutes),
      });
      setAuthEmailMessage("Email login policy saved.");
    } catch (cause) {
      setAuthEmailMessage(cause instanceof Error ? cause.message : "Failed to save email login policy");
    }
  }

  async function handleCreateCloudConsoleCode() {
    if (!session?.csrfToken) {
      return;
    }
    try {
      const response = await createAdminCloudConsoleAccessCode(
        {
          label: cloudConsoleForm.label,
          note: cloudConsoleForm.note || undefined,
          expiresInHours: Number(cloudConsoleForm.expiresInHours || 72),
          maxUses: Number(cloudConsoleForm.maxUses || 1),
        },
        session.csrfToken,
      );
      setLatestCloudConsoleCode(response.plainCode);
      setCloudConsoleMessage("Authorization code created. Copy it now and distribute it from Hub.");
      await refreshCloudConsoleSnapshot();
    } catch (cause) {
      setCloudConsoleMessage(cause instanceof Error ? cause.message : "Failed to create authorization code");
    }
  }

  async function handleRevokeCloudConsoleCode(codeId: string) {
    if (!session?.csrfToken) {
      return;
    }
    try {
      await revokeAdminCloudConsoleAccessCode(codeId, session.csrfToken);
      setCloudConsoleMessage("Authorization code revoked.");
      setLatestCloudConsoleCode("");
      await refreshCloudConsoleSnapshot();
    } catch (cause) {
      setCloudConsoleMessage(cause instanceof Error ? cause.message : "Failed to revoke authorization code");
    }
  }

  async function handleCreateLocalComputeNode() {
    if (!session?.csrfToken) {
      return;
    }
    try {
      const response = await registerAdminLocalComputeNode({
        label: localComputeForm.label,
        allowedPackageIds: localComputeForm.allowedPackageIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        allowedNodeIds: localComputeForm.allowedNodeIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        sharingMode: localComputeForm.sharingMode,
        sharedWithEmails: localComputeForm.sharedWithEmails.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        allowedPathScopes: localComputeForm.allowedPathScopes.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        allowedAuthCapabilities: localComputeForm.allowedAuthCapabilities.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      }, session.csrfToken);
      setLatestLocalComputeToken(response.plainToken);
      setLatestLocalComputeNodeId(response.node.nodeId);
      setLocalComputeMessage("Local compute node registered. Copy the node token now and start the local bridge script on your machine.");
      await refreshLocalComputeSnapshot();
    } catch (cause) {
      setLocalComputeMessage(cause instanceof Error ? cause.message : "Failed to register local compute node");
    }
  }

  async function handleCreateLocalComputeTask() {
    if (!session?.csrfToken || !localComputeTaskForm.nodeId) {
      return;
    }
    try {
      const inputValues = JSON.parse(localComputeTaskForm.inputValuesJson || "{}") as Record<string, string>;
      const response = await createAdminLocalComputeTask({
        nodeId: localComputeTaskForm.nodeId,
        taskKind: localComputeTaskForm.taskKind,
        packageId: localComputeTaskForm.taskKind === "package" ? localComputeTaskForm.packageId : undefined,
        targetNodeId: localComputeTaskForm.taskKind === "skill-node" ? localComputeTaskForm.targetNodeId : undefined,
        targetLabel: localComputeTaskForm.taskKind === "skill-node" ? localComputeTaskForm.targetLabel : undefined,
        command: localComputeTaskForm.taskKind === "skill-node" ? localComputeTaskForm.command : undefined,
        inputValues,
      }, session.csrfToken);
      setLocalComputeMessage(`Queued local compute task: ${response.task.targetLabel} (${response.task.id})`);
      await refreshLocalComputeSnapshot();
    } catch (cause) {
      setLocalComputeMessage(cause instanceof Error ? cause.message : "Failed to queue local compute task");
    }
  }

  async function handleSaveLocalComputeSharePolicy(nodeId: string) {
    if (!session?.csrfToken) {
      return;
    }
    const form = localComputeShareForms[nodeId];
    if (!form) {
      return;
    }
    try {
      await updateAdminLocalComputeNodeSharePolicy(nodeId, {
        sharingMode: form.sharingMode,
        sharedWithEmails: form.sharedWithEmails.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        allowedPathScopes: form.allowedPathScopes.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        allowedAuthCapabilities: form.allowedAuthCapabilities.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      }, session.csrfToken);
      setLocalComputeMessage(`Updated sharing policy for ${nodeId}.`);
      await refreshLocalComputeSnapshot();
    } catch (cause) {
      setLocalComputeMessage(cause instanceof Error ? cause.message : "Failed to update sharing policy");
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-400">Platform overview and management.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowSettings((value) => !value)}>
            <Settings className="w-4 h-4" />
            Platform Settings
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-8 rounded-3xl border border-slate-800/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(18,30,58,0.92))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6 items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-900/40 bg-blue-950/30 px-3 py-1 text-xs uppercase tracking-[0.22em] text-blue-200">
              Super Admin Control Plane
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Moderation, cloud access, and runtime controls live here.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Normal users should only see Community, package details, and their own account. Review queue, cloud authorization codes,
                security logs, and runtime operations stay inside this administrator surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/review">
                <Button className="gap-2 shadow-sm shadow-blue-950/30">
                  <ShieldCheck className="w-4 h-4" />
                  Review Moderation
                </Button>
              </Link>
              <Link to="/cloud-console">
                <Button variant="outline" className="gap-2 border-slate-700 text-slate-200 hover:bg-slate-800">
                  <KeyRound className="w-4 h-4" />
                  Cloud Access Entry
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Pending Review</div>
              <div className="mt-2 text-3xl font-semibold text-white">{reviewCount}</div>
              <div className="mt-1 text-xs text-slate-400">Packages waiting for admin review</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Access Codes</div>
              <div className="mt-2 text-3xl font-semibold text-white">{activeCloudCodes.length}</div>
              <div className="mt-1 text-xs text-slate-400">Admin-issued Cloud SoloCore authorization codes</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Grants</div>
              <div className="mt-2 text-3xl font-semibold text-white">{activeCloudGrants.length}</div>
              <div className="mt-1 text-xs text-slate-400">Users currently holding live cloud-console grants</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Local Compute Nodes</div>
              <div className="mt-2 text-3xl font-semibold text-white">{onlineLocalComputeNodes.length}</div>
              <div className="mt-1 text-xs text-slate-400">Admin-only local compute nodes currently online</div>
            </div>
          </div>
        </div>
      </div>

      {(showSettings || showStorage) && platformSummary && (
        <>
          <div className="mb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-blue-300/80">Platform Config</div>
            <h2 className="mt-1 text-xl font-semibold text-white">GitHub, email delivery, and policy settings</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
          {showSettings && (
            <Card className="border-slate-800/60 bg-[#0f172a]/50">
              <CardHeader>
                <CardTitle className="text-lg">Platform Settings</CardTitle>
                <CardDescription>Current runtime and integration status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div>Base URL: <span className="font-mono text-slate-100">{platformSummary.baseUrl}</span></div>
                <div>GitHub OAuth: <span className="font-medium">{platformSummary.githubOauthConfigured ? "Configured" : "Not configured"}</span></div>
                <div>SMTP Delivery: <span className="font-medium">{platformSummary.smtpConfigured ? "Configured" : "Console fallback"}</span></div>
                <div>SoloCore Console Bundle: <span className="font-medium">{platformSummary.storage.releaseBundle ? "Available" : "Missing"}</span></div>
                <div className="grid gap-3 pt-2">
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="GitHub Client ID" value={githubForm.clientId} onChange={(e) => setGithubForm((cur) => ({ ...cur, clientId: e.target.value }))} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="GitHub Client Secret" value={githubForm.clientSecret} onChange={(e) => setGithubForm((cur) => ({ ...cur, clientSecret: e.target.value }))} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="GitHub Callback URL" value={githubForm.callbackUrl} onChange={(e) => setGithubForm((cur) => ({ ...cur, callbackUrl: e.target.value }))} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="GitHub Release Repo (owner/repo)" value={githubForm.releaseRepo} onChange={(e) => setGithubForm((cur) => ({ ...cur, releaseRepo: e.target.value }))} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="GitHub Token (optional for release sync)" value={githubForm.token} onChange={(e) => setGithubForm((cur) => ({ ...cur, token: e.target.value }))} />
                  <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => void handleSaveGithubSettings()}>
                    Save GitHub Settings
                  </Button>
                  {settingsMessage && <div className="text-xs text-slate-400">{settingsMessage}</div>}
                </div>
                <div className="grid gap-3 pt-6 border-t border-slate-800/60">
                  <div className="text-sm font-medium text-slate-100">SMTP / Email Login</div>
                  <div className="text-xs text-slate-500">QQ 邮箱建议使用 `smtp.qq.com` + `465` + 邮箱授权码，不是 QQ 登录密码。</div>
                  <select
                    className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm"
                    value={smtpForm.provider}
                    onChange={(e) => {
                      const provider = e.target.value === "custom" ? "custom" : "qq";
                      setSmtpForm((cur) => ({
                        ...cur,
                        provider,
                        host: provider === "qq" ? "smtp.qq.com" : cur.host,
                        port: provider === "qq" ? "465" : cur.port,
                      }));
                    }}
                  >
                    <option value="qq">QQ Mail</option>
                    <option value="custom">Custom SMTP</option>
                  </select>
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="SMTP Host" value={smtpForm.host} onChange={(e) => setSmtpForm((cur) => ({ ...cur, host: e.target.value }))} disabled={smtpForm.provider === "qq"} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="SMTP Port" value={smtpForm.port} onChange={(e) => setSmtpForm((cur) => ({ ...cur, port: e.target.value }))} disabled={smtpForm.provider === "qq"} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="QQ 邮箱 / SMTP 用户名" value={smtpForm.user} onChange={(e) => setSmtpForm((cur) => ({ ...cur, user: e.target.value }))} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="QQ 邮箱授权码" value={smtpForm.pass} onChange={(e) => setSmtpForm((cur) => ({ ...cur, pass: e.target.value }))} />
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="From" value={smtpForm.from} onChange={(e) => setSmtpForm((cur) => ({ ...cur, from: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => void handleSaveSmtpSettings()}>
                      Save SMTP Settings
                    </Button>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => void handleSendSmtpTest()}>
                      Send Test Email
                    </Button>
                  </div>
                  <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Test recipient email" value={smtpForm.testTo} onChange={(e) => setSmtpForm((cur) => ({ ...cur, testTo: e.target.value }))} />
                  {smtpMessage && <div className="text-xs text-slate-400">{smtpMessage}</div>}
                </div>
                <div className="grid gap-3 pt-6 border-t border-slate-800/60">
                  <div className="text-sm font-medium text-slate-100">Email Login Policy</div>
                  <div className="text-xs text-slate-500">控制验证码有效期、每邮箱重发冷却、请求窗口和验证窗口。</div>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Code TTL (minutes)" value={authEmailForm.codeTtlMinutes} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, codeTtlMinutes: e.target.value }))} />
                    <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Resend cooldown (seconds)" value={authEmailForm.resendCooldownSeconds} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, resendCooldownSeconds: e.target.value }))} />
                    <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Request limit / window" value={authEmailForm.requestLimitPerWindow} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, requestLimitPerWindow: e.target.value }))} />
                    <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Request window (minutes)" value={authEmailForm.requestWindowMinutes} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, requestWindowMinutes: e.target.value }))} />
                    <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Verify limit / window" value={authEmailForm.verifyLimitPerWindow} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, verifyLimitPerWindow: e.target.value }))} />
                    <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Verify window (minutes)" value={authEmailForm.verifyWindowMinutes} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, verifyWindowMinutes: e.target.value }))} />
                  </div>
                  <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => void handleSaveAuthEmailSettings()}>
                    Save Email Login Policy
                  </Button>
                  {authEmailMessage && <div className="text-xs text-slate-400">{authEmailMessage}</div>}
                </div>
              </CardContent>
            </Card>
          )}
          {showStorage && (
            <Card className="border-slate-800/60 bg-[#0f172a]/50">
              <CardHeader>
                <CardTitle className="text-lg">Storage State</CardTitle>
                <CardDescription>Current data roots and file-backed counts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div>Users: <span className="font-medium">{platformSummary.counts.users}</span></div>
                <div>Sessions: <span className="font-medium">{platformSummary.counts.sessions}</span></div>
                <div>Submissions: <span className="font-medium">{platformSummary.counts.submissions}</span></div>
                <div>Packages: <span className="font-medium">{platformSummary.counts.packages}</span></div>
                <div className="font-mono text-xs break-all text-slate-400">{platformSummary.storage.releaseBundle || "No bundle path available"}</div>
              </CardContent>
            </Card>
          )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Audit Events</CardTitle>
            <Users className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{auditCount}</div>
            <p className="text-xs text-emerald-400 mt-1">Tracked in local storage</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Published Packages</CardTitle>
            <Package className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{packageCount}</div>
            <p className="text-xs text-emerald-400 mt-1">Visible in SoloCore Hub</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pending Reviews</CardTitle>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{reviewCount}</div>
            <p className="text-xs text-amber-400 mt-1">Review queue items</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Security Events</CardTitle>
            <Activity className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{securityCount}</div>
            <p className="text-xs text-slate-500 mt-1">Operational signals recorded</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Cloud Access Codes</CardTitle>
            <KeyRound className="w-4 h-4 text-blue-300" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeCloudCodes.length}</div>
            <p className="text-xs text-blue-200/80 mt-1">Admin-only cloud access control</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <div className="text-xs uppercase tracking-[0.2em] text-blue-300/80">Cloud Access Center</div>
        <h2 className="mt-1 text-xl font-semibold text-white">Generate and manage Cloud SoloCore authorization codes</h2>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card id="cloud-access-admin" className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Cloud Console Authorization Codes</CardTitle>
            <CardDescription>
              Generate Hub-managed codes that let signed-in users enter the separate cloud SoloCore Console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div>
              Access URL:{" "}
              <span className="font-mono text-slate-100 break-all">
                {cloudConsoleSnapshot?.publicBaseUrl || "not configured"}
              </span>
            </div>
            <div>
              Access Mode:{" "}
              <span className="font-medium text-slate-100">
                {cloudConsoleSnapshot?.accessEnabled ? "Enabled" : "Missing secret or public URL"}
              </span>
            </div>
            <div className="grid gap-3 pt-2">
              <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Label" value={cloudConsoleForm.label} onChange={(e) => setCloudConsoleForm((cur) => ({ ...cur, label: e.target.value }))} />
              <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Note for admin handoff" value={cloudConsoleForm.note} onChange={(e) => setCloudConsoleForm((cur) => ({ ...cur, note: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Expires in hours" value={cloudConsoleForm.expiresInHours} onChange={(e) => setCloudConsoleForm((cur) => ({ ...cur, expiresInHours: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Max uses" value={cloudConsoleForm.maxUses} onChange={(e) => setCloudConsoleForm((cur) => ({ ...cur, maxUses: e.target.value }))} />
              </div>
              <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => void handleCreateCloudConsoleCode()}>
                Create Authorization Code
              </Button>
              {latestCloudConsoleCode ? (
                <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-300 mb-2">Copy Now</div>
                  <div className="font-mono text-emerald-100 break-all">{latestCloudConsoleCode}</div>
                </div>
              ) : null}
              {cloudConsoleMessage ? <div className="text-xs text-slate-400">{cloudConsoleMessage}</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Codes</CardTitle>
            <CardDescription>
              Review issued codes and revoke them if a handoff changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            {(cloudConsoleSnapshot?.codes || []).slice(0, 6).map((code) => (
              <div key={code.id} className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{code.label}</div>
                    <div className="text-xs text-slate-500 font-mono">{code.codePreview}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={() => void handleRevokeCloudConsoleCode(code.id)}
                    disabled={Boolean(code.revokedAt)}
                  >
                    {code.revokedAt ? "Revoked" : "Revoke"}
                  </Button>
                </div>
                <div className="text-xs text-slate-400">
                  Uses {code.usedCount}/{code.maxUses} · expires {new Date(code.expiresAt).toLocaleString()}
                </div>
                {code.note ? <div className="text-xs text-slate-500">{code.note}</div> : null}
              </div>
            ))}
            {!cloudConsoleSnapshot?.codes?.length ? (
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-slate-500">
                No authorization codes issued yet.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <div className="text-xs uppercase tracking-[0.2em] text-blue-300/80">Review Center</div>
        <h2 className="mt-1 text-xl font-semibold text-white">Moderation and audit operations</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map((log, index) => (
              <div key={`${log.action}-${index}`} className="flex items-start justify-between border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-200">{log.action}</p>
                  <p className="text-xs text-slate-500 font-mono mt-1">{log.target}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{log.actor}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatRelativeDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Administrator-only control surface.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Link to="/review">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                Review Queue
              </Button>
            </Link>
            <a href="/admin/audit-logs" target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                <Users className="w-6 h-6 text-indigo-400" />
                Audit Logs
              </Button>
            </a>
            <Button variant="outline" className="w-full h-24 flex-col gap-2 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setShowStorage((value) => !value)}>
              <Database className="w-6 h-6 text-emerald-400" />
              Storage State
            </Button>
            <a href="/admin/security-events" target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                Security Logs
              </Button>
            </a>
            <a href="#cloud-access-admin">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                <KeyRound className="w-6 h-6 text-blue-300" />
                Access Codes
              </Button>
            </a>
            <Link to="/admin/cloud-openclaw">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                <Bot className="w-6 h-6 text-emerald-400" />
                Runtime Ops
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <div className="text-xs uppercase tracking-[0.2em] text-blue-300/80">Local Compute Nodes</div>
        <h2 className="mt-1 text-xl font-semibold text-white">Private local-first compute nodes for super admins</h2>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Register Local Node</CardTitle>
            <CardDescription>Create a node token and whitelist the packages / SOP nodes this machine is allowed to run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Node label" value={localComputeForm.label} onChange={(e) => setLocalComputeForm((current) => ({ ...current, label: e.target.value }))} />
            <textarea className="min-h-24 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Allowed package IDs, one per line or comma-separated" value={localComputeForm.allowedPackageIds} onChange={(e) => setLocalComputeForm((current) => ({ ...current, allowedPackageIds: e.target.value }))} />
            <textarea className="min-h-24 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Allowed skill node IDs, one per line or comma-separated" value={localComputeForm.allowedNodeIds} onChange={(e) => setLocalComputeForm((current) => ({ ...current, allowedNodeIds: e.target.value }))} />
            <select className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" value={localComputeForm.sharingMode} onChange={(e) => setLocalComputeForm((current) => ({ ...current, sharingMode: e.target.value === "trusted-shared" ? "trusted-shared" : "author-only" }))}>
              <option value="author-only">Author only</option>
              <option value="trusted-shared">Trusted shared runtime</option>
            </select>
            <textarea className="min-h-24 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Trusted user emails, one per line or comma-separated" value={localComputeForm.sharedWithEmails} onChange={(e) => setLocalComputeForm((current) => ({ ...current, sharedWithEmails: e.target.value }))} />
            <textarea className="min-h-20 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Allowed path scopes for shared runs" value={localComputeForm.allowedPathScopes} onChange={(e) => setLocalComputeForm((current) => ({ ...current, allowedPathScopes: e.target.value }))} />
            <textarea className="min-h-20 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Allowed auth capabilities, e.g. consent:gemini-web" value={localComputeForm.allowedAuthCapabilities} onChange={(e) => setLocalComputeForm((current) => ({ ...current, allowedAuthCapabilities: e.target.value }))} />
            <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => void handleCreateLocalComputeNode()}>
              Register Local Compute Node
            </Button>
            {latestLocalComputeToken ? (
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-300 mb-2">Copy Node Token Now</div>
                <div className="font-mono text-emerald-100 break-all">{latestLocalComputeToken}</div>
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-xs text-slate-400">
              Start command:
              <pre className="mt-2 whitespace-pre-wrap break-all text-blue-300">python3 /Users/liumobei/.openclaw/workspace/scripts/run_local_compute_node.py --hub-base-url {platformSummary?.baseUrl || "http://47.250.188.70"} --node-id {latestLocalComputeNodeId || "<node-id>"} --node-token {latestLocalComputeToken || "<node-token>"}</pre>
            </div>
            {localComputeMessage ? <div className="text-xs text-slate-400">{localComputeMessage}</div> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Queue Local Compute Task</CardTitle>
            <CardDescription>Dispatch a reviewed package or a whitelisted SOP node to your local machine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <select className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" value={localComputeTaskForm.nodeId} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, nodeId: e.target.value }))}>
              <option value="">Select local node</option>
              {(localComputeSnapshot?.nodes || []).map((node) => (
                <option key={node.nodeId} value={node.nodeId}>{node.label} · {node.status}</option>
              ))}
            </select>
            <select className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" value={localComputeTaskForm.taskKind} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, taskKind: e.target.value === "skill-node" ? "skill-node" : "package" }))}>
              <option value="package">Published Package</option>
              <option value="skill-node">Whitelisted Skill Node</option>
            </select>
            {localComputeTaskForm.taskKind === "package" ? (
              <select className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" value={localComputeTaskForm.packageId} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, packageId: e.target.value }))}>
                <option value="">Select package</option>
                {((localComputeSnapshot?.nodes.find((node) => node.nodeId === localComputeTaskForm.nodeId)?.allowedPackageIds?.length ?? 0) > 0
                  ? packages.filter((pkg) => (localComputeSnapshot?.nodes.find((node) => node.nodeId === localComputeTaskForm.nodeId)?.allowedPackageIds || []).includes(pkg.packageId))
                  : packages
                ).map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>{pkg.name} · {pkg.packageId}</option>
                ))}
              </select>
            ) : (
              <>
                <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Target node ID" value={localComputeTaskForm.targetNodeId} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, targetNodeId: e.target.value }))} />
                <input className="rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Target label" value={localComputeTaskForm.targetLabel} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, targetLabel: e.target.value }))} />
                <textarea className="min-h-24 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm" placeholder="Command" value={localComputeTaskForm.command} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, command: e.target.value }))} />
              </>
            )}
            <textarea className="min-h-24 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm font-mono" placeholder='Input values JSON, e.g. {"目标目录":"..."}' value={localComputeTaskForm.inputValuesJson} onChange={(e) => setLocalComputeTaskForm((current) => ({ ...current, inputValuesJson: e.target.value }))} />
            <Button variant="secondary" className="bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => void handleCreateLocalComputeTask()}>
              Queue On Local Compute Node
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Nodes</CardTitle>
            <CardDescription>Current online status, heartbeats, and whitelist coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            {(localComputeSnapshot?.nodes || []).map((node) => (
              <div key={node.nodeId} className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{node.label}</div>
                    <div className="text-xs text-slate-500 font-mono">{node.nodeId}</div>
                  </div>
                  <div className="text-xs text-slate-200">{node.status}</div>
                </div>
                <div className="text-xs text-slate-400">
                  Last seen {node.lastSeenAt ? formatRelativeDate(node.lastSeenAt) : "never"} · packages {node.allowedPackageIds.length} · nodes {node.allowedNodeIds.length}
                </div>
                <div className="text-xs text-slate-500">
                  {node.sharingMode === "trusted-shared" ? "trusted shared runtime" : "author only"} · shared users {(node.sharedWithUsers || []).length}
                </div>
                {node.ownerEmail ? <div className="text-xs text-slate-500">Owner {node.ownerEmail}</div> : null}
                {node.lastError ? <div className="text-xs text-red-300">{node.lastError}</div> : null}
                {node.heartbeatMeta ? (
                  <div className="text-xs text-slate-500">
                    {node.heartbeatMeta.localConsoleBaseUrl || "local console unknown"} · agent {node.heartbeatMeta.onlineAgent ? "online" : "offline"}
                  </div>
                ) : null}
                <div className="grid gap-2 pt-2">
                  <select className="rounded-md border border-slate-700 bg-[#111827] px-3 py-2 text-xs text-slate-200" value={localComputeShareForms[node.nodeId]?.sharingMode || "author-only"} onChange={(e) => setLocalComputeShareForms((current) => ({ ...current, [node.nodeId]: { ...(current[node.nodeId] || { sharingMode: "author-only", sharedWithEmails: "", allowedPathScopes: "", allowedAuthCapabilities: "" }), sharingMode: e.target.value === "trusted-shared" ? "trusted-shared" : "author-only" } }))}>
                    <option value="author-only">Author only</option>
                    <option value="trusted-shared">Trusted shared runtime</option>
                  </select>
                  <textarea className="min-h-20 rounded-md border border-slate-700 bg-[#111827] px-3 py-2 text-xs text-slate-200" placeholder="Trusted user emails" value={localComputeShareForms[node.nodeId]?.sharedWithEmails || ""} onChange={(e) => setLocalComputeShareForms((current) => ({ ...current, [node.nodeId]: { ...(current[node.nodeId] || { sharingMode: "author-only", sharedWithEmails: "", allowedPathScopes: "", allowedAuthCapabilities: "" }), sharedWithEmails: e.target.value } }))} />
                  <textarea className="min-h-16 rounded-md border border-slate-700 bg-[#111827] px-3 py-2 text-xs text-slate-200" placeholder="Allowed path scopes" value={localComputeShareForms[node.nodeId]?.allowedPathScopes || ""} onChange={(e) => setLocalComputeShareForms((current) => ({ ...current, [node.nodeId]: { ...(current[node.nodeId] || { sharingMode: "author-only", sharedWithEmails: "", allowedPathScopes: "", allowedAuthCapabilities: "" }), allowedPathScopes: e.target.value } }))} />
                  <textarea className="min-h-16 rounded-md border border-slate-700 bg-[#111827] px-3 py-2 text-xs text-slate-200" placeholder="Allowed auth capabilities" value={localComputeShareForms[node.nodeId]?.allowedAuthCapabilities || ""} onChange={(e) => setLocalComputeShareForms((current) => ({ ...current, [node.nodeId]: { ...(current[node.nodeId] || { sharingMode: "author-only", sharedWithEmails: "", allowedPathScopes: "", allowedAuthCapabilities: "" }), allowedAuthCapabilities: e.target.value } }))} />
                  <Button variant="outline" size="sm" className="justify-center" onClick={() => void handleSaveLocalComputeSharePolicy(node.nodeId)}>
                    Save Sharing Policy
                  </Button>
                </div>
              </div>
            ))}
            {!localComputeSnapshot?.nodes?.length ? (
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-slate-500">
                No local compute nodes registered yet.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Local Compute Tasks</CardTitle>
            <CardDescription>Task history, summaries, and synced artifacts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            {(localComputeSnapshot?.tasks || []).slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{task.targetLabel}</div>
                    <div className="text-xs text-slate-500 font-mono">{task.id}</div>
                  </div>
                  <div className="text-xs text-slate-200">{task.status}</div>
                </div>
                <div className="text-xs text-slate-400">
                  {task.taskKind} · {task.packageId || task.targetNodeId || "custom"} · artifacts {task.artifacts.length} · {task.accessMode}
                </div>
                {task.summary ? <div className="text-xs text-slate-300">{task.summary}</div> : null}
                {task.error ? <div className="text-xs text-red-300">{task.error}</div> : null}
              </div>
            ))}
            {!localComputeSnapshot?.tasks?.length ? (
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-slate-500">
                No local compute tasks yet.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
