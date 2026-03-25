import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, CheckCircle2, Clock, Download, Filter, Search, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getPackages } from "@/lib/api";
import { formatRelativeDate, humanizeEnum } from "@/lib/format";
import type { PackageRecord } from "@/contracts/types";

const categoryOptions = [
  { label: "All Packages", value: "all" },
  { label: "SOP Packs", value: "sop-pack" },
  { label: "Skill Packs", value: "skill-pack" },
  { label: "Demo Packs", value: "demo-pack" },
  { label: "Tutorial Packs", value: "tutorial-pack" },
  { label: "Case Packs", value: "case-pack" },
] as const;

const sortOptions = [
  { label: "Recently Updated", value: "recent" },
  { label: "Official First", value: "official" },
  { label: "Most Capabilities", value: "capabilities" },
  { label: "Newest", value: "name" },
] as const;

function tagsForPackage(pkg: PackageRecord) {
  const manifest = pkg.versions.find((item) => item.version === pkg.latestVersion)?.manifest ?? pkg.versions[0]?.manifest;
  const tags = [
    ...(manifest?.capabilities.slice(0, 2).map((item) => item.label) ?? []),
    ...(manifest?.source?.mirrorStatus ? [manifest.source.mirrorStatus] : []),
    ...(manifest?.permissions.slice(0, 1).map((item) => item.key) ?? []),
  ];
  return tags.slice(0, 4);
}

function packagePublishedAt(pkg: PackageRecord) {
  return pkg.versions.find((item) => item.version === pkg.latestVersion)?.publishedAt || "";
}

export function Community() {
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") || "";
  const category = searchParams.get("type") || "all";
  const sort = searchParams.get("sort") || "recent";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPackages()
      .then((payload) => {
        if (!cancelled) {
          setPackages(payload.packages);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load community packages");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateParams(next: { q?: string; type?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams);
    if (typeof next.q !== "undefined") {
      next.q ? params.set("q", next.q) : params.delete("q");
    }
    if (typeof next.type !== "undefined") {
      next.type && next.type !== "all" ? params.set("type", next.type) : params.delete("type");
    }
    if (typeof next.sort !== "undefined") {
      next.sort && next.sort !== "recent" ? params.set("sort", next.sort) : params.delete("sort");
    }
    setSearchParams(params, { replace: true });
  }

  const filteredPackages = useMemo(() => {
    const base = packages.filter((pkg) => pkg.visibility === "community" || pkg.visibility === "official");
    const q = search.trim().toLowerCase();

    const searched = !q
      ? base
      : base.filter((pkg) => {
          const manifest = pkg.versions.find((item) => item.version === pkg.latestVersion)?.manifest ?? pkg.versions[0]?.manifest;
          const haystack = [
            pkg.name,
            pkg.packageId,
            pkg.type,
            manifest?.description || "",
            manifest?.author.name || "",
            ...tagsForPackage(pkg),
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });

    const categorized = category === "all" ? searched : searched.filter((pkg) => pkg.type === category);

    return categorized.slice().sort((left, right) => {
      if (sort === "official") {
        const leftScore = left.visibility === "official" ? 1 : 0;
        const rightScore = right.visibility === "official" ? 1 : 0;
        if (leftScore !== rightScore) return rightScore - leftScore;
        return packagePublishedAt(right).localeCompare(packagePublishedAt(left));
      }
      if (sort === "capabilities") {
        const leftCaps = (left.versions.find((item) => item.version === left.latestVersion)?.manifest ?? left.versions[0]?.manifest)?.capabilities.length ?? 0;
        const rightCaps = (right.versions.find((item) => item.version === right.latestVersion)?.manifest ?? right.versions[0]?.manifest)?.capabilities.length ?? 0;
        if (leftCaps !== rightCaps) return rightCaps - leftCaps;
        return left.name.localeCompare(right.name, "zh-Hans-CN");
      }
      if (sort === "name") {
        return left.name.localeCompare(right.name, "zh-Hans-CN");
      }
      return packagePublishedAt(right).localeCompare(packagePublishedAt(left));
    });
  }, [category, packages, search, sort]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Community Packages</h1>
          <p className="text-slate-400">Discover and install reviewed skills, SOPs, tutorials, and workflow bundles published through SoloCore Hub.</p>
        </div>
        <Link to="/submit">
          <Button className="gap-2 shadow-sm shadow-blue-900/20">
            Submit Package
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">Search</h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search packages..."
                className="pl-9 bg-[#0f172a] border-slate-800"
                value={search}
                onChange={(event) => updateParams({ q: event.target.value })}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">Categories</h3>
            <div className="space-y-2">
              {categoryOptions.map((option) => {
                const selected = category === option.value || (option.value === "all" && category === "all");
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => updateParams({ type: option.value })}
                    className="w-full flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer group text-left"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-slate-700 bg-[#0f172a] group-hover:border-slate-500"}`}>
                      {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">Sort By</h3>
            <div className="space-y-2">
              {sortOptions.map((option) => {
                const selected = sort === option.value || (option.value === "recent" && sort === "recent");
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => updateParams({ sort: option.value })}
                    className="w-full flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer group text-left"
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selected ? "border-blue-500" : "border-slate-700 group-hover:border-slate-500"}`}>
                      {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          {loading ? (
            <div className="text-slate-400">Loading community packages...</div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-slate-400">
                  Showing <span className="text-slate-200 font-medium">{filteredPackages.length}</span> reviewed package{filteredPackages.length === 1 ? "" : "s"}
                </div>
                <Button
                  variant="outline"
                  className="gap-2 border-slate-800 text-slate-300 hover:bg-slate-800/50"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  <Filter className="w-4 h-4" />
                  Reset Filters
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredPackages.map((pkg) => {
                  const manifest = pkg.versions.find((item) => item.version === pkg.latestVersion)?.manifest ?? pkg.versions[0]?.manifest;
                  const tags = tagsForPackage(pkg);
                  return (
                    <Link key={pkg.packageId} to={`/package/${encodeURIComponent(pkg.packageId)}`} className="block group">
                      <Card className="h-full border-slate-800/60 bg-[#0f172a]/50 hover:bg-[#0f172a] hover:border-slate-700 transition-all">
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg text-blue-400 group-hover:text-blue-300 transition-colors">
                                {pkg.name}
                              </CardTitle>
                              {pkg.visibility === "official" && (
                                <Badge variant="success" className="h-5 px-1.5 text-[10px] gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Official
                                </Badge>
                              )}
                              {manifest?.source?.mirrorStatus && manifest.source.mirrorStatus !== "official" && (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  {humanizeEnum(manifest.source.mirrorStatus)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mb-3">
                            by <span className="text-slate-400">{manifest?.author.name || "Unknown"}</span> · {humanizeEnum(pkg.type)}
                            {manifest?.source?.license ? ` · ${manifest.source.license}` : ""}
                          </div>
                          <CardDescription className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                            {manifest?.description || "No description provided."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="bg-slate-800/50 text-slate-300 hover:bg-slate-800">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 flex items-center gap-6 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            v{pkg.latestVersion}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5" />
                            {manifest?.capabilities.length ?? 0} caps
                          </div>
                          {manifest?.install?.command && (
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              install ready
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Clock className="w-3.5 h-3.5" />
                            {formatRelativeDate(packagePublishedAt(pkg))}
                          </div>
                        </CardFooter>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
