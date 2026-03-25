import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminTwoFactorSetup, verifyAdminTwoFactor } from "@/lib/api";
import { usePlatform } from "@/lib/platform";

export function Admin2FA() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<null | Awaited<ReturnType<typeof getAdminTwoFactorSetup>>>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);
  const { session, refreshSession } = usePlatform();
  const navigate = useNavigate();

  useEffect(() => {
    if (session?.twoFactorPassed) {
      navigate("/admin", { replace: true });
    }
  }, [navigate, session?.twoFactorPassed]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.authenticated || session.user?.role !== "super_admin") {
      return;
    }
    void getAdminTwoFactorSetup()
      .then((payload) => {
        if (!cancelled) {
          setSetup(payload);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setMessage(cause instanceof Error ? cause.message : "Failed to load 2FA setup details");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.authenticated, session?.user?.role]);

  if (!session?.authenticated || !session.user) {
    return <Navigate to="/login" replace />;
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
    } catch {
      setMessage("Copy failed. You can still select the text manually.");
    }
  }

  function focusIndex(index: number) {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  }

  function applyCode(rawValue: string, startIndex = 0) {
    const normalized = rawValue.replace(/\D/g, "").slice(0, 6);
    if (!normalized) {
      return;
    }
    setDigits((current) => {
      const next = [...current];
      for (let offset = 0; offset < normalized.length && startIndex + offset < next.length; offset += 1) {
        next[startIndex + offset] = normalized[offset] || "";
      }
      return next;
    });
    const nextFocusIndex = Math.min(startIndex + normalized.length, 5);
    window.setTimeout(() => focusIndex(nextFocusIndex), 0);
  }

  async function handleVerify() {
    if (!session || !session.csrfToken || code.length !== 6) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await verifyAdminTwoFactor(code, session.csrfToken);
      await refreshSession();
      navigate("/admin", { replace: true });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "2FA verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0a0e17] to-[#0a0e17] -z-10" />

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Admin Verification</h2>
          <p className="text-slate-400">Super admin access requires two-factor authentication.</p>
        </div>

        <Card className="border-slate-800/60 bg-[#0f172a]/80 backdrop-blur-md shadow-xl shadow-black/40">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Enter 2FA Code</CardTitle>
            <CardDescription className="text-center">
              Open your authenticator app and enter the 6-digit code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {setup ? (
              <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-slate-100">No authenticator yet?</div>
                  <div className="text-sm text-slate-400 mt-1">
                    In Google Authenticator, 1Password, Microsoft Authenticator, or similar, choose{" "}
                    <span className="font-mono text-slate-300">Add account</span>
                    {" "}
                    <span className="text-slate-500">&rarr;</span>
                    {" "}
                    <span className="font-mono text-slate-300">Enter setup key</span>.
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-slate-500 mb-1">Account name</div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-200">
                      {setup.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Issuer</div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-200">
                      {setup.issuer}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">TOTP Secret</div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-amber-200 font-mono break-all">
                        {setup.secret}
                      </div>
                      <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => void copyText(setup.secret)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div
              className="flex justify-center gap-2"
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                if (!pasted) {
                  return;
                }
                event.preventDefault();
                applyCode(pasted, 0);
              }}
            >
              {digits.map((digit, index) => (
                <Input
                  key={index}
                  ref={(node) => {
                    inputRefs.current[index] = node;
                  }}
                  type="text"
                  maxLength={1}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  value={digit}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    const normalized = rawValue.replace(/\D/g, "");
                    if (!normalized) {
                      setDigits((current) => {
                        const next = [...current];
                        next[index] = "";
                        return next;
                      });
                      return;
                    }
                    if (normalized.length > 1) {
                      applyCode(normalized, index);
                      return;
                    }
                    setDigits((current) => {
                      const next = [...current];
                      next[index] = normalized;
                      return next;
                    });
                    if (index < 5) {
                      window.setTimeout(() => focusIndex(index + 1), 0);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !digits[index] && index > 0) {
                      event.preventDefault();
                      setDigits((current) => {
                        const next = [...current];
                        next[index - 1] = "";
                        return next;
                      });
                      window.setTimeout(() => focusIndex(index - 1), 0);
                      return;
                    }
                    if (event.key === "ArrowLeft" && index > 0) {
                      event.preventDefault();
                      focusIndex(index - 1);
                      return;
                    }
                    if (event.key === "ArrowRight" && index < 5) {
                      event.preventDefault();
                      focusIndex(index + 1);
                    }
                  }}
                  className="w-12 h-14 text-center text-2xl font-mono bg-[#0a0e17] border-slate-700 focus:border-blue-500/50"
                />
              ))}
            </div>

            {message && (
              <div className="rounded-md border border-slate-800 bg-[#0a0e17] px-3 py-2 text-sm text-slate-300">
                {message}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1">
                <KeyRound className="w-4 h-4" />
                Security Key
              </span>
              <Button
                variant="link"
                className="text-blue-400 h-auto p-0"
                onClick={() => setMessage("Current build supports authenticator app codes only. Security key login is not wired yet.")}
              >
                Use authenticator only
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 gap-2 shadow-sm shadow-blue-900/20" disabled={busy || code.length !== 6} onClick={() => void handleVerify()}>
              {busy ? "Verifying..." : "Verify & Access"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
