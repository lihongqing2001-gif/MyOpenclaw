import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Apple, ArrowRight, Copy, Download as DownloadIcon, Layers, Monitor, Terminal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getForgeConsoleReleaseMeta } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";

type ReleaseMeta = {
  available: boolean;
  fileName: string;
  updatedAt: string;
  version: string;
  artifactType: string;
  launchers: Record<string, string>;
  downloadUrl: string;
};

const installerCards = [
  {
    name: "macOS",
    description: "Apple Silicon & Intel",
    icon: Apple,
    checks: ["macOS 12.0+", "Runnable .command launcher", "Local runtime bundle"],
  },
  {
    name: "Windows",
    description: "Windows 10 & 11",
    icon: Monitor,
    checks: ["Windows 10 21H2+", "launch.bat included", "Portable runtime bundle"],
  },
  {
    name: "Linux",
    description: "Ubuntu / AppImage path",
    icon: Terminal,
    checks: ["Ubuntu 20.04+", "launch.sh included", "Headless-friendly bundle"],
  },
];

const resourceRepos = [
  { label: "Official Skills", href: "https://github.com/lihongqing2001-gif/openclaw-skills" },
  { label: "Official SOPs", href: "https://github.com/lihongqing2001-gif/openclaw-sops" },
  { label: "Demos", href: "https://github.com/lihongqing2001-gif/openclaw-demos" },
  { label: "Tutorials", href: "https://github.com/lihongqing2001-gif/openclaw-tutorials" },
  { label: "Cases", href: "https://github.com/lihongqing2001-gif/openclaw-cases" },
];

export function Download() {
  const [release, setRelease] = useState<ReleaseMeta | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const nextStepText = useMemo(
    () => "Install SoloCore Console -> open Community -> inspect package -> import reviewed zip",
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void getForgeConsoleReleaseMeta()
      .then((payload) => {
        if (!cancelled) {
          setRelease(payload);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load release metadata");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(nextStepText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="container mx-auto px-4 py-24 max-w-6xl">
      <div className="text-center mb-16">
        <Badge variant="outline" className="mb-4 border-blue-500/30 text-blue-400 bg-blue-500/10">
          {release?.available ? `Latest Bundle: v${release.version} · ${release.fileName}` : "SoloCore Console bundle not generated yet"}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
          Download SoloCore Console
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          This page ships the latest runnable local bundle. It is not a notarized native `.app`; it includes the current console runtime, launcher scripts, and the files required to start SoloCore Console locally.
        </p>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 mb-24">
        {installerCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={card.name} className="relative overflow-hidden border-slate-800/60 bg-[#0f172a]/50 hover:bg-[#0f172a] transition-all group">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700/50">
                  <Icon className="w-8 h-8 text-slate-200" />
                </div>
                <CardTitle className="text-2xl mb-2">{card.name}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <ul className="text-sm text-slate-400 space-y-3 mb-8 text-left max-w-[220px] mx-auto">
                  {card.checks.map((check) => (
                    <li key={check} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {check}
                    </li>
                  ))}
                </ul>
                {release?.available ? (
                  <a
                    href={release.downloadUrl}
                    download={release.fileName}
                    className={`inline-flex w-full items-center justify-center gap-2 h-12 rounded-md px-4 text-sm font-medium transition-colors ${
                      index === 0
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-900/20"
                        : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                    }`}
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Download Runnable Bundle
                  </a>
                ) : (
                  <Button className="w-full gap-2 h-12" variant={index === 0 ? "default" : "secondary"} disabled>
                    <DownloadIcon className="w-4 h-4" />
                    Bundle Not Ready
                  </Button>
                )}
                <p className="text-xs text-slate-500 mt-4 font-mono">
                  {release?.available ? `v${release.version} · ${release.fileName}` : "Run `npm run package` in apps/mission-control"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">After installation</h3>
        <div className="bg-[#0a0e17] border border-slate-800 rounded-xl p-6 relative group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
            </div>
            <span className="text-xs text-slate-500 font-mono">next-step</span>
          </div>
          <code className="font-mono text-sm text-blue-400 block mb-4">
            <span className="text-slate-500 select-none">1 </span>
            {nextStepText}
          </code>
          {release?.available && (
            <div className="rounded-lg border border-slate-800 bg-[#060b16] p-3 mb-4 text-sm text-slate-300">
              <div className="font-medium text-slate-100 mb-1">Bundle launchers</div>
              <div className="font-mono text-xs text-slate-400">
                macOS: {release.launchers.macos || "SoloCore Console.command"} · Windows: {release.launchers.windows || "launch.bat"} · Linux: {release.launchers.linux || "launch.sh"}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-slate-800 bg-[#060b16] p-3 mb-4 flex items-center justify-between gap-3">
            <input
              readOnly
              value={nextStepText}
              className="w-full bg-transparent text-sm text-slate-300 outline-none font-mono"
            />
            <Button variant="ghost" size="sm" className="gap-2 shrink-0" onClick={() => void handleCopy()}>
              <Copy className="w-4 h-4" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => navigate("/community")}>
              <Layers className="w-4 h-4" />
              Browse Community Packages
            </Button>
            {release?.available && (
              <span className="text-xs text-slate-500">
                Bundle updated {formatRelativeDate(release.updatedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-16">
        <h3 className="text-xl font-semibold text-white mb-6 text-center">Official Resource Repositories</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {resourceRepos.map((repo) => (
            <a
              key={repo.label}
              href={repo.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-800 bg-[#0f172a]/50 px-5 py-4 text-slate-300 hover:bg-[#0f172a] hover:border-slate-700 transition-colors"
            >
              <div className="font-medium text-slate-100">{repo.label}</div>
              <div className="mt-1 text-xs text-slate-500 font-mono">{repo.href}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
