import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, KeyRound, Search, ShieldCheck, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminUsers, revokeAdminUserSessions, updateAdminUserRole } from "@/lib/api";
import { formatRelativeDate, humanizeEnum } from "@/lib/format";
import { usePlatform } from "@/lib/platform";
import type { AdminUserSummary, UserRole } from "@/contracts/types";

function roleBadgeVariant(role: UserRole) {
  if (role === "super_admin") return "default";
  if (role === "reviewer") return "warning";
  return "outline";
}

function roleRank(role: UserRole) {
  if (role === "super_admin") return 0;
  if (role === "reviewer") return 1;
  return 2;
}

export function UserManagement() {
  const { session } = usePlatform();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getAdminUsers()
      .then((payload) => {
        if (cancelled) return;
        setUsers(payload.users);
        setSelectedUserId(payload.users[0]?.id || "");
        setDraftRoles(
          Object.fromEntries(payload.users.map((item) => [item.id, item.role])),
        );
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load users");
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

  const filteredUsers = useMemo(() => {
    const nextQuery = query.trim().toLowerCase();
    return [...users]
      .filter((item) => (roleFilter === "all" ? true : item.role === roleFilter))
      .filter((item) => {
        if (!nextQuery) return true;
        return [
          item.email,
          item.role,
          item.githubLogin || "",
          item.primaryAuthProvider || "",
          ...(item.linkedProviders || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(nextQuery);
      })
      .sort((a, b) => {
        const byRole = roleRank(a.role) - roleRank(b.role);
        if (byRole !== 0) {
          return byRole;
        }
        return Date.parse(b.lastActivityAt || b.createdAt) - Date.parse(a.lastActivityAt || a.createdAt);
      });
  }, [query, roleFilter, users]);

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedUserId("");
      return;
    }
    if (!filteredUsers.some((item) => item.id === selectedUserId)) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || filteredUsers[0] || null,
    [filteredUsers, selectedUserId, users],
  );

  const stats = useMemo(() => ({
    totalUsers: users.length,
    privilegedUsers: users.filter((item) => item.role === "reviewer" || item.role === "super_admin").length,
    activeSessions: users.reduce((sum, item) => sum + item.activeSessionCount, 0),
    cloudGrants: users.reduce((sum, item) => sum + item.activeCloudGrantCount, 0),
  }), [users]);

  function replaceUser(nextUser: AdminUserSummary) {
    setUsers((current) => current.map((item) => (item.id === nextUser.id ? nextUser : item)));
    setDraftRoles((current) => ({ ...current, [nextUser.id]: nextUser.role }));
  }

  async function handleSaveRole(user: AdminUserSummary) {
    if (!session?.csrfToken) {
      return;
    }
    const nextRole = draftRoles[user.id] || user.role;
    setBusyKey(`role:${user.id}`);
    setMessage("");
    setError("");
    try {
      const response = await updateAdminUserRole(user.id, nextRole, session.csrfToken);
      replaceUser(response.user);
      setMessage(`Role updated: ${response.user.email} is now ${humanizeEnum(response.user.role)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update user role");
    } finally {
      setBusyKey("");
    }
  }

  async function handleRevokeSessions(user: AdminUserSummary) {
    if (!session?.csrfToken) {
      return;
    }
    setBusyKey(`sessions:${user.id}`);
    setMessage("");
    setError("");
    try {
      const response = await revokeAdminUserSessions(user.id, session.csrfToken);
      replaceUser(response.user);
      setMessage(`Revoked ${response.revokedCount} session${response.revokedCount === 1 ? "" : "s"} for ${response.user.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke sessions");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 space-y-8">
      <div className="rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(8,15,31,0.98),rgba(17,24,39,0.95),rgba(14,30,56,0.94))] p-8 shadow-[0_34px_100px_rgba(2,6,23,0.5)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/40 bg-cyan-950/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-200">
              Identity And Access
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">User management, role control, and operator traceability.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                This surface separates identity operations from general platform settings. Manage who can review, who can administer,
                and what activity trail exists for each account without digging through the full admin dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin">
                <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">Back To Admin</Button>
              </Link>
              <Link to="/review">
                <Button className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Review Queue
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[420px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Accounts</div>
              <div className="mt-2 text-3xl font-semibold text-white">{stats.totalUsers}</div>
              <div className="mt-1 text-xs text-slate-400">Persisted identities in Hub</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Privileged Operators</div>
              <div className="mt-2 text-3xl font-semibold text-white">{stats.privilegedUsers}</div>
              <div className="mt-1 text-xs text-slate-400">Reviewer and super admin accounts</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Sessions</div>
              <div className="mt-2 text-3xl font-semibold text-white">{stats.activeSessions}</div>
              <div className="mt-1 text-xs text-slate-400">Current live session records</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Cloud Grants</div>
              <div className="mt-2 text-3xl font-semibold text-white">{stats.cloudGrants}</div>
              <div className="mt-1 text-xs text-slate-400">Issued cloud-console access still alive</div>
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.55fr]">
        <Card className="border-slate-800/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(9,15,28,0.94))]">
          <CardHeader>
            <CardTitle className="text-lg">Directory</CardTitle>
            <CardDescription>Filter by role, search by email or provider, then open an account for detailed controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_150px] xl:grid-cols-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  className="border-slate-700 bg-[#0a0e17] pl-9"
                  placeholder="Search email, GitHub login, or provider"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)}
              >
                <option value="all">All roles</option>
                <option value="user">User</option>
                <option value="reviewer">Reviewer</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const selected = user.id === selectedUser?.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-100">{user.email}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={roleBadgeVariant(user.role)}>{humanizeEnum(user.role)}</Badge>
                          {user.primaryAuthProvider ? <Badge variant="outline">{humanizeEnum(user.primaryAuthProvider)}</Badge> : null}
                          {user.activeSessionCount > 0 ? <Badge variant="success">{user.activeSessionCount} live session{user.activeSessionCount === 1 ? "" : "s"}</Badge> : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{formatRelativeDate(user.lastActivityAt || user.createdAt)}</div>
                        <div className="mt-1">created {formatRelativeDate(user.createdAt)}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-slate-400">
                      <div>
                        <div className="text-slate-500">Submissions</div>
                        <div className="mt-1 text-sm text-slate-200">{user.submissionCount}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Reviews</div>
                        <div className="mt-1 text-sm text-slate-200">{user.reviewCount}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Audit</div>
                        <div className="mt-1 text-sm text-slate-200">{user.auditCount}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Grants</div>
                        <div className="mt-1 text-sm text-slate-200">{user.activeCloudGrantCount}</div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!loading && filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
                  No users matched the current filters.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(7,14,28,0.96))]">
            <CardHeader>
              <CardTitle className="text-lg">Account Detail</CardTitle>
              <CardDescription>Role assignment, session control, provider linkage, and recent operator trace for the selected account.</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUser ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Selected Account</div>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{selectedUser.email}</h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={roleBadgeVariant(selectedUser.role)}>{humanizeEnum(selectedUser.role)}</Badge>
                        {selectedUser.primaryAuthProvider ? <Badge variant="outline">Primary {humanizeEnum(selectedUser.primaryAuthProvider)}</Badge> : null}
                        {(selectedUser.linkedProviders || []).map((provider) => (
                          <Badge key={provider} variant="outline">{humanizeEnum(provider)}</Badge>
                        ))}
                        {selectedUser.twoFactorEnabled ? <Badge variant="success">2FA configured</Badge> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm text-slate-300">
                      <div>Last auth: <span className="text-slate-100">{selectedUser.lastAuthAt ? formatRelativeDate(selectedUser.lastAuthAt) : "Unknown"}</span></div>
                      <div className="mt-1">Last activity: <span className="text-slate-100">{formatRelativeDate(selectedUser.lastActivityAt || selectedUser.createdAt)}</span></div>
                      <div className="mt-1">Account age: <span className="text-slate-100">{formatRelativeDate(selectedUser.createdAt)}</span></div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Live Sessions</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{selectedUser.activeSessionCount}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Cloud Grants</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{selectedUser.activeCloudGrantCount}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Submissions</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{selectedUser.submissionCount}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Reviews</div>
                      <div className="mt-2 text-3xl font-semibold text-white">{selectedUser.reviewCount}</div>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,rgba(5,10,22,0.9),rgba(12,22,43,0.95))] p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                        <ShieldCheck className="h-4 w-4 text-cyan-300" />
                        Role Control
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Promote reviewers, keep privileged seats scarce, and avoid locking the platform by removing the final super admin.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <select
                          className="h-11 rounded-xl border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200"
                          value={draftRoles[selectedUser.id] || selectedUser.role}
                          onChange={(event) => setDraftRoles((current) => ({ ...current, [selectedUser.id]: event.target.value as UserRole }))}
                          disabled={selectedUser.id === session?.user?.id}
                        >
                          <option value="user">User</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            className="gap-2"
                            disabled={selectedUser.id === session?.user?.id || busyKey === `role:${selectedUser.id}`}
                            onClick={() => void handleSaveRole(selectedUser)}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Save Role
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2 border-slate-700 text-slate-200 hover:bg-slate-800"
                            disabled={selectedUser.id === session?.user?.id || busyKey === `sessions:${selectedUser.id}`}
                            onClick={() => void handleRevokeSessions(selectedUser)}
                          >
                            <KeyRound className="h-4 w-4" />
                            Revoke Sessions
                          </Button>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs leading-6 text-slate-500">
                          {selectedUser.id === session?.user?.id
                            ? "Self role changes and self session revocation are blocked in this surface. Use another super admin if you need to change your own access."
                            : "Role changes are audited. Session revocation deletes all saved sessions for the target account and forces a fresh sign-in."}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-[linear-gradient(180deg,rgba(7,13,25,0.92),rgba(18,12,36,0.92))] p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                        <Users className="h-4 w-4 text-violet-300" />
                        Access Profile
                      </div>
                      <div className="mt-4 grid gap-4 text-sm text-slate-300">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                            <User className="h-4 w-4" />
                            Identity
                          </div>
                          <div className="mt-3 space-y-1">
                            <div>ID: <span className="font-mono text-slate-100">{selectedUser.id}</span></div>
                            <div>GitHub login: <span className="text-slate-100">{selectedUser.githubLogin || "None"}</span></div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                            <Activity className="h-4 w-4" />
                            Activity Envelope
                          </div>
                          <div className="mt-3 space-y-1">
                            <div>Total audit events: <span className="text-slate-100">{selectedUser.auditCount}</span></div>
                            <div>Total sessions: <span className="text-slate-100">{selectedUser.sessionCount}</span></div>
                            <div>2FA configured: <span className="text-slate-100">{selectedUser.twoFactorEnabled ? "Yes" : "No"}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
                  Select a user to inspect roles, sessions, and audit trail.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(9,12,26,0.98))]">
            <CardHeader>
              <CardTitle className="text-lg">Recent Audit Trail</CardTitle>
              <CardDescription>
                Focused operator timeline for the selected account, pulled from Hub audit logs rather than the full global stream.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUser?.recentAudit.length ? (
                <div className="space-y-3">
                  {selectedUser.recentAudit.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{humanizeEnum(entry.action)}</Badge>
                            <Badge variant="secondary">{humanizeEnum(entry.targetType)}</Badge>
                          </div>
                          <div className="mt-2 text-sm text-slate-200">{entry.targetId}</div>
                          {entry.metadata ? (
                            <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-[#0a0e17] px-3 py-2 text-xs text-slate-400">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <div>{formatRelativeDate(entry.createdAt)}</div>
                          <div className="mt-1 font-mono">{entry.actorUserId || "system"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-10 text-center text-sm text-slate-500">
                  No audit events have been recorded for this account yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
