import { useEffect, useState } from "react";
import { KeyRound, Rocket, ShieldCheck, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getCloudConsoleAccess,
  launchCloudConsole,
  redeemCloudConsoleAccessCode,
} from "@/lib/api";
import { usePlatform } from "@/lib/platform";

export function CloudConsoleAccess() {
  const { session } = usePlatform();
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getCloudConsoleAccess>> | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCloudConsoleAccess()
      .then((payload) => {
        if (!cancelled) {
          setAccess(payload);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load cloud console access");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRedeem() {
    if (!session?.csrfToken || !code.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await redeemCloudConsoleAccessCode(code, session.csrfToken);
      setAccess(response.access);
      setMessage("Authorization code accepted. Launching SoloCore Console...");
      window.location.href = response.launchUrl;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to redeem authorization code");
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch() {
    if (!session?.csrfToken) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await launchCloudConsole(session.csrfToken);
      setAccess(response.access);
      setMessage("Opening your cloud SoloCore Console...");
      window.location.href = response.launchUrl;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to launch cloud console");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Cloud SoloCore Console Access</h1>
        <p className="text-slate-400">
          Sign in to SoloCore Hub, redeem an authorization code from an admin, then jump into the separate cloud Console runtime.
        </p>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-blue-400" />
              Redeem Authorization Code
            </CardTitle>
            <CardDescription>
              Each code is issued by an administrator and unlocks time-limited access to the cloud Console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              className="bg-[#0a0e17] border-slate-700"
              placeholder="SC-XXXX-XXXX-XXXX-XXXX"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button className="w-full gap-2" onClick={() => void handleRedeem()} disabled={busy || !code.trim()}>
              <ShieldCheck className="w-4 h-4" />
              Redeem And Enter Cloud Console
            </Button>
            <div className="text-xs text-slate-500">
              The cloud Console remains a separate app. Hub only issues the access grant and forwards you in.
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/60 bg-[#0f172a]/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TerminalSquare className="w-5 h-5 text-emerald-400" />
              Current Access State
            </CardTitle>
            <CardDescription>
              Re-launch the Console without asking for a new code until your current grant expires.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div>
              Access Mode:{" "}
              <span className="font-medium text-slate-100">
                {access?.accessEnabled ? "Enabled" : "Not configured"}
              </span>
            </div>
            <div className="break-all">
              Console URL:{" "}
              <span className="font-mono text-slate-100">
                {access?.publicBaseUrl || "not configured"}
              </span>
            </div>
            {access?.activeGrant ? (
              <>
                <div>
                  Active grant expires at{" "}
                  <span className="font-medium text-slate-100">{new Date(access.activeGrant.expiresAt).toLocaleString()}</span>
                </div>
                <Button className="w-full gap-2" variant="secondary" onClick={() => void handleLaunch()} disabled={busy}>
                  <Rocket className="w-4 h-4" />
                  Launch Cloud SoloCore Console
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-[#0a0e17] px-4 py-3 text-slate-400">
                No active grant yet. Redeem an authorization code first.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
