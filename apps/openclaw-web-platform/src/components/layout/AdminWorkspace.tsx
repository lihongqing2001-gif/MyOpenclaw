import { NavLink, Outlet } from "react-router-dom";
import { Activity, Bot, KeyRound, LayoutDashboard, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlatform } from "@/lib/platform";
import { humanizeEnum } from "@/lib/format";

export function AdminWorkspace() {
  const { session } = usePlatform();
  const role = session?.user?.role;

  const items = role === "reviewer"
    ? [
        { to: "/admin/review", label: "Review", icon: ShieldCheck },
      ]
    : [
        { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
        { to: "/admin/users", label: "Users & Roles", icon: Users },
        { to: "/admin/review", label: "Review", icon: ShieldCheck },
        { to: "/admin/security", label: "Security", icon: Activity },
        { to: "/admin/platform", label: "Platform", icon: Settings },
        { to: "/admin/cloud-access", label: "Cloud Access", icon: KeyRound },
        { to: "/admin/runtime", label: "Runtime", icon: Bot },
        { to: "/admin/local-compute", label: "Local Compute", icon: Wrench },
      ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,24,43,0.95),rgba(6,11,22,1)_55%)]">
      <div className="mx-auto grid max-w-[1600px] gap-0 px-4 py-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="mb-6 xl:mb-0 xl:pr-6">
          <div className="sticky top-24 rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(8,15,28,0.96),rgba(12,20,38,0.92))] p-5 shadow-[0_26px_80px_rgba(2,6,23,0.45)]">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Admin Workspace</div>
              <div className="text-lg font-semibold text-white">{session?.user?.email || "Authenticated operator"}</div>
              <Badge variant={role === "super_admin" ? "default" : "warning"}>
                {humanizeEnum(role || "reviewer")}
              </Badge>
              <p className="text-sm leading-6 text-slate-400">
                {role === "reviewer"
                  ? "Reviewer mode is scoped to moderation only."
                  : "Super-admin mode includes identity, security, platform, and operations control."}
              </p>
            </div>

            <nav className="mt-6 space-y-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                        isActive
                          ? "border-cyan-500/30 bg-cyan-950/20 text-white"
                          : "border-slate-800 bg-slate-950/30 text-slate-300 hover:border-slate-700 hover:bg-slate-950/60"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
