import crypto from "node:crypto";
import type { Request, Response } from "express";

const accessAudience = "solocore-console";
const sessionAudience = "solocore-console-session";
const sessionCookieName = "solocore_console_session";

export interface CloudConsoleAccessClaims {
  aud: string;
  sub: string;
  email: string;
  role: string;
  grantId: string;
  iat: number;
  exp: number;
  sessionExp?: number;
}

function accessSecret() {
  return (
    process.env.SOLOCORE_CONSOLE_ACCESS_SECRET ||
    process.env.OPENCLAW_CONSOLE_ACCESS_SECRET ||
    ""
  ).trim();
}

function internalToken() {
  return (
    process.env.SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN ||
    process.env.OPENCLAW_CLOUD_CONSOLE_INTERNAL_TOKEN ||
    ""
  ).trim();
}

function secureCookiesEnabled() {
  if (process.env.SOLOCORE_CONSOLE_SECURE_COOKIE === "1") {
    return true;
  }
  if (process.env.SOLOCORE_CONSOLE_SECURE_COOKIE === "0") {
    return false;
  }
  const publicUrl =
    process.env.SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL ||
    process.env.OPENCLAW_CLOUD_CONSOLE_PUBLIC_URL ||
    "";
  return publicUrl.startsWith("https://");
}

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }
  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) {
          return [part, ""];
        }
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function signToken(payload: Record<string, unknown>) {
  const secret = accessSecret();
  if (!secret) {
    throw new Error("SOLOCORE_CONSOLE_ACCESS_SECRET is not configured");
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string) {
  const secret = accessSecret();
  if (!secret || !token.includes(".")) {
    return null;
  }
  const [encodedPayload, signature] = token.split(".", 2);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8")) as CloudConsoleAccessClaims;
  } catch {
    return null;
  }
}

export function cloudConsoleAccessEnabled() {
  return Boolean(accessSecret());
}

export function requestHasInternalConsoleAccess(req: Request) {
  const token = internalToken();
  if (!token) {
    return false;
  }
  return req.header("x-solocore-internal-token") === token;
}

export function readConsoleSession(req: Request) {
  const token = parseCookies(req.headers.cookie).get(sessionCookieName) || "";
  const payload = verifyToken(token);
  if (!payload || payload.aud !== sessionAudience || payload.exp * 1000 <= Date.now()) {
    return null;
  }
  return payload;
}

export function acceptConsoleGrant(grantToken: string) {
  const payload = verifyToken(grantToken);
  if (!payload || payload.aud !== accessAudience || payload.exp * 1000 <= Date.now()) {
    return null;
  }
  return payload;
}

export function setConsoleSessionCookie(res: Response, payload: CloudConsoleAccessClaims) {
  const sessionExp = payload.sessionExp && payload.sessionExp > payload.iat ? payload.sessionExp : payload.exp;
  const token = signToken({
    ...payload,
    aud: sessionAudience,
    exp: sessionExp,
  });
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    expires: new Date(sessionExp * 1000),
  });
}

export function clearConsoleSessionCookie(res: Response) {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
  });
}
