import fs from "node:fs";
import path from "node:path";

export type WorkspaceTopology = {
  repoRoot: string;
  runtimeRoot: string;
  externalProjectsRoot: string;
  appsRoot: string;
  officialRoot: string;
  docsRoot: string;
  infraRoot: string;
  archiveRoot: string;
  migrationMode: string;
  compatibilitySymlinks: boolean;
};

const topologyPath = process.env.OPENCLAW_TOPOLOGY_PATH
  ? path.resolve(process.env.OPENCLAW_TOPOLOGY_PATH)
  : path.resolve(process.cwd(), "..", "..", "workspace-topology.json");

let cachedTopology: WorkspaceTopology | null = null;

function loadTopology(): WorkspaceTopology {
  if (cachedTopology) {
    return cachedTopology;
  }
  if (!fs.existsSync(topologyPath)) {
    throw new Error(`workspace-topology.json not found: ${topologyPath}`);
  }
  const payload = JSON.parse(fs.readFileSync(topologyPath, "utf-8")) as WorkspaceTopology;
  cachedTopology = payload;
  return payload;
}

export function getWorkspaceTopology() {
  return loadTopology();
}

export function getRepoRoot() {
  return loadTopology().repoRoot;
}

export function getRuntimeRoot() {
  return loadTopology().runtimeRoot;
}

export function getExternalProjectsRoot() {
  return loadTopology().externalProjectsRoot;
}
