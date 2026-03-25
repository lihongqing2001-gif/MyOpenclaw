import { useEffect, useMemo, useState } from "react";
import { Bot, Cpu, Terminal, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminLocalComputeTask, getAdminLocalComputeSnapshot, getPackages, registerAdminLocalComputeNode } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { usePlatform } from "@/lib/platform";

export function AdminLocalCompute() {
  const { session } = usePlatform();
  const [packages, setPackages] = useState<Awaited<ReturnType<typeof getPackages>>["packages"]>([]);
  const [snapshot, setSnapshot] = useState<null | Awaited<ReturnType<typeof getAdminLocalComputeSnapshot>>>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [latestNodeId, setLatestNodeId] = useState("");
  const [latestToken, setLatestToken] = useState("");
  const [localComputeForm, setLocalComputeForm] = useState({
    label: "Mobei Local Node",
    allowedPackageIds: "",
    allowedNodeIds: "",
  });
  const [taskForm, setTaskForm] = useState({
    nodeId: "",
    taskKind: "package" as "package" | "skill-node",
    packageId: "",
    targetNodeId: "",
    targetLabel: "",
    command: "",
    inputValuesJson: "{}",
  });

  async function loadData() {
    const [packagePayload, localCompute] = await Promise.all([getPackages(), getAdminLocalComputeSnapshot()]);
    setPackages(packagePayload.packages);
    setSnapshot(localCompute);
    setTaskForm((current) => ({
      ...current,
      nodeId: current.nodeId || localCompute.nodes[0]?.nodeId || "",
      packageId: current.packageId || packagePayload.packages[0]?.packageId || "",
    }));
  }

  useEffect(() => {
    void loadData().catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load local compute"));
  }, []);

  const onlineNodes = useMemo(() => (snapshot?.nodes || []).filter((node) => node.status === "online" || node.status === "busy"), [snapshot]);

  async function handleRegisterNode() {
    if (!session?.csrfToken) return;
    setMessage("");
    setError("");
    try {
      const response = await registerAdminLocalComputeNode({
        label: localComputeForm.label,
        allowedPackageIds: localComputeForm.allowedPackageIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
        allowedNodeIds: localComputeForm.allowedNodeIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      }, session.csrfToken);
      setLatestNodeId(response.node.nodeId);
      setLatestToken(response.plainToken);
      setMessage("Local compute node registered. Start the bridge script on the target machine.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to register local compute node");
    }
  }

  async function handleQueueTask() {
    if (!session?.csrfToken || !taskForm.nodeId) return;
    setMessage("");
    setError("");
    try {
      const inputValues = JSON.parse(taskForm.inputValuesJson || "{}") as Record<string, string>;
      const response = await createAdminLocalComputeTask({
        nodeId: taskForm.nodeId,
        taskKind: taskForm.taskKind,
        packageId: taskForm.taskKind === "package" ? taskForm.packageId : undefined,
        targetNodeId: taskForm.taskKind === "skill-node" ? taskForm.targetNodeId : undefined,
        targetLabel: taskForm.taskKind === "skill-node" ? taskForm.targetLabel : undefined,
        command: taskForm.taskKind === "skill-node" ? taskForm.command : undefined,
        inputValues,
      }, session.csrfToken);
      setMessage(`Queued local compute task: ${response.task.targetLabel} (${response.task.id})`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to queue local compute task");
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 space-y-8">
      <div className="rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(10,18,30,0.98),rgba(13,23,41,0.95),rgba(20,26,47,0.94))] p-8 shadow-[0_34px_100px_rgba(2,6,23,0.5)]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/40 bg-emerald-950/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
            Local Compute
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Attach trusted machines, dispatch allowed work, and inspect returned artifacts.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Local compute stays private to the machine, but the operator control surface lives here. Registration, dispatch, and task history are kept separate.
            </p>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Registered Nodes</div><div className="mt-2 text-3xl font-semibold text-white">{snapshot?.nodes.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Online Nodes</div><div className="mt-2 text-3xl font-semibold text-white">{onlineNodes.length}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Tracked Tasks</div><div className="mt-2 text-3xl font-semibold text-white">{snapshot?.tasks.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Artifacts Sync</div><div className="mt-2 text-sm text-white">Full Sync</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Register Node</CardTitle>
            <CardDescription>Create a token and whitelist the package or skill-node IDs this machine may run.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Node label" value={localComputeForm.label} onChange={(e) => setLocalComputeForm((current) => ({ ...current, label: e.target.value }))} />
            <textarea className="min-h-24 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" placeholder="Allowed package IDs" value={localComputeForm.allowedPackageIds} onChange={(e) => setLocalComputeForm((current) => ({ ...current, allowedPackageIds: e.target.value }))} />
            <textarea className="min-h-24 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" placeholder="Allowed skill node IDs" value={localComputeForm.allowedNodeIds} onChange={(e) => setLocalComputeForm((current) => ({ ...current, allowedNodeIds: e.target.value }))} />
            <Button className="gap-2" onClick={() => void handleRegisterNode()}>
              <Cpu className="h-4 w-4" />
              Register Local Compute Node
            </Button>
            {(latestNodeId || latestToken) ? (
              <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-4 text-sm text-emerald-100">
                <div className="font-mono break-all">node-id {latestNodeId}</div>
                <div className="mt-2 font-mono break-all">node-token {latestToken}</div>
                <pre className="mt-3 whitespace-pre-wrap text-xs text-emerald-200">python3 /Users/liumobei/.openclaw/workspace/scripts/run_local_compute_node.py --hub-base-url http://47.250.188.70 --node-id {latestNodeId || "<node-id>"} --node-token {latestToken || "<node-token>"}</pre>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dispatch Work</CardTitle>
            <CardDescription>Queue a published package or a whitelisted skill node onto a trusted local machine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" value={taskForm.nodeId} onChange={(e) => setTaskForm((current) => ({ ...current, nodeId: e.target.value }))}>
              <option value="">Select local node</option>
              {(snapshot?.nodes || []).map((node) => (
                <option key={node.nodeId} value={node.nodeId}>{node.label} · {node.status}</option>
              ))}
            </select>
            <select className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" value={taskForm.taskKind} onChange={(e) => setTaskForm((current) => ({ ...current, taskKind: e.target.value === "skill-node" ? "skill-node" : "package" }))}>
              <option value="package">Published Package</option>
              <option value="skill-node">Whitelisted Skill Node</option>
            </select>
            {taskForm.taskKind === "package" ? (
              <select className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" value={taskForm.packageId} onChange={(e) => setTaskForm((current) => ({ ...current, packageId: e.target.value }))}>
                <option value="">Select package</option>
                {packages.map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>{pkg.name} · {pkg.packageId}</option>
                ))}
              </select>
            ) : (
              <>
                <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Target node ID" value={taskForm.targetNodeId} onChange={(e) => setTaskForm((current) => ({ ...current, targetNodeId: e.target.value }))} />
                <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Target label" value={taskForm.targetLabel} onChange={(e) => setTaskForm((current) => ({ ...current, targetLabel: e.target.value }))} />
                <textarea className="min-h-24 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200" placeholder="Command" value={taskForm.command} onChange={(e) => setTaskForm((current) => ({ ...current, command: e.target.value }))} />
              </>
            )}
            <textarea className="min-h-24 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 font-mono text-sm text-slate-200" placeholder='Input values JSON, e.g. {"目标目录":"..."}' value={taskForm.inputValuesJson} onChange={(e) => setTaskForm((current) => ({ ...current, inputValuesJson: e.target.value }))} />
            <Button className="gap-2" onClick={() => void handleQueueTask()}>
              <Terminal className="h-4 w-4" />
              Queue On Local Compute Node
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nodes</CardTitle>
            <CardDescription>Current online state, heartbeats, and whitelist coverage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(snapshot?.nodes || []).map((node) => (
              <div key={node.nodeId} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">{node.label}</div>
                    <div className="mt-1 text-xs font-mono text-slate-500">{node.nodeId}</div>
                  </div>
                  <div className="text-xs text-slate-300">{node.status}</div>
                </div>
                <div className="mt-2 text-xs text-slate-400">last seen {node.lastSeenAt ? formatRelativeDate(node.lastSeenAt) : "never"} · packages {node.allowedPackageIds.length} · nodes {node.allowedNodeIds.length}</div>
                {node.lastError ? <div className="mt-2 text-xs text-red-300">{node.lastError}</div> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Tasks</CardTitle>
            <CardDescription>Queued, running, completed, and failed work for local machines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(snapshot?.tasks || []).slice(0, 10).map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">{task.targetLabel}</div>
                    <div className="mt-1 text-xs font-mono text-slate-500">{task.id}</div>
                  </div>
                  <div className="text-xs text-slate-300">{task.status}</div>
                </div>
                <div className="mt-2 text-xs text-slate-400">{task.taskKind} · {task.packageId || task.targetNodeId || "custom"} · artifacts {task.artifacts.length}</div>
                {task.summary ? <div className="mt-2 text-sm text-slate-300">{task.summary}</div> : null}
                {task.error ? <div className="mt-2 text-sm text-red-300">{task.error}</div> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
