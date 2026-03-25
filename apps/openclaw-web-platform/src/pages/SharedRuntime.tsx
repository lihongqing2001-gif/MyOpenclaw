import { useEffect, useMemo, useState } from "react";
import { Rocket, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createMySharedRuntimeTask, getMySharedRuntimeSnapshot } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { usePlatform } from "@/lib/platform";

export function SharedRuntime() {
  const { session } = usePlatform();
  const [snapshot, setSnapshot] = useState<null | Awaited<ReturnType<typeof getMySharedRuntimeSnapshot>>>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [inputValuesJson, setInputValuesJson] = useState("{}");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshSnapshot() {
    const next = await getMySharedRuntimeSnapshot();
    setSnapshot(next);
    setSelectedNodeId((current) => current || next.nodes[0]?.node.nodeId || "");
  }

  useEffect(() => {
    let cancelled = false;
    void getMySharedRuntimeSnapshot()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setSnapshot(next);
        setSelectedNodeId(next.nodes[0]?.node.nodeId || "");
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load shared runtime");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNode = useMemo(
    () => snapshot?.nodes.find((item) => item.node.nodeId === selectedNodeId) || snapshot?.nodes[0] || null,
    [selectedNodeId, snapshot?.nodes],
  );

  useEffect(() => {
    if (!selectedNode) {
      setSelectedPackageId("");
      return;
    }
    if (!selectedNode.availablePackages.some((pkg) => pkg.packageId === selectedPackageId)) {
      setSelectedPackageId(selectedNode.availablePackages[0]?.packageId || "");
    }
  }, [selectedNode, selectedPackageId]);

  async function handleRunPackage() {
    if (!session?.csrfToken || !selectedNode || !selectedPackageId) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const inputValues = JSON.parse(inputValuesJson || "{}") as Record<string, string>;
      const response = await createMySharedRuntimeTask({
        nodeId: selectedNode.node.nodeId,
        taskKind: "package",
        packageId: selectedPackageId,
        inputValues,
      }, session.csrfToken);
      setMessage(`Queued ${response.task.targetLabel} on ${selectedNode.node.label}.`);
      await refreshSnapshot();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to queue shared runtime task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Shared Runtime</h1>
        <p className="text-slate-400">
          Use a trusted shared runtime remotely. Only explicitly shared packages and capabilities are available here.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-blue-400" />
              Available Runtimes
            </CardTitle>
            <CardDescription>
              Shared nodes are constrained by package, path, and auth capability allowlists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            {!snapshot?.nodes.length ? (
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-slate-500">
                No shared runtimes are available to this account yet.
              </div>
            ) : (
              <>
                <select className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" value={selectedNodeId} onChange={(event) => setSelectedNodeId(event.target.value)}>
                  {snapshot.nodes.map((item) => (
                    <option key={item.node.nodeId} value={item.node.nodeId}>
                      {item.node.label} · {item.node.sharingMode} · {item.node.status}
                    </option>
                  ))}
                </select>
                {selectedNode ? (
                  <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-4 space-y-3">
                    <div>
                      <div className="font-medium text-slate-100">{selectedNode.node.label}</div>
                      <div className="text-xs text-slate-500 font-mono">{selectedNode.node.nodeId}</div>
                    </div>
                    <div className="text-xs text-slate-400">
                      Owner {selectedNode.node.ownerEmail || selectedNode.node.ownerUserId} · last seen{" "}
                      {selectedNode.node.lastSeenAt ? formatRelativeDate(selectedNode.node.lastSeenAt) : "never"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Path scopes: {selectedNode.node.allowedPathScopes.length > 0 ? selectedNode.node.allowedPathScopes.join(", ") : "not declared"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Auth capabilities: {selectedNode.node.allowedAuthCapabilities.length > 0 ? selectedNode.node.allowedAuthCapabilities.join(", ") : "not declared"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Shared with {(selectedNode.node.sharedWithUsers || []).map((user) => user.email).join(", ") || "owner only"}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Rocket className="w-5 h-5 text-emerald-400" />
              Launch Shared Package
            </CardTitle>
            <CardDescription>
              Queue a package on the selected runtime. Declared onboarding requirements must fit the runtime allowlist.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <select className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)} disabled={!selectedNode?.availablePackages.length}>
              {selectedNode?.availablePackages.length ? (
                selectedNode.availablePackages.map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>
                    {pkg.name} · {pkg.packageId}
                  </option>
                ))
              ) : (
                <option value="">No shared packages</option>
              )}
            </select>
            {selectedNode?.availablePackages.find((pkg) => pkg.packageId === selectedPackageId) ? (
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-xs text-slate-400">
                Required auth capabilities:{" "}
                {selectedNode.availablePackages.find((pkg) => pkg.packageId === selectedPackageId)?.requiredAuthCapabilities.join(", ") || "none declared"}
              </div>
            ) : null}
            <textarea className="min-h-24 rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm font-mono text-slate-200" placeholder='Input values JSON, e.g. {"目标目录":"..."}' value={inputValuesJson} onChange={(event) => setInputValuesJson(event.target.value)} />
            <Button className="w-full gap-2" onClick={() => void handleRunPackage()} disabled={busy || !selectedNode || !selectedPackageId}>
              <ShieldCheck className="w-4 h-4" />
              {busy ? "Queueing..." : "Queue Shared Run"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800/60 bg-[#0f172a]/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Shared Runtime Tasks</CardTitle>
          <CardDescription>Tasks you requested, or tasks running on your own author runtime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          {snapshot?.tasks.length ? snapshot.tasks.slice(0, 10).map((task) => (
            <div key={task.id} className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-100">{task.targetLabel}</div>
                  <div className="text-xs text-slate-500 font-mono">{task.id}</div>
                </div>
                <div className="text-xs text-slate-200">{task.status}</div>
              </div>
              <div className="text-xs text-slate-400">
                {task.taskKind} · {task.accessMode} · requested by {task.requestedByUserId}
              </div>
              {task.summary ? <div className="text-xs text-slate-300">{task.summary}</div> : null}
              {task.error ? <div className="text-xs text-red-300">{task.error}</div> : null}
            </div>
          )) : (
            <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-slate-500">
              No shared runtime tasks yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
