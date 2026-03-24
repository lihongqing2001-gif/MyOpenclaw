import fs from "node:fs";
import path from "node:path";

type WorkspaceTopology = {
  repoRoot: string;
  runtimeRoot: string;
};

const topologyPath = process.env.OPENCLAW_TOPOLOGY_PATH
  ? path.resolve(process.env.OPENCLAW_TOPOLOGY_PATH)
  : path.resolve(process.cwd(), "..", "..", "workspace-topology.json");

let cached: WorkspaceTopology | null = null;

function loadTopology() {
  if (cached) {
    return cached;
  }
  if (!fs.existsSync(topologyPath)) {
    throw new Error(`workspace-topology.json not found: ${topologyPath}`);
  }
  cached = JSON.parse(fs.readFileSync(topologyPath, "utf-8")) as WorkspaceTopology;
  return cached;
}

export function getRuntimeRoot() {
  return loadTopology().runtimeRoot;
}
