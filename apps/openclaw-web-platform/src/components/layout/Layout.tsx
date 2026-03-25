import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Download, Layers, Menu, Search, Terminal, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api";
import { usePlatform } from "@/lib/platform";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { session, refreshSession } = usePlatform();

  const navLinks = useMemo(
    () => [
      { name: "Home", path: "/" },
      { name: "Downloads", path: "/downloads" },
      { name: "Community", path: "/community" },
    ],
    [],
  );

  const authed = Boolean(session?.authenticated && session.user);

  async function handleLogout() {
    if (!session?.csrfToken) {
      return;
    }
    await logout(session.csrfToken);
    await refreshSession();
    navigate("/");
  }

  function submitSearch() {
    const next = searchQuery.trim();
    navigate(next ? `/community?q=${encodeURIComponent(next)}` : "/community");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] text-slate-200 font-sans selection:bg-blue-500/30">
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-[#0a0e17]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-slate-100 hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Terminal className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-lg">SoloCore Hub</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? "bg-slate-800/50 text-white"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/30"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                type="text"
                placeholder="Search packages..."
                className="h-9 w-64 rounded-full border border-slate-800 bg-[#0f172a] pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitSearch();
                  }
                }}
              />
            </div>
            {authed ? (
              <>
                <Link to="/me">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    {session?.user?.email?.split("@")[0] || "Account"}
                  </Button>
                </Link>
                <Link to="/shared-runtime">
                  <Button variant="ghost" size="sm" className="gap-2">
                    Shared Runtime
                  </Button>
                </Link>
                {session?.user?.role === "super_admin" ? (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="gap-2">
                      Admin
                    </Button>
                  </Link>
                ) : session?.user?.role === "reviewer" ? (
                  <Link to="/admin/review">
                    <Button variant="outline" size="sm" className="gap-2">
                      Review
                    </Button>
                  </Link>
                ) : null}
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void handleLogout()}>
                  Sign Out
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  Sign In
                </Button>
              </Link>
            )}
            <Link to="/downloads">
              <Button size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Download Console
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-slate-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-[#0f172a] px-4 py-4 space-y-4">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname === link.path
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
              {authed ? (
                <>
                  <Link to="/me" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start">My Submissions</Button>
                  </Link>
                  <Link to="/shared-runtime" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start">Shared Runtime</Button>
                  </Link>
                  {session?.user?.role === "super_admin" ? (
                    <>
                      <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full justify-start">Admin Dashboard</Button>
                      </Link>
                      <Link to="/admin/users" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full justify-start">Users & Roles</Button>
                      </Link>
                    </>
                  ) : session?.user?.role === "reviewer" ? (
                    <Link to="/admin/review" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">Review Queue</Button>
                    </Link>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      void handleLogout();
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full justify-start">Sign In</Button>
                </Link>
              )}
              <Link to="/downloads" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full justify-start gap-2">
                  <Layers className="w-4 h-4" />
                  Download Console
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  submitSearch();
                }}
              >
                Search Packages
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800/60 bg-[#0a0e17] py-12 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-100">
              <Terminal className="w-5 h-5 text-blue-500" />
              <span className="font-bold tracking-tight">SoloCore Hub</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              The public registry, review surface, and signed delivery layer for SoloCore Console and other local-first package workflows.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/downloads" className="hover:text-blue-400 transition-colors">Download SoloCore Console</Link></li>
              <li><Link to="/community" className="hover:text-blue-400 transition-colors">Community Packages</Link></li>
              <li><Link to="/submit" className="hover:text-blue-400 transition-colors">Submit a Package</Link></li>
              <li><Link to="/cloud-console" className="hover:text-blue-400 transition-colors">Cloud Console Access</Link></li>
              <li><Link to="/shared-runtime" className="hover:text-blue-400 transition-colors">Shared Runtime</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 mb-4">Product Split</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><span className="hover:text-blue-400 transition-colors">SoloCore Hub: registry and review</span></li>
              <li><span className="hover:text-blue-400 transition-colors">SoloCore Console: local runtime</span></li>
              <li><span className="hover:text-blue-400 transition-colors">GitHub: public distribution</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 mb-4">Admin</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/admin/review" className="hover:text-blue-400 transition-colors">Review Queue</Link></li>
              <li><Link to="/admin" className="hover:text-blue-400 transition-colors">Dashboard</Link></li>
              <li><a href="/health" className="hover:text-blue-400 transition-colors">Health</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-800/60 text-sm text-slate-500 flex justify-between items-center">
          <p>© {new Date().getFullYear()} SoloCore Hub. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to={session?.user?.role === "reviewer" ? "/admin/review" : "/admin"} className="hover:text-slate-300 transition-colors">
              {session?.user?.role === "reviewer" ? "Review" : "Admin"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
