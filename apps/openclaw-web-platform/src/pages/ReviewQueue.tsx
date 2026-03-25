import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Filter, GitPullRequest, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getReviewQueue, publishSubmissionToGithub, reviewSubmission } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { usePlatform } from "@/lib/platform";
import type { SubmissionRecord } from "@/contracts/types";

function riskTone(status: SubmissionRecord["status"]) {
  return status === "under_review" ? "warning" : "secondary";
}

export function ReviewQueue() {
  const [queue, setQueue] = useState<SubmissionRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "under_review">("all");
  const { session } = usePlatform();

  async function loadQueue() {
    const payload = await getReviewQueue();
    setQueue(payload.submissions);
  }

  useEffect(() => {
    void loadQueue().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Failed to load review queue");
    });
  }, []);

  const pendingCount = useMemo(() => queue.length, [queue]);
  const visibleQueue = useMemo(
    () =>
      queue.filter((item) => {
        const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
        const q = search.trim().toLowerCase();
        const matchesSearch = !q
          ? true
          : `${item.packageId} ${item.packageVersion} ${item.id}`.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      }),
    [queue, search, statusFilter],
  );

  async function handleAction(submissionId: string, action: "approve" | "request_changes" | "reject") {
    if (!session?.csrfToken) {
      return;
    }
    setBusyId(`${submissionId}:${action}`);
    setError("");
    try {
      await reviewSubmission(submissionId, action, session.csrfToken, notes[submissionId] || "");
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review action failed");
    } finally {
      setBusyId("");
    }
  }

  async function handleGithubRelease(submissionId: string) {
    if (!session?.csrfToken) {
      return;
    }
    setBusyId(`${submissionId}:github`);
    setError("");
    try {
      await publishSubmissionToGithub(submissionId, session.csrfToken);
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GitHub release sync failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Review Queue</h1>
          <p className="text-slate-400">Review community submissions before publishing.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Input
              placeholder={`Pending submissions: ${pendingCount}`}
              className="pl-4 w-64 bg-[#0f172a] border-slate-800"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={() =>
              setStatusFilter((current) =>
                current === "all" ? "submitted" : current === "submitted" ? "under_review" : "all",
              )
            }
          >
            <Filter className="w-4 h-4" />
            {statusFilter === "all" ? "All" : statusFilter === "submitted" ? "Submitted" : "In Progress"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {visibleQueue.map((item) => (
          <Card key={item.id} className="border-slate-800/60 bg-[#0f172a]/50 hover:bg-[#0f172a] transition-colors">
            <CardContent className="p-6 flex flex-col gap-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0 border border-slate-700/50">
                    <GitPullRequest className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-lg font-semibold text-white">{item.packageId}</h3>
                      <Badge variant={riskTone(item.status)} className="gap-1"><Clock className="w-3 h-3" /> {item.status === "under_review" ? "In Progress" : "Pending"}</Badge>
                      <Badge variant="warning" className="gap-1"><ShieldAlert className="w-3 h-3" /> Manual Review</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 font-mono mb-2 flex-wrap">
                      <span>v{item.packageVersion}</span>
                      <span>Submission {item.id}</span>
                      <span>Submitted {formatRelativeDate(item.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Review the package archive, manifest metadata, and declared permissions before publishing.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
                <Input
                  placeholder="Optional review note or change request"
                  className="bg-[#0f172a] border-slate-800"
                  value={notes[item.id] || ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="success"
                    size="sm"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => void handleAction(item.id, "approve")}
                    disabled={busyId === `${item.id}:approve`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={() => void handleAction(item.id, "request_changes")}
                    disabled={busyId === `${item.id}:request_changes`}
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => void handleAction(item.id, "reject")}
                    disabled={busyId === `${item.id}:reject`}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200"
                    onClick={() => void handleGithubRelease(item.id)}
                    disabled={busyId === `${item.id}:github`}
                  >
                    Publish GitHub Release
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
