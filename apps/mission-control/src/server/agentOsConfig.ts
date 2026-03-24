import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getRuntimeRoot } from "./workspaceTopology";

const homeDir = os.homedir();
const runtimeAgentsRoot = path.join(getRuntimeRoot(), "agent");
const runtimeConfigFile = "agent-os-config-v1.json";
const runtimeConfigPath = path.join(runtimeAgentsRoot, runtimeConfigFile);

// The config lives under ~/.openclaw/runtime/agent/ so runtime state stays outside the product repo.
const defaultAssetRoot = path.join(homeDir, "Documents", "mission-control-assets");

export type NamingContract = {
  typePrefixes: Record<string, string>;
  humanAiPairGuidance: {
    separator: string;
    humanSuffix: string;
    aiSuffix: string;
    description: string;
  };
  statusLabels: {
    draft: string;
    review: string;
    final: string;
  };
  dateFormat: string;
  versionPattern: string;
  draftSuffix: string;
  finalSuffix: string;
};

export type AgentOsConfig = {
  assetRootPath: string;
  namingContract: NamingContract;
  createdAt?: string;
  lastUpdatedAt?: string;
};

const DEFAULT_NAMING_CONTRACT: NamingContract = {
  typePrefixes: {
    plan: "PLN",
    document: "DOC",
    concept: "CPT",
    dataset: "DATA",
    model: "MOD",
    "runtime-evidence": "EVD",
  },
  humanAiPairGuidance: {
    separator: "__",
    humanSuffix: "human",
    aiSuffix: "ai",
    description:
      "Name human/AI pairs using the same base plus the separator and role suffix (e.g., `topic__human` and `topic__ai`).",
  },
  statusLabels: {
    draft: "draft",
    review: "review",
    final: "final",
  },
  dateFormat: "YYYYMMDD",
  versionPattern: "v{major}.{minor}",
  draftSuffix: "-draft",
  finalSuffix: "-final",
};

function ensureRuntimeDir() {
  if (!fs.existsSync(runtimeAgentsRoot)) {
    fs.mkdirSync(runtimeAgentsRoot, { recursive: true });
  }
}

function resolveAssetRoot(rawPath?: string) {
  if (!rawPath) {
    return defaultAssetRoot;
  }
  return path.resolve(rawPath);
}

function sanitizeConfig(raw: Partial<AgentOsConfig>): AgentOsConfig {
  return {
    assetRootPath: resolveAssetRoot(raw.assetRootPath),
    namingContract: raw.namingContract ?? DEFAULT_NAMING_CONTRACT,
    createdAt: raw.createdAt,
    lastUpdatedAt: raw.lastUpdatedAt,
  };
}

export function getAssetRootConfigPath() {
  return runtimeConfigPath;
}

export function getSuggestedAssetRootPath() {
  return defaultAssetRoot;
}

export function readAgentOsConfig(): AgentOsConfig {
  const base: AgentOsConfig = {
    assetRootPath: defaultAssetRoot,
    namingContract: DEFAULT_NAMING_CONTRACT,
    createdAt: undefined,
    lastUpdatedAt: undefined,
  };

  if (!fs.existsSync(runtimeConfigPath)) {
    return base;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf-8")) as Partial<AgentOsConfig>;
    const sanitized = sanitizeConfig({
      ...base,
      ...raw,
    });
    return {
      ...sanitized,
      createdAt: raw.createdAt ?? base.createdAt,
      lastUpdatedAt: raw.lastUpdatedAt ?? base.lastUpdatedAt,
    };
  } catch (error) {
    return base;
  }
}

export function updateAgentOsConfig(partial: Partial<AgentOsConfig>): AgentOsConfig {
  const current = readAgentOsConfig();
  const merged: AgentOsConfig = {
    ...current,
    ...partial,
    assetRootPath: resolveAssetRoot(partial.assetRootPath ?? current.assetRootPath),
    namingContract: partial.namingContract ?? current.namingContract,
    lastUpdatedAt: new Date().toISOString(),
    createdAt: current.createdAt ?? new Date().toISOString(),
  };

  ensureRuntimeDir();
  fs.writeFileSync(runtimeConfigPath, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function getNamingContract(): NamingContract {
  return readAgentOsConfig().namingContract;
}

export function isPathInsideAssetRoot(target: string, config?: AgentOsConfig) {
  const root = path.resolve(config?.assetRootPath ?? readAgentOsConfig().assetRootPath);
  const candidate = path.resolve(target);
  return candidate === root || candidate.startsWith(root + path.sep);
}
