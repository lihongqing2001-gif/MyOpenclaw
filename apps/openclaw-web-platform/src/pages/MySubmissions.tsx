import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, GitBranch, Package, Plus, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMySubmissions } from "@/lib/api";
import { formatRelativeDate, humanizeEnum } from "@/lib/format";
import { usePlatform } from "@/lib/platform";
import type { SubmissionRecord } from "@/contracts/types";

function statusBadge(status: SubmissionRecord["status"]) {
  switch (status) {
    case "published":
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Published</Badge>;
    case "submitted":
    case "under_review":
      return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" /> In Review</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
    default:
      return <Badge variant="secondary">{humanizeEnum(status)}</Badge>;
  }
}

export function MySubmissions() {
  const { session } = usePlatform();
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getMySubmissions()
      .then((payload) => {
        if (!cancelled) {
          setSubmissions(payload.submissions);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load submissions");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">My Submissions</h1>
          <p className="text-slate-400">Manage your published packages and track review status.</p>
        </div>
        <Link to="/submit">
          <Button className="gap-2 shadow-sm shadow-blue-900/20">
            <Plus className="w-4 h-4" />
            New Submission
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="text-lg">My Account</CardTitle>
            <CardDescription>Current identity, role, and linked access methods.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div>Email: <span className="font-medium text-slate-100">{session?.user?.email || "-"}</span></div>
            <div>
              Role:{" "}
              <span className="font-medium text-slate-100">
                {session?.user?.role === "super_admin" ? "Super Admin" : humanizeEnum(session?.user?.role || "user")}
              </span>
            </div>
            <div>
              GitHub:{" "}
              <span className="font-medium text-slate-100">
                {session?.user?.githubLogin ? `@${session.user.githubLogin}` : "Not linked"}
              </span>
            </div>
            <div>
              Two-factor:{" "}
              <span className="font-medium text-slate-100">
                {session?.user?.twoFactorEnabled ? "Enabled" : "Not enabled"}
              </span>
            </div>
                {session?.user?.githubLogin ? (
                  <div className="inline-flex items-center gap-2 text-slate-400">
                    <GitBranch className="w-4 h-4" />
                    GitHub-linked account
                  </div>
                ) : null}
          </CardContent>
        </Card>

        {session?.user?.role === "super_admin" ? (
          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg">Admin Controls</CardTitle>
              <CardDescription>Only administrators can see and use this control surface.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3">
                <div className="flex items-center gap-2 text-emerald-200 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  Administrator privileges active
                </div>
                <div className="text-emerald-100/80 mt-2">
                  Your 2FA setup and cloud-console authorization code tools live in the admin area.
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/admin">
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    Open Admin Dashboard
                  </Button>
                </Link>
                <Link to="/review">
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    Review Queue
                  </Button>
                </Link>
                <Link to="/cloud-console">
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    Cloud Console Access
                  </Button>
                </Link>
                <Link to="/admin/2fa">
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    View TOTP Setup
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6">
        {submissions.map((submission) => (
          <Card key={submission.id} className="border-slate-800/60 bg-[#0f172a]/50 hover:bg-[#0f172a] transition-colors">
            <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0 border border-slate-700/50">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{submission.packageId}</h3>
                    {statusBadge(submission.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 font-mono flex-wrap">
                    <span>v{submission.packageVersion}</span>
                    <span>Updated {formatRelativeDate(submission.updatedAt)}</span>
                    {submission.githubSyncStatus && <span>{humanizeEnum(submission.githubSyncStatus)}</span>}
                  </div>
                  {(submission.status === "rejected" || submission.status === "changes_requested") && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-red-400 bg-red-950/30 p-3 rounded-md border border-red-900/50">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Check the review queue response or audit trail for change requests and resubmit with a corrected package bundle.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                <Link to={`/package/${encodeURIComponent(submission.packageId)}`}>
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    View Page
                  </Button>
                </Link>
                {submission.githubReleaseUrl ? (
                  <a href={submission.githubReleaseUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm" className="bg-slate-800 hover:bg-slate-700 text-slate-200 gap-2">
                      <RefreshCw className="w-4 h-4" />
                      GitHub Release
                    </Button>
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">
                    Release Sync Pending
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
