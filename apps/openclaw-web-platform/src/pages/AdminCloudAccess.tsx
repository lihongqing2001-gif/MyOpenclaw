import { useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminCloudConsoleAccessCode, getAdminCloudConsoleAccessSnapshot, revokeAdminCloudConsoleAccessCode } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { usePlatform } from "@/lib/platform";

export function AdminCloudAccess() {
  const { session } = usePlatform();
  const [snapshot, setSnapshot] = useState<null | Awaited<ReturnType<typeof getAdminCloudConsoleAccessSnapshot>>>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [plainCode, setPlainCode] = useState("");
  const [form, setForm] = useState({
    label: "SoloCore Cloud Trial",
    note: "",
    expiresInHours: "72",
    maxUses: "1",
  });

  async function loadSnapshot() {
    const next = await getAdminCloudConsoleAccessSnapshot();
    setSnapshot(next);
  }

  useEffect(() => {
    void loadSnapshot().catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load cloud access"));
  }, []);

  const activeCodes = useMemo(() => (snapshot?.codes || []).filter((item) => !item.revokedAt), [snapshot]);
  const activeGrants = useMemo(() => (snapshot?.grants || []).filter((item) => item.status === "active"), [snapshot]);

  async function handleCreate() {
    if (!session?.csrfToken) return;
    setError("");
    setMessage("");
    try {
      const response = await createAdminCloudConsoleAccessCode({
        label: form.label,
        note: form.note || undefined,
        expiresInHours: Number(form.expiresInHours || 72),
        maxUses: Number(form.maxUses || 1),
      }, session.csrfToken);
      setPlainCode(response.plainCode);
      setMessage("Authorization code created. Copy it now before distributing it.");
      await loadSnapshot();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create cloud access code");
    }
  }

  async function handleRevoke(codeId: string) {
    if (!session?.csrfToken) return;
    setError("");
    setMessage("");
    try {
      await revokeAdminCloudConsoleAccessCode(codeId, session.csrfToken);
      setMessage("Authorization code revoked.");
      await loadSnapshot();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke cloud access code");
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 space-y-8">
      <div className="rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(11,20,37,0.98),rgba(10,18,31,0.95),rgba(16,32,58,0.94))] p-8 shadow-[0_34px_100px_rgba(2,6,23,0.5)]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-900/40 bg-indigo-950/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-indigo-200">
            Cloud Access
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Issue, inspect, and revoke cloud-console access without losing the trail.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Access codes and live grants are separated here so operators can distinguish “what has been issued” from “who is currently inside”.
            </p>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Access Mode</div><div className="mt-2 text-sm text-white">{snapshot?.accessEnabled ? "Enabled" : "Missing secret or public URL"}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Active Codes</div><div className="mt-2 text-3xl font-semibold text-white">{activeCodes.length}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Active Grants</div><div className="mt-2 text-3xl font-semibold text-white">{activeGrants.length}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Access Code</CardTitle>
            <CardDescription>Issue a new code with explicit label, expiry, and use cap.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Label" value={form.label} onChange={(e) => setForm((cur) => ({ ...cur, label: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Note" value={form.note} onChange={(e) => setForm((cur) => ({ ...cur, note: e.target.value }))} />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Expires in hours" value={form.expiresInHours} onChange={(e) => setForm((cur) => ({ ...cur, expiresInHours: e.target.value }))} />
              <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Max uses" value={form.maxUses} onChange={(e) => setForm((cur) => ({ ...cur, maxUses: e.target.value }))} />
            </div>
            <Button className="gap-2" onClick={() => void handleCreate()}>
              <KeyRound className="h-4 w-4" />
              Create Authorization Code
            </Button>
            {plainCode ? (
              <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-emerald-300">Copy Now</div>
                <div className="mt-2 break-all font-mono text-sm text-emerald-100">{plainCode}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Codes</CardTitle>
              <CardDescription>Issued codes that can still grant new sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeCodes.map((code) => (
                <div key={code.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{code.label}</div>
                      <div className="mt-1 text-xs font-mono text-slate-500">{code.codePreview}</div>
                      <div className="mt-2 text-xs text-slate-400">uses {code.usedCount}/{code.maxUses} · expires {formatRelativeDate(code.expiresAt)}</div>
                    </div>
                    <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800" onClick={() => void handleRevoke(code.id)}>Revoke</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Live Grants</CardTitle>
              <CardDescription>Users who currently hold active cloud-console access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGrants.map((grant) => (
                <div key={grant.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{grant.userEmail}</div>
                      <div className="mt-1 text-xs font-mono text-slate-500">{grant.id}</div>
                    </div>
                    <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" /> Active</Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">expires {formatRelativeDate(grant.expiresAt)} · last launch {grant.lastLaunchedAt ? formatRelativeDate(grant.lastLaunchedAt) : "never"}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
