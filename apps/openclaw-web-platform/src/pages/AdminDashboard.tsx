import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, Bot, KeyRound, ShieldCheck, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/lib/api";
import { formatRelativeDate, humanizeEnum } from "@/lib/format";

type OverviewPayload = Awaited<ReturnType<typeof getAdminOverview>>;

function alertVariant(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "warning";
  return "outline";
}

function healthVariant(status: "healthy" | "warning" | "critical" | "idle") {
  if (status === "healthy") return "success";
  if (status === "warning") return "warning";
  if (status === "critical") return "destructive";
  return "outline";
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getAdminOverview()
      .then((payload) => {
        if (!cancelled) {
          setOverview(payload);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load admin overview");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => ([
    {
      label: "Pending Reviews",
      value: overview?.counts.pendingReviews ?? 0,
      hint: "Needs moderator action",
    },
    {
      label: "Users",
      value: overview?.counts.users ?? 0,
      hint: "Tracked Hub accounts",
    },
    {
      label: "Active Cloud Grants",
      value: overview?.counts.activeCloudGrants ?? 0,
      hint: "Cloud-console access in flight",
    },
    {
      label: "Online Local Nodes",
      value: overview?.counts.onlineLocalComputeNodes ?? 0,
      hint: "Trusted machines currently reachable",
    },
  ]), [overview]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 space-y-8">
      <div className="rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(8,15,31,0.98),rgba(16,26,49,0.95),rgba(10,18,30,0.94))] p-8 shadow-[0_34px_100px_rgba(2,6,23,0.5)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/40 bg-cyan-950/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200">
              Admin Overview
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Triage first. Edit later. Keep control surfaces separate.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                This page is now the operator landing surface. It only answers what needs attention, which subsystem owns it, and where you should go next.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin/users">
                <Button className="gap-2">
                  <Users className="h-4 w-4" />
                  Users & Roles
                </Button>
              </Link>
              <Link to="/admin/review">
                <Button variant="outline" className="gap-2 border-slate-700 text-slate-200 hover:bg-slate-800">
                  <ShieldCheck className="h-4 w-4" />
                  Review Queue
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[420px]">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
                <div className="mt-2 text-3xl font-semibold text-white">{card.value}</div>
                <div className="mt-1 text-xs text-slate-400">{card.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Priority Queue</CardTitle>
            <CardDescription>Highest-value alerts first. Each entry points to the owning page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.alerts || []).map((alert) => (
              <Link key={alert.id} to={alert.href} className="block rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 transition hover:border-slate-700 hover:bg-slate-950/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alertVariant(alert.severity)}>{humanizeEnum(alert.severity)}</Badge>
                      <div className="text-sm font-medium text-slate-100">{alert.title}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{alert.detail}</div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-500" />
                </div>
              </Link>
            ))}
            {!overview?.alerts.length ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
                No urgent alerts right now.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Critical Activity</CardTitle>
            <CardDescription>Recent sensitive actions that may need follow-up or correlation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.recentCriticalActivity || []).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={alertVariant(String(entry.metadata?.severity || "info") as "critical" | "warning" | "info")}>
                        {humanizeEnum(String(entry.metadata?.severity || "info"))}
                      </Badge>
                      <Badge variant="secondary">{humanizeEnum(entry.action)}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-200">{entry.targetId}</div>
                    <div className="mt-1 text-xs text-slate-500">actor {entry.actorUserId || "system"}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">{formatRelativeDate(entry.createdAt)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Control Surfaces</CardTitle>
          <CardDescription>Each module owns one domain. No inline editing remains on the overview page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(overview?.moduleHealth || []).map((module) => (
            <Link key={module.id} to={module.href} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 transition hover:border-slate-700 hover:bg-slate-950/70">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-100">{module.label}</div>
                <Badge variant={healthVariant(module.status)}>{humanizeEnum(module.status)}</Badge>
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-400">{module.summary}</div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-6"><AlertTriangle className="h-5 w-5 text-amber-300" /><div><div className="text-sm font-medium text-slate-100">Security owns investigation</div><div className="text-xs text-slate-500">Audit and security events are no longer buried behind API-only links.</div></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-6"><Bot className="h-5 w-5 text-cyan-300" /><div><div className="text-sm font-medium text-slate-100">Runtime owns execution</div><div className="text-xs text-slate-500">Cloud runtime actions stay on the runtime page, not the overview.</div></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-6"><Wrench className="h-5 w-5 text-emerald-300" /><div><div className="text-sm font-medium text-slate-100">Local compute owns dispatch</div><div className="text-xs text-slate-500">Registration, dispatch, and task history stay on the local-compute page.</div></div></CardContent></Card>
      </div>
    </div>
  );
}
