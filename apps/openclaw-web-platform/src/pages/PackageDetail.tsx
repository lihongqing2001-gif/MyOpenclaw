import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPackage, getPackageSource } from "@/lib/api";
import { formatRelativeDate, humanizeEnum } from "@/lib/format";
import { usePlatform } from "@/lib/platform";
import type { PackageRecord } from "@/contracts/types";

export function PackageDetail() {
  const { id = "" } = useParams();
  const { session } = usePlatform();
  const navigate = useNavigate();
  const [record, setRecord] = useState<PackageRecord | null>(null);
  const [githubSource, setGithubSource] = useState<{
    githubReleaseUrl: string;
    githubSyncStatus: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    void Promise.all([getPackage(id), getPackageSource(id).catch(() => null)])
      .then(([pkg, source]) => {
        if (!cancelled) {
          setRecord(pkg);
          setGithubSource(source ? {
            githubReleaseUrl: source.githubReleaseUrl,
            githubSyncStatus: source.githubSyncStatus,
          } : null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load package");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const manifest = useMemo(
    () => record?.versions.find((item) => item.version === record.latestVersion)?.manifest ?? record?.versions[0]?.manifest,
    [record],
  );

  const packageToken = record?.packageId || "";

  function handleCopy() {
    navigator.clipboard.writeText(packageToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return <div className="container mx-auto px-4 py-12 text-red-300">{error}</div>;
  }

  if (!record || !manifest) {
    return <div className="container mx-auto px-4 py-12 text-slate-400">Loading package…</div>;
  }

  const usageBlock = manifest.capabilities
    .map((capability) => `${capability.label}\n${capability.entrypoint || "No entrypoint declared."}`)
    .join("\n\n");
  const installCommand = manifest.install?.command || manifest.dependencies.find((item) => item.installCommand)?.installCommand || "";
  const installUrl = manifest.install?.url || manifest.dependencies.find((item) => item.installUrl)?.installUrl || "";

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Link to="/community" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-white">{record.name}</h1>
              <Badge variant={record.visibility === "official" ? "success" : "secondary"} className="gap-1">
                <ShieldCheck className="w-3 h-3" />
                {humanizeEnum(record.visibility)}
              </Badge>
            </div>
            <p className="text-lg text-slate-400 mb-4 leading-relaxed">{manifest.description}</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {manifest.capabilities.slice(0, 6).map((capability) => (
                <Badge key={capability.id} variant="secondary" className="bg-slate-800/50 text-slate-300 hover:bg-slate-800">
                  {capability.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="prose prose-invert prose-slate max-w-none">
            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2 mb-4">Overview</h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              This package is distributed through SoloCore Hub and intended to be imported into SoloCore Console. Review its declared capabilities, dependencies, and permission envelope before downloading.
            </p>

            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2 mb-4">Package ID</h2>
            <div className="bg-[#0a0e17] border border-slate-800 rounded-lg p-4 mb-8 flex items-center justify-between group">
              <code className="text-sm font-mono text-blue-400">
                <span className="text-slate-500 select-none">pkg </span>
                {record.packageId}
              </code>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="text-slate-400 hover:text-white">
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2 mb-4">Usage</h2>
            <div className="bg-[#0a0e17] border border-slate-800 rounded-lg p-4 mb-8">
              <pre className="text-sm font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                <code>{usageBlock || "No entrypoints were declared in this manifest."}</code>
              </pre>
            </div>

            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2 mb-4">Dependencies</h2>
            <div className="space-y-3 mb-8">
              {manifest.dependencies.length ? manifest.dependencies.map((dependency) => (
                <div key={dependency.id} className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <strong className="text-slate-100">{dependency.label}</strong>
                    <Badge variant={dependency.required ? "warning" : "secondary"}>{dependency.required ? "Required" : "Optional"}</Badge>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{humanizeEnum(dependency.kind)}</p>
                  {(dependency.installCommand || dependency.installUrl) && (
                    <div className="mt-3 space-y-1 text-xs">
                      {dependency.installCommand && (
                        <div className="font-mono text-blue-300">{dependency.installCommand}</div>
                      )}
                      {dependency.installUrl && (
                        <a href={dependency.installUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                          Source / Install Link
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )) : <p className="text-slate-400">No extra dependencies declared.</p>}
            </div>

            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2 mb-4">Install</h2>
            <div className="space-y-3 mb-8">
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4">
                <div className="text-sm text-slate-300 mb-3">
                  Install this resource through SoloCore Console after download and inspection.
                </div>
                {installCommand ? (
                  <pre className="text-sm font-mono text-blue-300 overflow-x-auto whitespace-pre-wrap">
                    <code>{installCommand}</code>
                  </pre>
                ) : (
                  <div className="text-sm text-slate-400">No explicit install command declared. Use SoloCore Console import/install flow.</div>
                )}
                {installUrl && (
                  <a href={installUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                    Open install source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {manifest.install?.notes?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-slate-400">
                    {manifest.install.notes.map((note) => (
                      <li key={note}>- {note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white border-b border-slate-800 pb-2 mb-4">Permissions</h2>
            <div className="space-y-3 mb-8">
              {manifest.permissions.map((permission) => (
                <div key={permission.key} className="rounded-lg border border-slate-800 bg-[#0a0e17] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <strong className="text-slate-100 font-mono">{permission.key}</strong>
                    <Badge variant={permission.required ? "destructive" : "secondary"}>{permission.required ? "Required" : "Optional"}</Badge>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{permission.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardHeader>
              <CardTitle className="text-lg">Get Package</CardTitle>
              <CardDescription>{session?.authenticated ? "Request a signed download and import the archive in SoloCore Console." : "Sign in before requesting a signed download."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {session?.authenticated ? (
                <Button className="w-full gap-2 h-12 shadow-sm shadow-blue-900/20" onClick={() => { window.location.href = `/package/${encodeURIComponent(record.packageId)}/download`; }}>
                  <Download className="w-4 h-4" />
                  Request Signed Download
                </Button>
              ) : (
                <Link to={`/login?redirectTo=${encodeURIComponent(`/package/${encodeURIComponent(record.packageId)}/download`)}`}>
                  <Button className="w-full gap-2 h-12 shadow-sm shadow-blue-900/20">
                    <Terminal className="w-4 h-4" />
                    Sign In to Download
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-[#0f172a]/50">
            <CardContent className="p-6 space-y-6 text-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400 flex items-center gap-2"><Terminal className="w-4 h-4" /> Author</span>
                <span className="text-slate-200 font-mono">{manifest.author.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400 flex items-center gap-2"><Download className="w-4 h-4" /> Latest Version</span>
                <span className="text-slate-200 font-mono">v{record.latestVersion}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400 flex items-center gap-2"><GitBranch className="w-4 h-4" /> Source</span>
                <span className="text-slate-200 font-mono">{humanizeEnum(manifest.source?.mirrorStatus || "official")}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> License</span>
                <span className="text-slate-200 font-mono">{manifest.source?.license || "Not specified"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400 flex items-center gap-2"><FileText className="w-4 h-4" /> Docs Bundled</span>
                <span className="text-slate-200 font-mono">{manifest.docs.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-slate-400 flex items-center gap-2"><Activity className="w-4 h-4" /> Last Updated</span>
                <span className="text-slate-200 font-mono">{formatRelativeDate(record.versions.find((item) => item.version === record.latestVersion)?.publishedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Review Status</span>
                <span className="text-slate-200 font-mono">{humanizeEnum(record.reviewStatus)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {manifest.source?.homepage && (
              <a href={manifest.source.homepage} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-blue-500/10">
                <ExternalLink className="w-4 h-4" />
                Open Resource Homepage
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </a>
            )}
            {manifest.source?.repository && (
              <a href={manifest.source.repository} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-blue-500/10">
                <GitBranch className="w-4 h-4" />
                View Source on GitHub
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </a>
            )}
            {githubSource?.githubReleaseUrl && (
              <a href={githubSource.githubReleaseUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-blue-500/10">
                <FileText className="w-4 h-4" />
                Open GitHub Release
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </a>
            )}
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-md hover:bg-blue-500/10" onClick={() => navigate("/community")}>
              <Download className="w-4 h-4" />
              Back to community
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
