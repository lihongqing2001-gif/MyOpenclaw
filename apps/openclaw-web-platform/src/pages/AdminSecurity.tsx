import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Filter, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAuditLogs, getSecurityEvents } from "@/lib/api";
import { formatRelativeDate, humanizeEnum } from "@/lib/format";
import type { AuditLogEntry, SecurityEvent } from "@/contracts/types";

function auditRisk(action: string) {
  if (["user_role_update", "user_sessions_revoked"].includes(action)) return "critical";
  if (["cloud_console_code_create", "cloud_console_code_revoke", "admin_2fa_verify"].includes(action)) return "warning";
  return "info";
}

function riskBadgeVariant(risk: string) {
  if (risk === "critical") return "destructive";
  if (risk === "warning") return "warning";
  return "outline";
}

export function AdminSecurity() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAuditLogs(), getSecurityEvents()])
      .then(([auditPayload, securityPayload]) => {
        if (cancelled) return;
        setAuditLogs(auditPayload.auditLogs);
        setSecurityEvents(securityPayload.securityEvents);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load security surfaces");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAudit = useMemo(() => {
    const nextQuery = query.trim().toLowerCase();
    return [...auditLogs]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .filter((item) => (riskFilter === "all" ? true : auditRisk(item.action) === riskFilter))
      .filter((item) => {
        if (!nextQuery) return true;
        return `${item.action} ${item.targetType} ${item.targetId} ${item.actorUserId || ""}`.toLowerCase().includes(nextQuery);
      });
  }, [auditLogs, query, riskFilter]);

  const highlightedSecurityEvents = useMemo(
    () => [...securityEvents].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 12),
    [securityEvents],
  );

  const counts = useMemo(() => ({
    audit: auditLogs.length,
    security: securityEvents.length,
    critical: auditLogs.filter((item) => auditRisk(item.action) === "critical").length,
    warning: auditLogs.filter((item) => auditRisk(item.action) === "warning").length,
  }), [auditLogs, securityEvents]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 space-y-8">
      <div className="rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(20,11,27,0.96),rgba(10,17,34,0.95),rgba(20,25,52,0.94))] p-8 shadow-[0_34px_100px_rgba(2,6,23,0.5)]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-900/40 bg-amber-950/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-200">
            Security And Audit
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Investigate sensitive changes without leaving the admin workspace.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Audit logs answer who did what. Security events answer what the platform flagged. This page keeps both streams close enough for operator investigation.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Audit Logs</div><div className="mt-2 text-3xl font-semibold text-white">{counts.audit}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Security Events</div><div className="mt-2 text-3xl font-semibold text-white">{counts.security}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Critical Audit</div><div className="mt-2 text-3xl font-semibold text-white">{counts.critical}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Warning Audit</div><div className="mt-2 text-3xl font-semibold text-white">{counts.warning}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sensitive Audit Activity</CardTitle>
            <CardDescription>Filter by actor or action, then focus the operator stream before opening the full raw log.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input className="border-slate-700 bg-[#0a0e17] pl-9" placeholder="Search actor, action, target" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-[#0a0e17] px-3">
                <Filter className="h-4 w-4 text-slate-500" />
                <select className="h-10 w-full bg-transparent text-sm text-slate-200 outline-none" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}>
                  <option value="all">All risk</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredAudit.slice(0, 40).map((entry) => {
                const risk = auditRisk(entry.action);
                return (
                  <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={riskBadgeVariant(risk)}>{humanizeEnum(risk)}</Badge>
                          <Badge variant="secondary">{humanizeEnum(entry.action)}</Badge>
                          <Badge variant="outline">{humanizeEnum(entry.targetType)}</Badge>
                        </div>
                        <div className="mt-2 text-sm text-slate-200">{entry.targetId}</div>
                        <div className="mt-1 text-xs text-slate-500">actor {entry.actorUserId || "system"}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">{formatRelativeDate(entry.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Security Signals</CardTitle>
            <CardDescription>Platform-generated events that need operator context before becoming incidents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {highlightedSecurityEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                      <div className="text-sm font-medium text-slate-100">{humanizeEnum(event.category)}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{event.detail}</div>
                    {event.ip ? <div className="mt-2 text-xs text-slate-500">ip {event.ip}</div> : null}
                  </div>
                  <div className="text-xs text-slate-500">{formatRelativeDate(event.createdAt)}</div>
                </div>
              </div>
            ))}
            {!highlightedSecurityEvents.length ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
                No security events recorded yet.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
