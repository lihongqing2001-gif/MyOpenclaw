import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSession, type SessionPayload } from "@/lib/api";

interface PlatformContextValue {
  session: SessionPayload | null;
  loading: boolean;
  refreshSession: () => Promise<SessionPayload | null>;
  setSession: (value: SessionPayload | null) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const next = await getSession();
      setSession(next);
      return next;
    } catch {
      const fallback = {
        authenticated: false,
        user: null,
        csrfToken: null,
        twoFactorPassed: false,
        requiresAdminTwoFactor: false,
        githubOauthConfigured: false,
      } satisfies SessionPayload;
      setSession(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      session,
      loading,
      refreshSession,
      setSession,
    }),
    [loading, refreshSession, session],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatform must be used inside PlatformProvider");
  }
  return context;
}
