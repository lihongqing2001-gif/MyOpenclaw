import { useEffect, useMemo, useState } from "react";
import { Navigate, Link, useNavigate, useSearchParams } from "react-router-dom";
import { GitBranch, Mail, RefreshCcw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, requestEmailCode, verifyEmailCode } from "@/lib/api";
import { usePlatform } from "@/lib/platform";

export function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const { session, refreshSession, setSession } = usePlatform();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/me";
  const resendSeconds = useMemo(
    () => Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000)),
    [cooldownUntil, nowTick],
  );

  if (session?.authenticated) {
    return <Navigate to={session.requiresAdminTwoFactor ? "/admin/2fa" : redirectTo} replace />;
  }

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [resendSeconds]);

  async function handleRequestCode() {
    if (!email) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await requestEmailCode(email);
      setStep("verify");
      setDebugCode(response.debugCode || "");
      setCooldownUntil(Date.now() + 30 * 1000);
      setNowTick(Date.now());
      setMessage(`Verification code sent via ${response.delivery}. Check your inbox and spam folder.`);
    } catch (cause) {
      if (cause instanceof ApiError && typeof cause.detail === "object" && cause.detail && "retryAfterSeconds" in (cause.detail as Record<string, unknown>)) {
        const retryAfterSeconds = Number((cause.detail as Record<string, unknown>).retryAfterSeconds || 0);
        if (retryAfterSeconds > 0) {
          setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
          setNowTick(Date.now());
        }
      }
      setMessage(cause instanceof Error ? cause.message : "Failed to request code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!email || !code) return;
    setLoading(true);
    setMessage("");
    try {
      const verified = await verifyEmailCode(email, code);
      setSession({
        authenticated: true,
        user: verified.user,
        csrfToken: verified.csrfToken,
        twoFactorPassed: !verified.requiresAdminTwoFactor,
        requiresAdminTwoFactor: verified.requiresAdminTwoFactor,
        githubOauthConfigured: session?.githubOauthConfigured ?? false,
      });
      const next = await refreshSession();
      navigate(next?.requiresAdminTwoFactor ? "/admin/2fa" : redirectTo);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Failed to verify code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0a0e17] to-[#0a0e17] -z-10" />

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2 text-slate-100 hover:text-white transition-colors mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-2xl">SoloCore Hub</span>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome back</h2>
          <p className="text-slate-400">Sign in to manage submissions, review packages, and request signed downloads.</p>
        </div>

        <Card className="border-slate-800/60 bg-[#0f172a]/80 backdrop-blur-md shadow-xl shadow-black/40">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Choose your preferred sign in method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session?.githubOauthConfigured ? (
              <a href={`/auth/github/start?redirectTo=${encodeURIComponent(redirectTo)}`}>
                <Button className="w-full h-12 gap-3 bg-[#24292e] hover:bg-[#2f363d] text-white border border-slate-700/50 shadow-sm">
                  <GitBranch className="w-5 h-5" />
                  Continue with GitHub
                </Button>
              </a>
            ) : (
              <div className="space-y-2">
                <Button className="w-full h-12 gap-3 bg-slate-800 text-slate-500 border border-slate-700/50 shadow-sm" disabled>
                <GitBranch className="w-5 h-5" />
                  GitHub OAuth not configured
                </Button>
                <p className="text-xs text-slate-500 text-center">Use the email login flow below until GitHub OAuth secrets are configured.</p>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0f172a] px-2 text-slate-500">Or continue with email</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">Email address</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="bg-[#0a0e17] border-slate-800 focus:border-blue-500/50"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  readOnly={step === "verify"}
                />
              </div>
              {step === "verify" && (
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium text-slate-300">Verification code</label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="6-digit code"
                    className="bg-[#0a0e17] border-slate-800 focus:border-blue-500/50"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </div>
              )}
              {debugCode && (
                <div className="rounded-md border border-blue-900/40 bg-blue-950/20 px-3 py-2 text-sm text-blue-200">
                  Debug code: <span className="font-mono">{debugCode}</span>
                </div>
              )}
              {message && (
                <div className="rounded-md border border-slate-800 bg-[#0a0e17] px-3 py-2 text-sm text-slate-300">
                  {message}
                </div>
              )}
              {step === "request" ? (
                <Button
                  variant="secondary"
                  className="w-full h-12 gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200"
                  onClick={() => void handleRequestCode()}
                  disabled={loading || !email}
                >
                  <Mail className="w-4 h-4" />
                  {loading ? "Sending..." : "Send Code"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="secondary"
                    className="w-full h-12 gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200"
                    onClick={() => void handleRequestCode()}
                    disabled={loading || resendSeconds > 0}
                  >
                    <RefreshCcw className="w-4 h-4" />
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : loading ? "Sending..." : "Resend Code"}
                  </Button>
                  <Button
                    className="w-full h-12 gap-2"
                    onClick={() => void handleVerifyCode()}
                    disabled={loading || !code}
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </Button>
                  <div className="text-xs text-slate-500 text-center">
                    Need a different address? Refresh the page and start again.
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 text-center text-sm text-slate-500">
            <p>
              By signing in, you agree to the current SoloCore Hub access and moderation flow.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
