import { useEffect, useState } from "react";
import { Mail, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthEmailSettings, getGithubSettings, getPlatformSummary, getSmtpSettings, saveAuthEmailSettings, saveGithubSettings, saveSmtpSettings, sendSmtpTestEmail } from "@/lib/api";
import { usePlatform } from "@/lib/platform";

export function AdminPlatform() {
  const { session, refreshSession } = usePlatform();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getPlatformSummary>> | null>(null);
  const [githubForm, setGithubForm] = useState({
    clientId: "",
    clientSecret: "",
    callbackUrl: "",
    releaseRepo: "",
    token: "",
  });
  const [smtpForm, setSmtpForm] = useState({
    provider: "qq" as "custom" | "qq",
    host: "smtp.qq.com",
    port: "465",
    user: "",
    pass: "",
    from: "",
    testTo: "",
  });
  const [authEmailForm, setAuthEmailForm] = useState({
    codeTtlMinutes: "10",
    resendCooldownSeconds: "30",
    requestLimitPerWindow: "8",
    requestWindowMinutes: "15",
    verifyLimitPerWindow: "10",
    verifyWindowMinutes: "15",
    adminTwoFactorRequired: true,
  });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getPlatformSummary(), getGithubSettings(), getSmtpSettings(), getAuthEmailSettings()])
      .then(([nextSummary, githubSettings, smtpSettings, authEmailSettings]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setGithubForm(githubSettings);
        setSmtpForm((current) => ({
          ...current,
          provider: smtpSettings.provider,
          host: smtpSettings.host || (smtpSettings.provider === "qq" ? "smtp.qq.com" : ""),
          port: smtpSettings.port || (smtpSettings.provider === "qq" ? "465" : "587"),
          user: smtpSettings.user,
          pass: smtpSettings.pass,
          from: smtpSettings.from,
          testTo: smtpSettings.user,
        }));
        setAuthEmailForm({
          codeTtlMinutes: String(authEmailSettings.codeTtlMinutes),
          resendCooldownSeconds: String(authEmailSettings.resendCooldownSeconds),
          requestLimitPerWindow: String(authEmailSettings.requestLimitPerWindow),
          requestWindowMinutes: String(authEmailSettings.requestWindowMinutes),
          verifyLimitPerWindow: String(authEmailSettings.verifyLimitPerWindow),
          verifyWindowMinutes: String(authEmailSettings.verifyWindowMinutes),
          adminTwoFactorRequired: authEmailSettings.adminTwoFactorRequired,
        });
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load platform settings");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveGithub() {
    if (!session?.csrfToken) return;
    setMessage("");
    setError("");
    try {
      const response = await saveGithubSettings(githubForm, session.csrfToken);
      setMessage(response.githubOauthConfigured ? "GitHub settings saved." : "GitHub settings saved, but OAuth is still incomplete.");
      await refreshSession();
      setSummary((current) => current ? { ...current, githubOauthConfigured: response.githubOauthConfigured } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save GitHub settings");
    }
  }

  async function handleSaveSmtp() {
    if (!session?.csrfToken) return;
    setMessage("");
    setError("");
    try {
      const payload = {
        provider: smtpForm.provider,
        host: smtpForm.provider === "qq" ? "smtp.qq.com" : smtpForm.host,
        port: smtpForm.provider === "qq" ? "465" : smtpForm.port,
        user: smtpForm.user,
        pass: smtpForm.pass,
        from: smtpForm.from || (smtpForm.user ? `SoloCore Hub <${smtpForm.user}>` : ""),
      };
      const response = await saveSmtpSettings(payload, session.csrfToken);
      setMessage(response.smtpConfigured ? "SMTP settings saved." : "SMTP saved, but delivery is still not fully configured.");
      await refreshSession();
      setSummary((current) => current ? { ...current, smtpConfigured: response.smtpConfigured } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save SMTP settings");
    }
  }

  async function handleSendTest() {
    if (!session?.csrfToken) return;
    setMessage("");
    setError("");
    try {
      const response = await sendSmtpTestEmail({ to: smtpForm.testTo || smtpForm.user }, session.csrfToken);
      setMessage(response.delivered ? "SMTP test email sent." : "SMTP test finished, but delivery was not confirmed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to send test email");
    }
  }

  async function handleSaveAuthPolicy() {
    if (!session?.csrfToken) return;
    setMessage("");
    setError("");
    try {
      await saveAuthEmailSettings({
        codeTtlMinutes: Number(authEmailForm.codeTtlMinutes || 10),
        resendCooldownSeconds: Number(authEmailForm.resendCooldownSeconds || 30),
        requestLimitPerWindow: Number(authEmailForm.requestLimitPerWindow || 8),
        requestWindowMinutes: Number(authEmailForm.requestWindowMinutes || 15),
        verifyLimitPerWindow: Number(authEmailForm.verifyLimitPerWindow || 10),
        verifyWindowMinutes: Number(authEmailForm.verifyWindowMinutes || 15),
        adminTwoFactorRequired: authEmailForm.adminTwoFactorRequired,
      }, session.csrfToken);
      setMessage("Auth policy saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save auth policy");
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 space-y-8">
      <div className="rounded-[2rem] border border-slate-800/70 bg-[linear-gradient(135deg,rgba(8,15,31,0.98),rgba(13,24,43,0.95),rgba(17,20,36,0.94))] p-8 shadow-[0_34px_100px_rgba(2,6,23,0.5)]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-900/40 bg-blue-950/30 px-3 py-1 text-xs uppercase tracking-[0.24em] text-blue-200">
            Platform Settings
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Keep authentication, delivery, and release plumbing explicit.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              This page owns GitHub distribution, SMTP delivery, and email sign-in policy. These controls are no longer mixed into the overview surface.
            </p>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Base URL</div><div className="mt-2 text-sm text-white">{summary?.baseUrl || "n/a"}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">GitHub OAuth</div><div className="mt-2 text-sm text-white">{summary?.githubOauthConfigured ? "Configured" : "Missing"}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">SMTP Delivery</div><div className="mt-2 text-sm text-white">{summary?.smtpConfigured ? "Configured" : "Fallback only"}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Admin 2FA Policy</div><div className="mt-2 text-sm text-white">{authEmailForm.adminTwoFactorRequired ? "Required" : "Disabled"}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">GitHub Distribution</CardTitle>
            <CardDescription>OAuth sign-in and release publication configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="GitHub Client ID" value={githubForm.clientId} onChange={(e) => setGithubForm((cur) => ({ ...cur, clientId: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="GitHub Client Secret" value={githubForm.clientSecret} onChange={(e) => setGithubForm((cur) => ({ ...cur, clientSecret: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="GitHub Callback URL" value={githubForm.callbackUrl} onChange={(e) => setGithubForm((cur) => ({ ...cur, callbackUrl: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="GitHub Release Repo" value={githubForm.releaseRepo} onChange={(e) => setGithubForm((cur) => ({ ...cur, releaseRepo: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="GitHub Token" value={githubForm.token} onChange={(e) => setGithubForm((cur) => ({ ...cur, token: e.target.value }))} />
            <Button className="gap-2" onClick={() => void handleSaveGithub()}>
              <Wrench className="h-4 w-4" />
              Save GitHub Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">SMTP Delivery</CardTitle>
            <CardDescription>Transactional email transport for sign-in codes and operator testing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" value={smtpForm.provider} onChange={(e) => setSmtpForm((cur) => ({ ...cur, provider: e.target.value === "custom" ? "custom" : "qq" }))}>
              <option value="qq">QQ Mail</option>
              <option value="custom">Custom SMTP</option>
            </select>
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="SMTP Host" value={smtpForm.host} onChange={(e) => setSmtpForm((cur) => ({ ...cur, host: e.target.value }))} disabled={smtpForm.provider === "qq"} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="SMTP Port" value={smtpForm.port} onChange={(e) => setSmtpForm((cur) => ({ ...cur, port: e.target.value }))} disabled={smtpForm.provider === "qq"} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="SMTP User" value={smtpForm.user} onChange={(e) => setSmtpForm((cur) => ({ ...cur, user: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="SMTP Pass / QQ Auth Code" value={smtpForm.pass} onChange={(e) => setSmtpForm((cur) => ({ ...cur, pass: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="From" value={smtpForm.from} onChange={(e) => setSmtpForm((cur) => ({ ...cur, from: e.target.value }))} />
            <input className="h-10 w-full rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Test recipient email" value={smtpForm.testTo} onChange={(e) => setSmtpForm((cur) => ({ ...cur, testTo: e.target.value }))} />
            <div className="flex flex-wrap gap-3">
              <Button className="gap-2" onClick={() => void handleSaveSmtp()}>
                <Mail className="h-4 w-4" />
                Save SMTP Settings
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800" onClick={() => void handleSendTest()}>
                Send Test Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Sign-In Policy</CardTitle>
          <CardDescription>Throttle email verification while keeping the super-admin 2FA policy explicit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
            <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-700 bg-[#0a0e17]" checked={authEmailForm.adminTwoFactorRequired} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, adminTwoFactorRequired: e.target.checked }))} />
            <span className="space-y-1">
              <span className="block text-sm text-slate-100">Require 2FA for super admin sessions</span>
              <span className="block text-xs text-slate-500">This only applies to `super_admin`. Reviewer moderation access is still controlled separately by role.</span>
            </span>
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Code TTL (minutes)" value={authEmailForm.codeTtlMinutes} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, codeTtlMinutes: e.target.value }))} />
            <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Resend cooldown (seconds)" value={authEmailForm.resendCooldownSeconds} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, resendCooldownSeconds: e.target.value }))} />
            <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Request limit / window" value={authEmailForm.requestLimitPerWindow} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, requestLimitPerWindow: e.target.value }))} />
            <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Request window (minutes)" value={authEmailForm.requestWindowMinutes} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, requestWindowMinutes: e.target.value }))} />
            <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Verify limit / window" value={authEmailForm.verifyLimitPerWindow} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, verifyLimitPerWindow: e.target.value }))} />
            <input className="h-10 rounded-md border border-slate-700 bg-[#0a0e17] px-3 text-sm text-slate-200" placeholder="Verify window (minutes)" value={authEmailForm.verifyWindowMinutes} onChange={(e) => setAuthEmailForm((cur) => ({ ...cur, verifyWindowMinutes: e.target.value }))} />
          </div>
          <Button className="gap-2" onClick={() => void handleSaveAuthPolicy()}>
            <ShieldCheck className="h-4 w-4" />
            Save Auth Policy
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
