import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, Boxes, Play, Server, Terminal, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCloudOpenClawSkillTree, getCloudOpenClawSummary, getPackages, installCloudOpenClawPackage, queueCloudOpenClawExecution } from "@/lib/api";
import { usePlatform } from "@/lib/platform";
import type { PackageRecord } from "@/contracts/types";

type CloudNode = Awaited<ReturnType<typeof getCloudOpenClawSkillTree>>["nodes"][number];

export function CloudOpenClaw() {
  const { session } = usePlatform();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getCloudOpenClawSummary>> | null>(null);
  const [nodes, setNodes] = useState<CloudNode[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getCloudOpenClawSummary(), getCloudOpenClawSkillTree(), getPackages()])
      .then(([nextSummary, skillTree, packagePayload]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        const runnable = skillTree.nodes.filter((node) => node.level === 3);
        setNodes(runnable);
        if (runnable[0]) {
          setSelectedNodeId(runnable[0].id);
        }
        setPackages(packagePayload.packages);
        if (packagePayload.packages[0]) {
          setSelectedPackageId(packagePayload.packages[0].packageId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Failed to load cloud OpenClaw");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  async function handleExecute() {
    if (!session?.csrfToken || !selectedNode) {
      return;
    }
    const command = selectedNode.drawerContent?.invoke || selectedNode.drawerContent?.commands?.[0] || "";
    if (!command) {
      setMessage("Selected node does not expose an executable command.");
      return;
    }
    try {
      const response = await queueCloudOpenClawExecution(
        {
          nodeId: selectedNode.id,
          command,
          inputValues: inputs,
        },
        session.csrfToken,
      );
      setMessage(`Queued cloud task: ${response.task.nodeLabel} (${response.task.id})`);
      const refreshed = await getCloudOpenClawSummary();
      setSummary(refreshed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to queue cloud task");
    }
  }

  async function handleInstallPackage() {
    if (!session?.csrfToken || !selectedPackageId) {
      return;
    }
    try {
      const response = await installCloudOpenClawPackage({ packageId: selectedPackageId }, session.csrfToken);
      setMessage(`Installed cloud package: ${response.packageId} @ ${response.version}`);
      const refreshed = await getCloudOpenClawSummary();
      setSummary(refreshed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to install cloud package");
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Cloud Runtime Ops</h1>
        <p className="text-slate-400">
          This is an admin-only operations panel for the server-side runtime. It is not the end-user SoloCore Console UI, and it should not be treated as the user-facing cloud app surface.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-slate-800 bg-[#0f172a]/70 px-4 py-3 text-sm text-slate-200">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Broker</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {summary?.reachable ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
            <div className="text-sm text-slate-200">{summary?.reachable ? "Reachable" : "Unavailable"}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Agent</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Bot className={`w-5 h-5 ${summary?.health?.heartbeat.agent.online ? "text-emerald-400" : "text-amber-400"}`} />
            <div className="text-sm text-slate-200">{summary?.health?.heartbeat.agent.online ? "Online" : "Waiting"}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Queued Tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-white">{summary?.health?.heartbeat.queuedTasks.length ?? 0}</CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Installed Packages</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-white">{summary?.localPackages?.length ?? 0}</CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">Queue Cloud Task</CardTitle>
            <CardDescription>Pick a level-3 node from the cloud skill tree and queue it against the server-side OpenClaw runtime.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200"
              value={selectedNodeId}
              onChange={(event) => {
                setSelectedNodeId(event.target.value);
                setInputs({});
              }}
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
            {selectedNode?.drawerContent?.summary && (
              <div className="text-sm text-slate-400">{selectedNode.drawerContent.summary}</div>
            )}
            <div className="space-y-3">
              {(selectedNode?.drawerContent?.inputs || []).map((input) => (
                <div key={input.field}>
                  <label className="block text-xs text-slate-400 mb-1">{input.field}</label>
                  <Input
                    className="bg-[#0a0e17] border-slate-700"
                    placeholder={input.placeholder || input.field}
                    value={inputs[input.field] || ""}
                    onChange={(event) => setInputs((current) => ({ ...current, [input.field]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
            <Button className="gap-2" onClick={() => void handleExecute()} disabled={loading || !selectedNode}>
              <Play className="w-4 h-4" />
              Queue In Cloud OpenClaw
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg">Install Official Package</CardTitle>
              <CardDescription>Push an official package from SoloCore Hub into the server-side OpenClaw runtime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 py-2 text-sm text-slate-200"
                value={selectedPackageId}
                onChange={(event) => setSelectedPackageId(event.target.value)}
              >
                {packages.map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>
                    {pkg.name} · {pkg.packageId} · v{pkg.latestVersion}
                  </option>
                ))}
              </select>
              <Button className="w-full gap-2" onClick={() => void handleInstallPackage()} disabled={!selectedPackageId}>
                <Boxes className="w-4 h-4" />
                Install Into Cloud OpenClaw
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg">Runtime State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2"><Server className="w-4 h-4 text-blue-400" /> {summary?.consoleBaseUrl || "n/a"}</div>
              <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-indigo-400" /> Asset root: {summary?.controlPlane?.assetRoot?.path || "not configured"}</div>
              {summary?.errors?.length ? (
                <div className="space-y-1 text-red-300">
                  {summary.errors.map((item) => <div key={item}>- {item}</div>)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              {(summary?.health?.heartbeat.recentTasks || []).slice(0, 5).map((task) => (
                <div key={task.id} className="rounded-md border border-slate-800 bg-[#0a0e17] p-3">
                  <div className="font-medium text-slate-100">{task.nodeLabel}</div>
                  <div className="text-xs text-slate-500 font-mono">{task.status}</div>
                  {task.resultSummary ? <div className="text-xs text-slate-400 mt-1">{task.resultSummary}</div> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg">Installed Cloud Packages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              {(summary?.localPackages || []).slice(0, 8).map((pkg) => (
                <div key={pkg.packageId} className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-emerald-400" />
                  <span className="truncate">{pkg.name}</span>
                  <span className="ml-auto font-mono text-xs text-slate-500">v{pkg.activeVersion}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
