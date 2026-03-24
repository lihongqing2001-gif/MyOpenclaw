import { AgentTask, TaskArtifact } from "../types";

const LABELS: Record<string, string> = {
  output_file: "Result File",
  output_dir: "Result Folder",
  index_md: "Index Markdown",
  index_json: "Index JSON",
  summary_path: "Summary",
  summary_file: "Summary",
  knowledge_note: "Knowledge Note",
};

function cleanPath(value: string) {
  return value.replace(/^['"]|['"]$/g, "").replace(/[),.;]+$/g, "").trim();
}

function parseLeadingJsonBlock(input?: string | null) {
  if (!input) {
    return null;
  }

  const source = input.trimStart();
  if (!source.startsWith("{")) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(0, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractKnowledgeNote(detail?: string) {
  const match = detail?.match(/Knowledge note:\s+([^\n]+)/);
  return match ? cleanPath(match[1]) : null;
}

function explicitArtifactRefsFromText(detail?: string) {
  if (!detail) {
    return [];
  }

  const refs = new Set<string>();
  const patterns = [
    /(?:实际结果|实际交付|交付结果|输出文件|输出目录)[\s\S]{0,300}?`([^`]+\.(?:md|json|xlsx|csv|txt|docx|pptx)(?::\d+)?)`/g,
    /(?:已生成|已输出|已写入)[：:\s]+`([^`]+\.(?:md|json|xlsx|csv|txt|docx|pptx)(?::\d+)?)`/g,
  ];

  for (const pattern of patterns) {
    for (const match of detail.matchAll(pattern)) {
      refs.add(cleanPath(match[1]).replace(/:\d+$/, ""));
    }
  }

  return [...refs];
}

function absolutePathsFromText(detail?: string) {
  if (!detail) {
    return [];
  }

  const matches = detail.match(/\/Users\/[^\s"'`]+/g) ?? [];
  return [...new Set(matches.map(cleanPath).filter(Boolean))];
}

function relativeFileRefsFromText(detail?: string) {
  if (!detail) {
    return [];
  }

  const refs = new Set<string>();
  for (const match of detail.matchAll(/`([^`]+\.(?:md|json|xlsx|csv|txt)(?::\d+)?)`/g)) {
    const value = cleanPath(match[1]).replace(/:\d+$/, "");
    if (!value.startsWith("/") && /[\\/]/.test(value)) {
      refs.add(value);
    }
  }
  return [...refs];
}

function dirname(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : normalized;
}

function deriveWorkspaceRoot(sourcePath: string) {
  const normalized = sourcePath.replace(/\\/g, "/");
  const match = normalized.match(/^(.*\/\.openclaw\/workspace)(?:\/.*)?$/);
  return match?.[1] ?? null;
}

function resolveRelativeArtifactPath(task: AgentTask, relativePath: string) {
  const sourcePath = task.context?.sourcePath ?? "";
  const normalized = relativePath.replace(/\\/g, "/");
  const workspaceRoot = deriveWorkspaceRoot(sourcePath);

  if (workspaceRoot) {
    if (
      normalized.startsWith("outputs/") ||
      normalized.startsWith("memory/") ||
      normalized.startsWith("agents/") ||
      normalized.startsWith("skills/") ||
      normalized.startsWith("sops/") ||
      normalized.startsWith("content_system/")
    ) {
      return `${workspaceRoot}/${normalized}`.replace(/\/+/g, "/");
    }

    if (
      normalized.startsWith("06_data/") ||
      normalized.startsWith("07_archive/") ||
      normalized.startsWith("final/") ||
      normalized.startsWith("knowledge/") ||
      normalized.startsWith("skilltree/") ||
      normalized.startsWith("05_publish/")
    ) {
      return `${workspaceRoot}/content_system/${normalized}`.replace(/\/+/g, "/");
    }
  }

  if (
    normalized.startsWith("outputs/") ||
    normalized.startsWith("memory/") ||
    normalized.startsWith("agents/") ||
    normalized.startsWith("skills/") ||
    normalized.startsWith("sops/")
  ) {
    if (sourcePath.includes("/content_system/")) {
      return `${sourcePath.slice(0, sourcePath.indexOf("/content_system/"))}/${normalized}`.replace(
        /\/+/g,
        "/",
      );
    }
    if (sourcePath.includes("/sops/")) {
      return `${sourcePath.slice(0, sourcePath.indexOf("/sops/"))}/${normalized}`.replace(
        /\/+/g,
        "/",
      );
    }
  }

  if (sourcePath.includes("/content_system/")) {
    const root = sourcePath.slice(0, sourcePath.indexOf("/content_system/") + "/content_system".length);
    return `${root}/${normalized}`.replace(/\/+/g, "/");
  }

  if (sourcePath.includes("/sops/")) {
    const workspaceRoot = sourcePath.slice(0, sourcePath.indexOf("/sops/"));
    return `${workspaceRoot}/${normalized}`.replace(/\/+/g, "/");
  }

  if (sourcePath.startsWith("/")) {
    return `${dirname(sourcePath)}/${normalized}`.replace(/\/+/g, "/");
  }

  return null;
}

export function extractTaskArtifacts(task: AgentTask): TaskArtifact[] {
  const artifacts: TaskArtifact[] = [];
  const seen = new Set<string>();

  const pushArtifact = (path: string, key: string, primary = false) => {
    const normalized = cleanPath(path);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    artifacts.push({
      path: normalized,
      key,
      label: LABELS[key] ?? key,
      primary,
    });
  };

  for (const artifact of task.artifactRefs ?? []) {
    if (artifact?.path) {
      pushArtifact(artifact.path, artifact.key, Boolean(artifact.primary));
    }
  }

  const detail = task.resultDetail ?? "";

  for (const explicitRef of explicitArtifactRefsFromText(detail)) {
    if (explicitRef.startsWith("/")) {
      pushArtifact(explicitRef, "path", true);
    } else {
      const resolved = resolveRelativeArtifactPath(task, explicitRef);
      if (resolved) {
        pushArtifact(resolved, "path", true);
      }
    }
  }

  const jsonBlock = parseLeadingJsonBlock(detail);
  if (jsonBlock) {
    for (const [key, value] of Object.entries(jsonBlock)) {
      if (typeof value !== "string" || !value.startsWith("/")) {
        continue;
      }

      if (
        key === "output_file" ||
        key === "output_dir" ||
        key === "index_md" ||
        key === "index_json" ||
        key.endsWith("_path") ||
        key.endsWith("_file")
      ) {
        pushArtifact(value, key, key === "output_file" || key === "index_md");
      }
    }
  }

  const knowledgeNote = extractKnowledgeNote(detail);
  if (knowledgeNote) {
    pushArtifact(knowledgeNote, "knowledge_note");
  }

  for (const candidate of absolutePathsFromText(detail)) {
    if (
      candidate.endsWith("/AGENTS.md") ||
      candidate.endsWith("/SOUL.md") ||
      candidate.endsWith("/TOOLS.md") ||
      candidate.endsWith("/IDENTITY.md") ||
      candidate.endsWith("/USER.md") ||
      candidate.includes("/workspace-state.json")
    ) {
      continue;
    }

    const isLikelyDeliverable =
      candidate.includes("/Desktop/") ||
      candidate.includes("/workspace/outputs/") ||
      candidate.includes("/content_system/06_data/") ||
      candidate.includes("/content_system/final/") ||
      candidate.includes("/content_system/07_archive/") ||
      candidate.includes("/xhs_comment_semantic_extract_projects/");

    if (!isLikelyDeliverable) {
      continue;
    }

    if (
      candidate.endsWith(".xlsx") ||
      candidate.endsWith(".md") ||
      candidate.endsWith(".json") ||
      candidate.endsWith(".csv") ||
      candidate.endsWith(".txt")
    ) {
      pushArtifact(candidate, "path");
    }
  }

  for (const relativeRef of relativeFileRefsFromText(detail)) {
    const resolved = resolveRelativeArtifactPath(task, relativeRef);
    if (resolved) {
      pushArtifact(resolved, "path");
    }
  }

  if (artifacts.length > 0 && !artifacts.some((item) => item.primary)) {
    const preferred =
      artifacts.find((item) => item.key !== "knowledge_note") ?? artifacts[0];
    preferred.primary = true;
  }

  return artifacts;
}
