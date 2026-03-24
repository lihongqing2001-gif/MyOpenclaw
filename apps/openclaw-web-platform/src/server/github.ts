import fs from "node:fs";
import path from "node:path";
import { GithubOAuthState } from "../contracts/types";
import { CommunityPackageManifest } from "../contracts/community-package";
import { createId, loadDatabase, saveDatabase } from "./store";

const githubClientId = process.env.GITHUB_CLIENT_ID || "";
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";
const githubCallbackUrl =
  process.env.GITHUB_CALLBACK_URL || "http://127.0.0.1:3400/auth/github/callback";
const githubReleaseRepo = process.env.GITHUB_RELEASE_REPO || "";
const githubToken = process.env.GITHUB_TOKEN || "";

export function githubOauthConfigured() {
  return Boolean(githubClientId && githubClientSecret && githubCallbackUrl);
}

export function createGithubOAuthState(input: {
  mode: "login" | "link";
  userId?: string;
  redirectTo?: string;
}) {
  const db = loadDatabase();
  const state: GithubOAuthState = {
    id: createId("ghstate"),
    mode: input.mode,
    userId: input.userId,
    redirectTo: input.redirectTo,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  db.oauthStates.push(state);
  saveDatabase(db);
  return state;
}

export function consumeGithubOAuthState(stateId: string) {
  const db = loadDatabase();
  const state = db.oauthStates.find((item) => item.id === stateId);
  if (!state) {
    return null;
  }
  db.oauthStates = db.oauthStates.filter((item) => item.id !== stateId);
  saveDatabase(db);
  if (Date.parse(state.expiresAt) < Date.now()) {
    return null;
  }
  return state;
}

export function buildGithubAuthorizeUrl(stateId: string) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId);
  url.searchParams.set("redirect_uri", githubCallbackUrl);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", stateId);
  return url.toString();
}

export async function exchangeGithubCode(code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: githubCallbackUrl,
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!payload.access_token) {
    throw new Error(payload.error || "GitHub access token missing");
  }
  return payload.access_token;
}

export async function fetchGithubIdentity(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "OpenClaw-Web-Platform",
  };
  const userResponse = await fetch("https://api.github.com/user", { headers });
  if (!userResponse.ok) {
    throw new Error(`GitHub user fetch failed: ${userResponse.status}`);
  }
  const user = (await userResponse.json()) as { id: number; login: string; email?: string | null };
  let email = user.email || "";
  if (!email) {
    const emailResponse = await fetch("https://api.github.com/user/emails", { headers });
    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{ email: string; primary?: boolean; verified?: boolean }>;
      email = emails.find((item) => item.primary)?.email || emails[0]?.email || "";
    }
  }
  if (!email) {
    throw new Error("GitHub account email is unavailable");
  }
  return {
    githubUserId: String(user.id),
    githubLogin: user.login,
    email,
  };
}

function releaseRepoParts() {
  const [owner, repo] = githubReleaseRepo.split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_RELEASE_REPO must be set as owner/repo");
  }
  return { owner, repo };
}

function githubHeaders() {
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required for GitHub release sync");
  }
  return {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "OpenClaw-Web-Platform",
  };
}

export async function syncPackageToGithubRelease(options: {
  packageId: string;
  version: string;
  archivePath: string;
  manifest: CommunityPackageManifest;
  official: boolean;
}) {
  const { owner, repo } = releaseRepoParts();
  const tag = `${options.packageId.replaceAll("/", "__")}-v${options.version}`;
  const releaseName = `${options.manifest.name} v${options.version}`;
  const body = [
    options.manifest.description,
    "",
    `Package ID: ${options.packageId}`,
    `Visibility: ${options.official ? "official" : "community"}`,
  ].join("\n");

  const createResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tag_name: tag,
      name: releaseName,
      body,
      draft: false,
      prerelease: false,
    }),
  });

  let releasePayload: any;
  if (createResponse.status === 422) {
    const existingResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
      headers: githubHeaders(),
    });
    if (!existingResponse.ok) {
      throw new Error(`Failed to fetch existing GitHub release for ${tag}`);
    }
    releasePayload = await existingResponse.json();
  } else {
    if (!createResponse.ok) {
      throw new Error(`Failed to create GitHub release: ${createResponse.status}`);
    }
    releasePayload = await createResponse.json();
  }

  const archiveName = path.basename(options.archivePath);
  const uploadUrl = String(releasePayload.upload_url).replace("{?name,label}", `?name=${encodeURIComponent(archiveName)}`);
  const archiveBuffer = fs.readFileSync(options.archivePath);
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/zip",
      "Content-Length": String(archiveBuffer.length),
    },
    body: archiveBuffer,
  });

  let assetPayload: any = null;
  if (uploadResponse.ok) {
    assetPayload = await uploadResponse.json();
  } else if (uploadResponse.status === 422) {
    assetPayload = (releasePayload.assets || []).find((item: any) => item.name === archiveName) || null;
  } else {
    throw new Error(`Failed to upload GitHub release asset: ${uploadResponse.status}`);
  }

  return {
    githubReleaseTag: tag,
    githubReleaseUrl: releasePayload.html_url as string,
    githubAssetUrl: assetPayload?.browser_download_url || "",
    githubSyncStatus: "synced" as const,
    githubSyncAt: new Date().toISOString(),
  };
}
