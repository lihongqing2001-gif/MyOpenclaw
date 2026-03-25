import crypto from "node:crypto";
import {
  CloudConsoleAccessCode,
  CloudConsoleGrant,
  User,
} from "../contracts/types";
import { WebPlatformDatabase } from "./store";
import { createId } from "./store";

const grantAudience = "solocore-console";

function accessSecret() {
  return (
    process.env.SOLOCORE_CONSOLE_ACCESS_SECRET ||
    process.env.OPENCLAW_CONSOLE_ACCESS_SECRET ||
    ""
  ).trim();
}

export function cloudConsolePublicBaseUrl() {
  return (
    process.env.SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL ||
    process.env.OPENCLAW_CLOUD_CONSOLE_PUBLIC_URL ||
    process.env.SOLOCORE_CLOUD_CONSOLE_URL ||
    process.env.OPENCLAW_CLOUD_CONSOLE_URL ||
    ""
  ).replace(/\/+$/, "");
}

function launchTtlMinutes() {
  const raw = Number(process.env.SOLOCORE_CONSOLE_LAUNCH_TTL_MINUTES || "5");
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function grantTtlHours() {
  const raw = Number(process.env.SOLOCORE_CONSOLE_GRANT_TTL_HOURS || "12");
  return Number.isFinite(raw) && raw > 0 ? raw : 12;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function normalizeAccessCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function hashAccessCode(code: string) {
  return crypto.createHash("sha256").update(normalizeAccessCode(code)).digest("hex");
}

function signPayload(payload: Record<string, unknown>) {
  const secret = accessSecret();
  if (!secret) {
    throw new Error("SOLOCORE_CONSOLE_ACCESS_SECRET is not configured");
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function generateHumanCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join(""),
  );
  return `SC-${segments.join("-")}`;
}

export function cloudConsoleAccessEnabled() {
  return Boolean(accessSecret() && cloudConsolePublicBaseUrl());
}

export function expireCloudConsoleRecords(db: WebPlatformDatabase) {
  const now = Date.now();
  db.cloudConsoleAccessCodes = db.cloudConsoleAccessCodes.map((item) => {
    if (!item.revokedAt && Date.parse(item.expiresAt) <= now) {
      return {
        ...item,
        revokedAt: item.revokedAt || new Date(now).toISOString(),
      };
    }
    return item;
  });
  db.cloudConsoleGrants = db.cloudConsoleGrants.map((item) => {
    if (item.status === "active" && Date.parse(item.expiresAt) <= now) {
      return {
        ...item,
        status: "expired",
      };
    }
    return item;
  });
}

export function findActiveCloudConsoleGrant(db: WebPlatformDatabase, userId: string) {
  expireCloudConsoleRecords(db);
  const now = Date.now();
  return db.cloudConsoleGrants
    .filter((item) => item.userId === userId && item.status === "active" && Date.parse(item.expiresAt) > now)
    .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0] || null;
}

export function createCloudConsoleAccessCode(
  db: WebPlatformDatabase,
  createdByUserId: string,
  input: {
    label: string;
    note?: string;
    expiresInHours?: number;
    maxUses?: number;
  },
) {
  const plainCode = generateHumanCode();
  const now = new Date();
  const expiresInHours = input.expiresInHours && input.expiresInHours > 0 ? input.expiresInHours : 72;
  const maxUses = input.maxUses && input.maxUses > 0 ? Math.floor(input.maxUses) : 1;
  const record: CloudConsoleAccessCode = {
    id: createId("console_code"),
    label: input.label.trim() || "SoloCore Cloud Access",
    note: input.note?.trim() || undefined,
    codePreview: `${plainCode.slice(0, 7)}****${plainCode.slice(-4)}`,
    codeHash: hashAccessCode(plainCode),
    maxUses,
    usedCount: 0,
    createdByUserId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString(),
  };
  db.cloudConsoleAccessCodes.push(record);
  return { record, plainCode };
}

export function redeemCloudConsoleAccessCode(
  db: WebPlatformDatabase,
  user: User,
  rawCode: string,
) {
  expireCloudConsoleRecords(db);
  const codeHash = hashAccessCode(rawCode);
  const now = new Date();
  const code = db.cloudConsoleAccessCodes.find(
    (item) =>
      item.codeHash === codeHash &&
      !item.revokedAt &&
      item.usedCount < item.maxUses &&
      Date.parse(item.expiresAt) > now.getTime(),
  );
  if (!code) {
    throw new Error("Authorization code is invalid or expired");
  }

  db.cloudConsoleGrants = db.cloudConsoleGrants.map((item) =>
    item.userId === user.id && item.status === "active"
      ? { ...item, status: "revoked", revokedAt: now.toISOString() }
      : item,
  );

  code.usedCount += 1;
  code.lastRedeemedAt = now.toISOString();

  const grant: CloudConsoleGrant = {
    id: createId("console_grant"),
    codeId: code.id,
    userId: user.id,
    userEmail: user.email,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + grantTtlHours() * 60 * 60 * 1000).toISOString(),
  };
  db.cloudConsoleGrants.push(grant);
  return { code, grant };
}

export function issueCloudConsoleLaunchToken(grant: CloudConsoleGrant, user: User) {
  if (grant.status !== "active" || Date.parse(grant.expiresAt) <= Date.now()) {
    throw new Error("Cloud console grant is not active");
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + launchTtlMinutes() * 60;
  return signPayload({
    aud: grantAudience,
    jti: createId("console_launch"),
    grantId: grant.id,
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp,
    sessionExp: Math.floor(Date.parse(grant.expiresAt) / 1000),
  });
}

export function buildCloudConsoleLaunchUrl(token: string) {
  const baseUrl = cloudConsolePublicBaseUrl();
  if (!baseUrl) {
    throw new Error("SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL is not configured");
  }
  return `${baseUrl}/auth/access?grant=${encodeURIComponent(token)}`;
}
