import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { loadDatabase, saveDatabase } from "./store";
import { Session, User, UserRole } from "../contracts/types";

const sessionSecret = process.env.OPENCLAW_WEB_SESSION_SECRET || "change-me";
const downloadSecret = process.env.OPENCLAW_WEB_DOWNLOAD_SECRET || "change-me-too";

type WindowCounter = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, WindowCounter>();

export function generateToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function signDownloadToken(parts: Record<string, string>) {
  const payload = Object.entries(parts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHmac("sha256", downloadSecret).update(payload).digest("hex");
}

export function verifyDownloadToken(parts: Record<string, string>, signature: string) {
  const expected = signDownloadToken(parts);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function rateLimit(prefix: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${prefix}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (current.count >= limit) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    current.count += 1;
    next();
  };
}

export function setSessionCookie(res: Response, sessionId: string) {
  res.cookie("oc_web_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie("oc_web_session");
}

export function sessionFromRequest(req: Request): { session: Session; user: User } | null {
  const sessionId = typeof req.cookies?.oc_web_session === "string" ? req.cookies.oc_web_session : "";
  if (!sessionId) {
    return null;
  }
  const db = loadDatabase();
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return null;
  }
  if (Date.parse(session.expiresAt) < Date.now()) {
    db.sessions = db.sessions.filter((item) => item.id !== sessionId);
    saveDatabase(db);
    return null;
  }
  const user = db.users.find((item) => item.id === session.userId);
  if (!user) {
    return null;
  }
  return { session, user };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = sessionFromRequest(req);
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  (req as Request & { auth?: typeof auth }).auth = auth;
  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: { session: Session; user: User } }).auth;
    if (!auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(auth.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireAdminTwoFactor(req: Request, res: Response, next: NextFunction) {
  const auth = (req as Request & { auth?: { session: Session; user: User } }).auth;
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (auth.user.role === "super_admin" && !auth.session.twoFactorPassed) {
    res.status(403).json({ error: "Admin 2FA required" });
    return;
  }
  next();
}

export function enforceCsrf(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const auth = (req as Request & { auth?: { session: Session; user: User } }).auth;
  if (!auth) {
    next();
    return;
  }
  const token = req.header("x-openclaw-csrf") || "";
  if (token !== auth.session.csrfToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }
  next();
}
