import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SkillModule, SkillNode } from "../types";
import { resolveAgentRoute } from "./agentRouting";
import { listIndexedSkills } from "./skillIndex";
import { getRepoRoot, getRuntimeRoot } from "./workspaceTopology";

type ContentSystemNode = {
  id: string;
  title: string;
  category?: string;
  subcategory?: string;
  nodeType?: string;
  level?: string;
  dependencies?: string[];
  prerequisites?: string;
  invoke?: string;
  functions?: string;
  applications?: string;
  portfolio?: Array<{ title?: string; path?: string }>;
};

type RawLeafNode = {
  id: string;
  label: string;
  domain: string;
  area: string;
  sourceType: "content-system" | "sop";
  sourcePath: string;
  summary: string;
  prerequisites?: string;
  invoke?: string;
  commands: string[];
  capabilities: string[];
  useCases: { title: string; summary: string }[];
  inputs: { field: string; type: "text" | "slider" }[];
  knowledgeDocs: { title: string; url: string }[];
  tags: string[];
  requiredSkills: SkillModule[];
  sourcePaths: string[];
  mergedFrom: string[];
  route: NonNullable<SkillNode["drawerContent"]>["route"];
};

type InstalledSkillRecord = SkillModule & {
  dirName: string;
  matchTokens: string[];
};

const CONTENT_DOMAIN = "社交媒体与内容";
const CONTENT_AREAS = ["内容采集", "内容洞察", "内容改写", "内容生产", "发布与复盘"];

const workspaceRoot = getRepoRoot();
const runtimeRoot = getRuntimeRoot();
const contentSkillTreePath = path.join(
  workspaceRoot,
  "content_system",
  "skilltree",
  "data.json",
);
const sopsRoot = path.join(workspaceRoot, "sops");
const runtimeEvidencePath = path.join(
  runtimeRoot,
  "agent",
  "runtime-skill-evidence.json",
);
const appRoot = process.cwd();
let openclawChannelStatusCache: { expiresAt: number; value: Record<string, any> } | null = null;

function resolvePath(baseDir: string, targetPath?: string) {
  if (!targetPath) {
    return "";
  }

  if (/^https?:\/\//i.test(targetPath)) {
    return targetPath;
  }

  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(baseDir, targetPath);
}

function toDocUrl(baseDir: string, targetPath?: string) {
  const resolved = resolvePath(baseDir, targetPath);
  if (!resolved) {
    return "#";
  }
  if (/^https?:\/\//i.test(resolved)) {
    return resolved;
  }
  return `/api/v1/doc?path=${encodeURIComponent(resolved)}`;
}

function exists(targetPath: string) {
  return fs.existsSync(targetPath);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function readTextIfExists(targetPath: string) {
  if (!exists(targetPath)) {
    return null;
  }
  return fs.readFileSync(targetPath, "utf-8");
}

function readRuntimeSkillEvidence(): Record<string, SkillModule[]> {
  if (!exists(runtimeEvidencePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(runtimeEvidencePath, "utf-8")) as Record<
      string,
      SkillModule[]
    >;
  } catch {
    return {};
  }
}

function parseTrailingJsonObject(raw: string) {
  const match = raw.match(/(\{[\s\S]*\})\s*$/);
  if (!match) {
    return {};
  }

  try {
    return JSON.parse(match[1]) as Record<string, any>;
  } catch {
    return {};
  }
}

function readOpenClawChannelStatus() {
  const now = Date.now();
  if (openclawChannelStatusCache && openclawChannelStatusCache.expiresAt > now) {
    return openclawChannelStatusCache.value;
  }

  try {
    const raw = execFileSync("openclaw", ["channels", "status", "--probe", "--json"], {
      encoding: "utf-8",
      timeout: 10_000,
      cwd: workspaceRoot,
    });
    const parsed = parseTrailingJsonObject(raw);
    openclawChannelStatusCache = { expiresAt: now + 15_000, value: parsed };
    return parsed;
  } catch {
    openclawChannelStatusCache = { expiresAt: now + 15_000, value: {} };
    return {};
  }
}

function resolveOpenClawNotifierModule(requirement: string): SkillModule | null {
  const normalized = requirement.trim().toLowerCase();
  if (!normalized.includes("openclaw notifier")) {
    return null;
  }

  const status = readOpenClawChannelStatus();
  const channels =
    status.channels && typeof status.channels === "object"
      ? (status.channels as Record<string, Record<string, any>>)
      : {};

  const readyChannels = Object.entries(channels)
    .filter(([, meta]) => Boolean(meta?.connected || meta?.running || meta?.configured))
    .map(([channelId, meta]) => {
      const state = meta?.connected
        ? "connected"
        : meta?.running
          ? "running"
          : meta?.configured
            ? "configured"
            : "offline";
      return `${channelId} (${state})`;
    });

  return {
    id: "module-integration-openclaw-notifier",
    label: requirement,
    summary:
      readyChannels.length > 0
        ? `OpenClaw notifier is available via ${readyChannels.join(", ")}.`
        : "OpenClaw notifier is declared, but no active channel was detected at runtime.",
    installed: readyChannels.length > 0,
    sourceType: "integration",
    evidence: readyChannels.length > 0 ? "runtime" : "declared",
  };
}

function writeRuntimeSkillEvidence(data: Record<string, SkillModule[]>) {
  fs.writeFileSync(runtimeEvidencePath, JSON.stringify(data, null, 2), "utf-8");
}

export function recordRuntimeSkillEvidence(nodeId: string, modules: SkillModule[]) {
  if (!nodeId || modules.length === 0) {
    return;
  }

  const current = readRuntimeSkillEvidence();
  const existing = current[nodeId] ?? [];
  const merged = dedupeModules([
    ...existing.map((module) => ({ ...module, evidence: "runtime" as const })),
    ...modules.map((module) => ({ ...module, evidence: "runtime" as const })),
  ]);
  current[nodeId] = merged;
  writeRuntimeSkillEvidence(current);
}

function firstHeading(markdown: string) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function firstParagraph(markdown: string) {
  return (
    markdown
      .replace(/^---[\s\S]*?---/, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => !line.startsWith("#") && !line.startsWith("```")) ?? null
  );
}

function extractSection(markdown: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^##+\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##+\\s+|\\Z)`,
    "mi",
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}

function extractBulletLines(sectionContent: string) {
  return unique(
    sectionContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean),
  );
}

function normalizeArrowList(raw?: string) {
  if (!raw) {
    return [];
  }

  return unique(
    raw
      .split(/\n|→|->|,|，|、|;/)
      .map((item) => item.replace(/^[-*0-9.)\s]+/, "").trim())
      .filter(Boolean),
  );
}

function extractCommands(markdown: string) {
  const commands = new Set<string>();
  const codeBlockRegex = /```(?:bash|sh)?\n([\s\S]*?)```/g;
  for (const match of markdown.matchAll(codeBlockRegex)) {
    match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => commands.add(line));
  }

  for (const match of markdown.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();
    if (
      candidate.startsWith("/") ||
      candidate.startsWith("claw ") ||
      candidate.startsWith("python ") ||
      candidate.startsWith("python3 ") ||
      candidate.startsWith("npm ") ||
      candidate.startsWith("uv ")
    ) {
      commands.add(candidate);
    }
  }

  return [...commands].slice(0, 8);
}

function isRunnableCommand(command: string) {
  const normalized = command.trim();
  const isSlashWorkflow = /^\/[a-z0-9_-]+(?:\s|$)/i.test(normalized);
  return (
    isSlashWorkflow ||
    normalized.startsWith("python ") ||
    normalized.startsWith("python3 ") ||
    normalized.startsWith("npm ") ||
    normalized.startsWith("node ") ||
    normalized.startsWith("uv ") ||
    normalized.startsWith("claw ")
  );
}

function extractRunnableCommands(raw?: string) {
  if (!raw) {
    return [];
  }

  const commands = new Set<string>();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed
      .replace(/^(手动|自动|定时任务|执行|命令)[：:]\s*/u, "")
      .replace(/\s*[（(]示例[）)]\s*$/u, "")
      .trim();
    if (isRunnableCommand(normalized)) {
      commands.add(normalized);
    }
  }

  return [...commands];
}

function extractPlaceholderInputs(commands: string[]) {
  const seen = new Set<string>();
  const inputs: { field: string; type: "text" | "slider"; required?: boolean; placeholder?: string }[] = [];

  for (const command of commands) {
    for (const match of command.matchAll(/<([^>]+)>/g)) {
      const field = match[1].trim().replace(/\s*[（(]示例[）)]\s*$/u, "");
      if (!field || seen.has(field)) {
        continue;
      }
      seen.add(field);
      inputs.push({
        field,
        type: "text",
        required: true,
        placeholder:
          /时间范围/i.test(field)
            ? "例如：明天下午 2 点到 5 点"
            : /重点|focus/i.test(field)
              ? "例如：安排会议、阅读论文、准备汇报"
              : /路径|path/i.test(field)
                ? "/absolute/path"
                : /token/i.test(field)
                  ? "Enter token"
                  : /id/i.test(field)
                    ? "Enter id"
                    : `Enter ${field}`,
      });
    }
  }

  return inputs;
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return result;
}

function extractExternalLink(markdown: string) {
  const match = markdown.match(/\[(?:[^\]]+)\]\((https?:\/\/[^)]+)\)/);
  return match?.[1];
}

function inferAreaFromText(text: string) {
  const value = text.toLowerCase();
  if (
    value.includes("xhs") ||
    value.includes("xiaohongshu") ||
    value.includes("小红书") ||
    value.includes("内容")
  ) {
    return "内容生产与平台运营";
  }
  if (
    value.includes("calendar") ||
    value.includes("日程") ||
    value.includes("提醒") ||
    value.includes("trip") ||
    value.includes("出行")
  ) {
    return "日程规划与提醒";
  }
  if (
    value.includes("journal") ||
    value.includes("review") ||
    value.includes("复盘") ||
    value.includes("成长")
  ) {
    return "日志与复盘";
  }
  if (
    value.includes("research") ||
    value.includes("paper") ||
    value.includes("文献") ||
    value.includes("科研")
  ) {
    return "科研与研究支持";
  }
  if (
    value.includes("file") ||
    value.includes("archive") ||
    value.includes("资料") ||
    value.includes("归档")
  ) {
    return "文件与资料管理";
  }
  if (
    value.includes("docker") ||
    value.includes("devops") ||
    value.includes("deploy") ||
    value.includes("编程")
  ) {
    return "工程与自动化";
  }
  return "综合工作流";
}

function normalizeDomain(category: string, text: string) {
  const source = text.toLowerCase();

  if (
    category.startsWith("内容") ||
    source.includes("小红书") ||
    source.includes("xiaohongshu") ||
    source.includes("xhs")
  ) {
    return CONTENT_DOMAIN;
  }

  return category;
}

function inferContentArea(rawCategory: string, text: string) {
  const source = `${rawCategory} ${text}`.toLowerCase();

  if (
    source.includes("抓取") ||
    source.includes("爬取") ||
    source.includes("采集") ||
    source.includes("extract") ||
    source.includes("crawl") ||
    source.includes("get-feed-detail") ||
    source.includes("评论语义") ||
    source.includes("comment semantic")
  ) {
    return "内容采集";
  }

  if (
    source.includes("分析") ||
    source.includes("洞察") ||
    source.includes("雷达") ||
    source.includes("选题") ||
    source.includes("热点") ||
    source.includes("趋势") ||
    source.includes("观点池") ||
    source.includes("signal digest") ||
    source.includes("收藏") ||
    source.includes("灵感") ||
    source.includes("insight") ||
    source.includes("research")
  ) {
    return "内容洞察";
  }

  if (
    source.includes("改写") ||
    source.includes("repurpose") ||
    source.includes("rewrite") ||
    source.includes("多平台") ||
    source.includes("转化")
  ) {
    return "内容改写";
  }

  if (
    source.includes("脚本") ||
    source.includes("分镜") ||
    source.includes("storyboard") ||
    source.includes("director") ||
    source.includes("导演") ||
    source.includes("brief") ||
    source.includes("生产") ||
    source.includes("视频方案") ||
    source.includes("内容生成") ||
    rawCategory === "内容生成"
  ) {
    return "内容生产";
  }

  if (
    source.includes("发布") ||
    source.includes("复盘") ||
    source.includes("pipeline") ||
    source.includes("流水线") ||
    source.includes("排期")
  ) {
    return "发布与复盘";
  }

  return "内容生产";
}

function inferSopDomainAndArea(text: string) {
  const value = text.toLowerCase();
  if (
    value.includes("xhs") ||
    value.includes("xiaohongshu") ||
    value.includes("小红书") ||
    value.includes("douyin") ||
    value.includes("抖音") ||
    value.includes("tiktok") ||
    value.includes("twitter") ||
    value.includes(" x ") ||
    value.includes("x ") ||
    value.includes("博客") ||
    value.includes("blog") ||
    value.includes("视频") ||
    value.includes("short video")
  ) {
    return {
      domain: CONTENT_DOMAIN,
      area: inferContentArea("内容系统", text),
    };
  }
  if (
    value.includes("calendar") ||
    value.includes("reminder") ||
    value.includes("trip") ||
    value.includes("日程") ||
    value.includes("提醒")
  ) {
    return {
      domain: "个人管理",
      area: "日程规划与提醒",
    };
  }
  if (
    value.includes("email") ||
    value.includes("mail") ||
    value.includes("邮箱") ||
    value.includes("邮件") ||
    value.includes("inbox") ||
    value.includes("reply")
  ) {
    return {
      domain: "个人管理",
      area: "沟通与邮件",
    };
  }
  if (
    value.includes("research") ||
    value.includes("paper") ||
    value.includes("文献") ||
    value.includes("科研")
  ) {
    return {
      domain: "科研与研究",
      area: "研究工作流",
    };
  }
  if (
    value.includes("file") ||
    value.includes("archive") ||
    value.includes("资料") ||
    value.includes("归档")
  ) {
    return {
      domain: "项目产出与资料管理",
      area: "文件与资料管理",
    };
  }
  if (
    value.includes("网页") ||
    value.includes("网站") ||
    value.includes("webpage") ||
    value.includes("website") ||
    value.includes("landing page") ||
    value.includes("landing") ||
    value.includes("frontend")
  ) {
    return {
      domain: "项目产出与资料管理",
      area: "编程",
    };
  }
  return {
    domain: "OpenClaw Workflow",
    area: inferAreaFromText(text),
  };
}

function readContentSystemNodes() {
  if (!exists(contentSkillTreePath)) {
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(contentSkillTreePath, "utf-8")) as {
    nodes?: ContentSystemNode[];
  };

  return raw.nodes ?? [];
}

function readSopFiles() {
  if (!exists(sopsRoot)) {
    return [];
  }

  return fs
    .readdirSync(sopsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => path.join(sopsRoot, entry.name));
}

function buildInstalledSkillCatalog() {
  const skills = new Map<string, InstalledSkillRecord>();
  for (const skill of listIndexedSkills()) {
    skills.set(skill.dirName, {
      id: `module-skill-${slugify(skill.dirName)}`,
      label: skill.label,
      summary: skill.summary,
      installed: true,
      installCommand: `claw skill install ${skill.dirName}`,
      installUrl: skill.installUrl,
      sourcePath: skill.skillPath,
      sourceType: "skill",
      capabilities: skill.features,
      dirName: skill.dirName,
      matchTokens: skill.matchTokens,
    });
  }

  return skills;
}

function buildFoundationModuleCatalog(contentNodes: ContentSystemNode[]) {
  const catalog = new Map<string, SkillModule>();

  for (const node of contentNodes.filter((item) => item.nodeType === "foundation")) {
    catalog.set(node.id, {
      id: `module-foundation-${slugify(node.id)}`,
      label: node.title,
      summary: firstParagraph(node.functions ?? "") || "OpenClaw foundation module.",
      installed: true,
      sourceType: "foundation",
      sourcePath: contentSkillTreePath,
      installCommand: node.invoke,
      capabilities: normalizeArrowList(node.functions),
    });
  }

  return catalog;
}

function cloneModule(module: SkillModule): SkillModule {
  return {
    ...module,
    capabilities: module.capabilities ? [...module.capabilities] : undefined,
  };
}

function dedupeModules(modules: SkillModule[]) {
  const map = new Map<string, SkillModule>();
  for (const module of modules) {
    if (!map.has(module.id)) {
      map.set(module.id, cloneModule(module));
    }
  }
  return [...map.values()].sort((a, b) => Number(a.installed) - Number(b.installed) || a.label.localeCompare(b.label));
}

function resolveDeclaredDependencyModules(
  dependencyIds: string[] | undefined,
  installedSkills: Map<string, InstalledSkillRecord>,
  foundationModules: Map<string, SkillModule>,
) {
  const modules: SkillModule[] = [];

  for (const dependencyId of dependencyIds ?? []) {
    if (foundationModules.has(dependencyId)) {
      modules.push({
        ...cloneModule(foundationModules.get(dependencyId)!),
        evidence: "declared",
      });
      continue;
    }

    const matchedSkill = [...installedSkills.values()].find(
      (skill) =>
        skill.dirName === dependencyId ||
        skill.label === dependencyId ||
        skill.matchTokens.some((token) => dependencyId.toLowerCase().includes(token)),
    );
    if (matchedSkill) {
      modules.push({
        ...cloneModule(matchedSkill),
        evidence: "declared",
      });
      continue;
    }

    modules.push({
      id: `module-integration-${slugify(dependencyId)}`,
      label: dependencyId,
      summary: "Referenced by this workflow as an external dependency.",
      installed: false,
      sourceType: "integration",
      evidence: "declared",
    });
  }

  return dedupeModules(modules);
}

function resolveExplicitTextSkillRefs(
  text: string,
  installedSkills: Map<string, InstalledSkillRecord>,
) {
  const lowerText = text.toLowerCase();
  const modules: SkillModule[] = [];

  for (const skill of installedSkills.values()) {
    if (
      lowerText.includes(skill.dirName.toLowerCase()) ||
      lowerText.includes(skill.label.toLowerCase()) ||
      skill.matchTokens.some((token) => lowerText.includes(token))
    ) {
      modules.push({
        ...cloneModule(skill),
        evidence: "explicit-text",
      });
    }
  }

  return dedupeModules(modules);
}

function resolveNamedRequirementModules(
  requirements: string[],
  installedSkills: Map<string, InstalledSkillRecord>,
) {
  const modules: SkillModule[] = [];

  for (const requirement of requirements) {
    const normalized = requirement.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    const notifierModule = resolveOpenClawNotifierModule(requirement);
    if (notifierModule) {
      modules.push(notifierModule);
      continue;
    }

    const matched = [...installedSkills.values()].find((skill) => {
      if (skill.dirName.toLowerCase() === normalized) {
        return true;
      }
      if (skill.label.toLowerCase() === normalized) {
        return true;
      }
      return skill.matchTokens.some((token) => normalized.includes(token));
    });

    if (matched) {
      modules.push({
        ...cloneModule(matched),
        evidence: "explicit-text",
      });
      continue;
    }

    modules.push({
      id: `module-integration-${slugify(requirement)}`,
      label: requirement,
      summary: "Referenced by this SOP as a required external capability or installable skill.",
      installed: false,
      sourceType: "integration",
      evidence: "explicit-text",
    });
  }

  return dedupeModules(modules);
}

function mergeWithRuntimeEvidence(nodeId: string, modules: SkillModule[]) {
  const runtimeEvidence = readRuntimeSkillEvidence()[nodeId] ?? [];
  return dedupeModules([
    ...modules,
    ...runtimeEvidence.map((module) => ({
      ...module,
      evidence: "runtime" as const,
    })),
  ]);
}

function getWorkflowOverride(item: ContentSystemNode) {
  if (item.id === "project_file_organize") {
    return {
      invoke: `python3 ${path.join(appRoot, "scripts", "run_project_file_organize.py")} --target-dir <目标目录> --rule <归档规则说明>`,
      inputs: [
        {
          field: "目标目录",
          type: "text" as const,
          required: true,
          placeholder: "/absolute/path/to/folder",
        },
        {
          field: "归档规则说明",
          type: "text" as const,
          required: false,
          placeholder: "例如：按项目/年份归档，保留原文件名",
        },
      ],
    };
  }

  if (item.id == "project_file_index") {
    return {
      invoke: `python3 ${path.join(appRoot, "scripts", "run_project_file_index.py")} --target-dir <目标目录>`,
      inputs: [
        {
          field: "目标目录",
          type: "text" as const,
          required: true,
          placeholder: "/absolute/path/to/folder",
        },
      ],
    };
  }

  if (item.id == "content_writer") {
    return {
      invoke: `/content run --style xiaogai --count 1`,
      inputs: [
        {
          field: "执行参数",
          type: "text" as const,
          required: false,
          placeholder: "例如：主题=焦虑；平台=小红书",
        },
      ],
    };
  }

  return null;
}

function buildContentLeaves(
  installedSkills: Map<string, InstalledSkillRecord>,
  foundationModules: Map<string, SkillModule>,
) {
  const items = readContentSystemNodes();
  const leaves: RawLeafNode[] = [];

  for (const item of items.filter((entry) => entry.nodeType !== "foundation")) {
    const rawCategory = item.category?.trim() || "OpenClaw";
    const domain = normalizeDomain(
      rawCategory,
      `${item.title} ${item.functions ?? ""} ${item.applications ?? ""}`,
    );
    const area =
      domain === CONTENT_DOMAIN
        ? inferContentArea(
            rawCategory,
            `${item.title} ${item.functions ?? ""} ${item.applications ?? ""}`,
          )
        : item.subcategory?.trim() ||
          inferAreaFromText(`${item.title} ${item.functions ?? ""}`);
    const invokeLines = extractRunnableCommands(item.invoke);
    const workflowOverride = getWorkflowOverride(item);
    const effectiveCommands = workflowOverride
      ? [workflowOverride.invoke]
      : invokeLines;
    const leafText = [
      item.title,
      item.prerequisites,
      item.functions,
      item.applications,
      item.invoke,
      ...(item.dependencies ?? []),
    ]
      .filter(Boolean)
      .join(" ");

    leaves.push({
      id: `sop-content-${slugify(item.id || item.title)}`,
      label: item.title,
      domain,
      area,
      sourceType: "content-system",
      sourcePath: contentSkillTreePath,
      summary: item.applications?.trim() || "Imported from structured content skill tree.",
      prerequisites: item.prerequisites,
      invoke: effectiveCommands[0],
      commands: effectiveCommands,
      capabilities: normalizeArrowList(item.functions),
      useCases: normalizeArrowList(item.applications).map((entry) => ({
        title: entry,
        summary: `${item.title} 面向 ${entry}`,
      })),
      inputs: workflowOverride?.inputs ??
        (extractPlaceholderInputs(effectiveCommands).length > 0
          ? extractPlaceholderInputs(effectiveCommands)
          : [{ field: "执行参数", type: "text" }]),
      knowledgeDocs: (item.portfolio ?? []).map((doc) => ({
        title: doc.title || "Portfolio",
        url: toDocUrl(path.dirname(contentSkillTreePath), doc.path),
      })),
      tags: unique([
        domain,
        area,
        item.level ?? "",
        item.nodeType ?? "",
      ].filter(Boolean)),
      requiredSkills: mergeWithRuntimeEvidence(
        `sop-content-${slugify(item.id || item.title)}`,
        resolveDeclaredDependencyModules(
          item.dependencies,
          installedSkills,
          foundationModules,
        ),
      ),
      sourcePaths: [contentSkillTreePath],
      mergedFrom: [item.title],
      route: resolveAgentRoute({
        domain,
        area,
        label: item.title,
        sourceType: "content-system",
        summary: item.applications?.trim() || item.functions?.trim() || "",
        commands: effectiveCommands,
      }),
    });
  }

  return leaves;
}

function buildSopLeaves(
  installedSkills: Map<string, InstalledSkillRecord>,
  foundationModules: Map<string, SkillModule>,
) {
  const leaves: RawLeafNode[] = [];

  for (const sopPath of readSopFiles()) {
    const markdown = readTextIfExists(sopPath);
    if (!markdown) {
      continue;
    }

    const label =
      firstHeading(markdown)?.replace(/^SOP:\s*/i, "") ||
      path.basename(sopPath, ".md");
    const summary = firstParagraph(markdown) || "Imported from OpenClaw SOP.";
    const info = inferSopDomainAndArea(`${label} ${summary} ${markdown}`);
    const preconditions = extractBulletLines(extractSection(markdown, "Preconditions"));
    const requiredSkillNames = extractBulletLines(extractSection(markdown, "Required Skills"));
    const steps = extractSection(markdown, "Steps")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\)/.test(line))
      .map((line) => line.replace(/^\d+\)\s*/, "").trim());
    const triggers = extractBulletLines(extractSection(markdown, "Default Trigger"));
    const commands = extractCommands(markdown).filter(isRunnableCommand);
    const fileName = path.basename(sopPath, ".md");
    const override =
      fileName === "xhs_comment_semantic_extract"
        ? {
            invoke: `python3 ${path.join(appRoot, "scripts", "run_xhs_comment_semantic_extract.py")} --note-url <Xiaohongshu note URL> --output <Output path (optional)> --batch-size <Batch size (optional)>`,
            commands: [
              `python3 ${path.join(appRoot, "scripts", "run_xhs_comment_semantic_extract.py")} --note-url <Xiaohongshu note URL> --output <Output path (optional)> --batch-size <Batch size (optional)>`,
            ],
            inputs: [
              {
                field: "Xiaohongshu note URL",
                type: "text" as const,
                required: true,
                placeholder: "https://www.xiaohongshu.com/explore/<feed_id>?xsec_token=...",
              },
              {
                field: "Output path (optional)",
                type: "text" as const,
                required: false,
                placeholder: "/Users/<you>/Desktop/xhs_note_<feed_id>_comments.xlsx",
              },
              {
                field: "Batch size (optional)",
                type: "text" as const,
                required: false,
                placeholder: "20",
                defaultValue: "20",
              },
            ],
          }
        : fileName === "email_inbox_digest"
          ? {
              invoke: `python3 ${path.join(appRoot, "scripts", "run_email_inbox_digest.py")} --email-address <邮箱地址> --imap-host <IMAP 主机> --imap-port <IMAP 端口> --username <用户名> --app-password <应用专用密码或授权令牌> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读>`,
              commands: [
                `python3 ${path.join(appRoot, "scripts", "run_email_inbox_digest.py")} --email-address <邮箱地址> --imap-host <IMAP 主机> --imap-port <IMAP 端口> --username <用户名> --app-password <应用专用密码或授权令牌> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读>`,
              ],
              inputs: [
                { field: "邮箱地址", type: "text" as const, required: true, placeholder: "you@example.com" },
                { field: "IMAP 主机", type: "text" as const, required: true, placeholder: "imap.qq.com / imap.gmail.com" },
                { field: "IMAP 端口", type: "text" as const, required: true, placeholder: "993", defaultValue: "993" },
                { field: "用户名", type: "text" as const, required: true, placeholder: "通常与邮箱地址相同" },
                { field: "应用专用密码或授权令牌", type: "text" as const, required: true, placeholder: "填写授权码，不是普通登录密码" },
                { field: "邮箱范围", type: "text" as const, required: false, placeholder: "INBOX", defaultValue: "INBOX" },
                { field: "时间窗口", type: "text" as const, required: false, placeholder: "例如：7d / today" },
                { field: "是否需要只看未读", type: "text" as const, required: false, placeholder: "yes / no", defaultValue: "yes" },
              ],
            }
        : fileName === "email_daily_triage_push"
          ? {
              invoke: `python3 ${path.join(appRoot, "scripts", "run_email_daily_triage.py")} --email-profile <邮箱账户档案> --notify-channel <通知通道（可选覆盖）> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读> --only-unprocessed <是否需要只看未处理> --max-messages <最大邮件数> --push-mode <推送模式>`,
              commands: [
                `python3 ${path.join(appRoot, "scripts", "run_email_daily_triage.py")} --email-profile <邮箱账户档案> --notify-channel <通知通道（可选覆盖）> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读> --only-unprocessed <是否需要只看未处理> --max-messages <最大邮件数> --push-mode <推送模式>`,
              ],
              inputs: [
                { field: "邮箱账户档案", type: "text" as const, required: false, placeholder: "默认使用已保存的默认邮箱账户档案" },
                { field: "通知通道（可选覆盖）", type: "text" as const, required: false, placeholder: "留空则读取 openclaw-watchdog/.env 中的 NOTIFIER", defaultValue: "" },
                { field: "邮箱范围", type: "text" as const, required: false, placeholder: "INBOX", defaultValue: "INBOX" },
                { field: "时间窗口", type: "text" as const, required: false, placeholder: "例如：1d / 7d", defaultValue: "1d" },
                { field: "是否需要只看未读", type: "text" as const, required: false, placeholder: "yes / no", defaultValue: "yes" },
                { field: "是否需要只看未处理", type: "text" as const, required: false, placeholder: "yes / no", defaultValue: "yes" },
                { field: "最大邮件数", type: "text" as const, required: false, placeholder: "15", defaultValue: "15" },
                { field: "推送模式", type: "text" as const, required: false, placeholder: "summary", defaultValue: "summary" },
              ],
            }
        : null;
    const inputs = extractBulletLines(extractSection(markdown, "Inputs")).map(
      (entry) => ({
        field: entry,
        type: "text" as const,
        required:
          /url|link|path|token|feed_id|xsec|output/i.test(entry),
        placeholder:
          /xiaohongshu note url/i.test(entry)
            ? "https://www.xiaohongshu.com/explore/<feed_id>?xsec_token=..."
            : /output path|desktop/i.test(entry)
              ? "/Users/<you>/Desktop/..."
              : /xsec|token/i.test(entry)
                ? "Enter token"
                : /feed_id/i.test(entry)
                  ? "Enter feed id"
                  : undefined,
      }),
    );

    leaves.push({
      id: `sop-${slugify(label)}`,
      label,
      domain: info.domain,
      area: info.area,
      sourceType: "sop",
      sourcePath: sopPath,
      summary,
      prerequisites: preconditions.join("；"),
      invoke: override?.invoke ?? commands[0],
      commands: override?.commands ?? commands,
      capabilities: steps.length > 0 ? steps : ["Imported from SOP markdown"],
      useCases:
        triggers.length > 0
          ? triggers.map((entry) => ({ title: entry, summary }))
          : [{ title: "标准工作流", summary }],
      inputs:
        override?.inputs
          ? override.inputs
          : inputs.length > 0
          ? inputs
          : extractPlaceholderInputs(override?.commands ?? commands).length > 0
            ? extractPlaceholderInputs(override?.commands ?? commands)
            : [{ field: "Workflow Input", type: "text" }],
      knowledgeDocs: [{ title: path.basename(sopPath), url: toDocUrl(path.dirname(sopPath), sopPath) }],
      tags: [info.domain, info.area, "sop"],
      requiredSkills: mergeWithRuntimeEvidence(
        `sop-${slugify(label)}`,
        dedupeModules([
          ...resolveExplicitTextSkillRefs(
            `${label} ${summary} ${markdown}`,
            installedSkills,
          ),
          ...resolveNamedRequirementModules(requiredSkillNames, installedSkills),
        ]),
      ),
      sourcePaths: [sopPath],
      mergedFrom: [label],
      route: resolveAgentRoute({
        domain: info.domain,
        area: info.area,
        label,
        sourceType: "sop",
        summary,
        commands: override?.commands ?? commands,
      }),
    });
  }

  return leaves;
}

function uniqueDocs(docs: { title: string; url: string }[]) {
  const seen = new Set<string>();
  return docs.filter((doc) => {
    const key = `${doc.title}::${doc.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueUseCases(useCases: { title: string; summary: string }[]) {
  const seen = new Set<string>();
  return useCases.filter((item) => {
    const key = `${item.title}::${item.summary}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueInputs(
  inputs: {
    field: string;
    type: "text" | "slider";
    required?: boolean;
    placeholder?: string;
    defaultValue?: string;
  }[],
) {
  const seen = new Set<string>();
  return inputs.filter((item) => {
    if (seen.has(item.field)) {
      return false;
    }
    seen.add(item.field);
    return true;
  });
}

function contentCanonicalLabel(leaf: RawLeafNode) {
  const text = `${leaf.label} ${leaf.summary} ${leaf.tags.join(" ")} ${leaf.sourcePaths.join(" ")}`.toLowerCase();

  if (
    (text.includes("single") || text.includes("单条")) &&
    (text.includes("analysis") || text.includes("分析")) &&
    (text.includes("xiaohongshu") || text.includes("xhs") || text.includes("小红书") || text.includes("douyin") || text.includes("抖音"))
  ) {
    return { label: "单条内容洞察与入库", area: "内容洞察" };
  }

  if (text.includes("saved_video_insight") || (text.includes("收藏") && text.includes("洞察"))) {
    return { label: "收藏内容洞察", area: "内容洞察" };
  }

  if (
    (text.includes("topic_radar") || text.includes("热点雷达") || text.includes("选题雷达")) &&
    (text.includes("xiaohongshu") || text.includes("xhs") || text.includes("小红书") || text.includes("douyin") || text.includes("抖音"))
  ) {
    return { label: "平台热点选题雷达", area: "内容洞察" };
  }

  if (text.includes("x signal") || text.includes("观点池")) {
    return { label: "趋势信号与观点池", area: "内容洞察" };
  }

  if (text.includes("comment semantic") || text.includes("评论语义")) {
    return { label: "评论语义提取与结构化", area: "内容采集" };
  }

  if (text.includes("storyboard") || text.includes("分镜") || text.includes("短视频脚本")) {
    return { label: "短视频脚本与分镜交付", area: "内容生产" };
  }

  if (text.includes("repurpose") || text.includes("多平台改写") || text.includes("改写包")) {
    return { label: "多平台内容改写包", area: "内容改写" };
  }

  if (text.includes("content_writer") || text.includes("小盖风格内容生成")) {
    return { label: "长文内容生成", area: "内容生产" };
  }

  if (text.includes("content_pipeline") || text.includes("流水线")) {
    return { label: "内容生产流水线", area: "发布与复盘" };
  }

  return {
    label: leaf.label
      .replace(/^(小红书|抖音|Xiaohongshu|Douyin)\s*/i, "")
      .replace(/\b(XHS|Douyin|Xiaohongshu)\b/gi, "")
      .trim(),
    area: leaf.area,
  };
}

function mergeContentLeaves(leaves: RawLeafNode[]) {
  const merged = new Map<string, RawLeafNode>();

  for (const leaf of leaves) {
    if (leaf.domain !== CONTENT_DOMAIN) {
      const passthroughKey = `${leaf.domain}::${leaf.area}::${leaf.id}`;
      merged.set(passthroughKey, leaf);
      continue;
    }

    const canonical = contentCanonicalLabel(leaf);
    const key = `${leaf.domain}::${canonical.area}::${canonical.label}`;
    const existing = merged.get(key);
    const sourceDocEntries = leaf.sourcePaths.map((sourcePath) => ({
      title: `来源：${path.basename(sourcePath)}`,
      url: toDocUrl(path.dirname(sourcePath), sourcePath),
    }));

    if (!existing) {
      merged.set(key, {
        ...leaf,
        label: canonical.label,
        area: canonical.area,
        knowledgeDocs: uniqueDocs([...sourceDocEntries, ...leaf.knowledgeDocs]),
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      summary: unique([existing.summary, leaf.summary]).filter(Boolean).join(" / "),
      prerequisites: unique([existing.prerequisites, leaf.prerequisites].filter(Boolean) as string[]).join("；"),
      invoke: existing.invoke || leaf.invoke,
      commands: unique([...existing.commands, ...leaf.commands]),
      capabilities: unique([...existing.capabilities, ...leaf.capabilities]),
      useCases: uniqueUseCases([...existing.useCases, ...leaf.useCases]),
      inputs: uniqueInputs([...existing.inputs, ...leaf.inputs]),
      knowledgeDocs: uniqueDocs([...existing.knowledgeDocs, ...sourceDocEntries, ...leaf.knowledgeDocs]),
      tags: unique([...existing.tags, ...leaf.tags, canonical.area, canonical.label]),
      requiredSkills: dedupeModules([...existing.requiredSkills, ...leaf.requiredSkills]),
      sourcePaths: unique([...existing.sourcePaths, ...leaf.sourcePaths]),
      mergedFrom: unique([...existing.mergedFrom, ...leaf.mergedFrom]),
      route: existing.route,
    });
  }

  return [...merged.values()];
}

function buildParentNode(
  id: string,
  level: 1 | 2,
  label: string,
  parentId: string | null,
  children: RawLeafNode[],
) {
  const requiredSkills = dedupeModules(
    children.flatMap((child) => child.requiredSkills),
  );
  const sopCount = children.length;
  const route = resolveAgentRoute({
    domain: level === 1 ? label : children[0]?.domain ?? label,
    area: level === 2 ? label : children[0]?.area ?? label,
    label,
    summary: children.map((child) => child.summary).join(" "),
    commands: children.flatMap((child) => child.commands).slice(0, 12),
  });

  return {
    id,
    level,
    label,
    status: "idle" as const,
    parentId,
    subtitle:
      level === 1
        ? `${sopCount} SOP · ${requiredSkills.length} 技能模块`
        : `${sopCount} workflows`,
    childCount: sopCount,
    drawerContent: {
      summary:
        level === 1
          ? `该功能大类下包含 ${sopCount} 个 SOP，运行前至少需要准备以下技能模块。`
          : `该具体领域下包含 ${sopCount} 个 SOP，以下技能模块是最小可运行集合。`,
      minimumSkillsNote:
        requiredSkills.length > 0
          ? `最少需要 ${requiredSkills.length} 个技能模块`
          : "该层级暂无显式技能依赖",
      route,
      capabilities:
        level === 1
          ? children.slice(0, 8).map((child) => child.label)
          : children.map((child) => child.label),
      useCases: children.slice(0, 8).map((child) => ({
        title: child.label,
        summary: child.summary,
      })),
      inputs: [],
      requiredSkills,
      knowledgeBase: {
        tags: unique(children.flatMap((child) => child.tags)).slice(0, 12),
        documents: [],
      },
    },
  };
}

function getDomainOrder(label: string) {
  const order = ["个人管理", CONTENT_DOMAIN, "项目产出与资料管理"];
  const index = order.indexOf(label);
  return index === -1 ? order.length : index;
}

function getAreaOrder(domain: string, label: string) {
  if (domain === CONTENT_DOMAIN) {
    const index = CONTENT_AREAS.indexOf(label);
    return index === -1 ? CONTENT_AREAS.length : index;
  }
  return 999;
}

export function loadSkillTreeNodes() {
  const installedSkills = buildInstalledSkillCatalog();
  const contentNodes = readContentSystemNodes();
  const foundationModules = buildFoundationModuleCatalog(contentNodes);
  const leaves = mergeContentLeaves([
    ...buildContentLeaves(installedSkills, foundationModules),
    ...buildSopLeaves(installedSkills, foundationModules),
  ]);

  const groupedByDomain = new Map<string, RawLeafNode[]>();
  for (const leaf of leaves) {
    const bucket = groupedByDomain.get(leaf.domain) ?? [];
    bucket.push(leaf);
    groupedByDomain.set(leaf.domain, bucket);
  }

  const nodes: SkillNode[] = [];

  const sortedDomains = [...groupedByDomain.entries()].sort(
    (a, b) => getDomainOrder(a[0]) - getDomainOrder(b[0]) || a[0].localeCompare(b[0], "zh-Hans-CN"),
  );

  for (const [domain, domainLeaves] of sortedDomains) {
    const domainId = `domain-${slugify(domain)}`;
    nodes.push(buildParentNode(domainId, 1, domain, null, domainLeaves));

    const groupedByArea = new Map<string, RawLeafNode[]>();
    for (const leaf of domainLeaves) {
      const bucket = groupedByArea.get(leaf.area) ?? [];
      bucket.push(leaf);
      groupedByArea.set(leaf.area, bucket);
    }

    if (domain === CONTENT_DOMAIN) {
      for (const area of CONTENT_AREAS) {
        if (!groupedByArea.has(area)) {
          groupedByArea.set(area, []);
        }
      }
    }

    const sortedAreas = [...groupedByArea.entries()].sort((a, b) => {
      const diff = getAreaOrder(domain, a[0]) - getAreaOrder(domain, b[0]);
      if (diff !== 0) {
        return diff;
      }
      return a[0].localeCompare(b[0], "zh-Hans-CN");
    });

    for (const [area, areaLeaves] of sortedAreas) {
      const areaId = `area-${slugify(domain)}-${slugify(area)}`;
      nodes.push(buildParentNode(areaId, 2, area, domainId, areaLeaves));

      for (const leaf of areaLeaves) {
        nodes.push({
          id: leaf.id,
          level: 3,
          label: leaf.label,
          subtitle:
            leaf.mergedFrom.length > 1
              ? `Merged SOP · ${leaf.mergedFrom.length} sources`
              : leaf.sourceType === "sop"
                ? "SOP"
                : "Workflow",
          status: "idle",
          parentId: areaId,
          sourceType: leaf.sourceType,
          sourcePath: leaf.sourcePath,
          drawerContent: {
            summary:
              leaf.mergedFrom.length > 1
                ? `${leaf.summary}。已融合 ${leaf.mergedFrom.length} 个同类 SOP：${leaf.mergedFrom.join("、")}`
                : leaf.summary,
            prerequisites: leaf.prerequisites,
            minimumSkillsNote:
              leaf.requiredSkills.length > 0
                ? `运行此 SOP 最少需要 ${leaf.requiredSkills.length} 个技能模块`
                : "该 SOP 暂无显式技能依赖",
            route: leaf.route,
            capabilities: leaf.capabilities,
            useCases: leaf.useCases,
            inputs: leaf.inputs,
            invoke: leaf.invoke,
            commands: leaf.commands,
            requiredSkills: leaf.requiredSkills,
            knowledgeBase: {
              tags: leaf.tags,
              documents: leaf.knowledgeDocs,
            },
          },
        });
      }
    }
  }

  return nodes.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    if (a.level === 1) {
      return getDomainOrder(a.label) - getDomainOrder(b.label);
    }
    if ((a.parentId ?? "") !== (b.parentId ?? "")) {
      return (a.parentId ?? "").localeCompare(b.parentId ?? "", "zh-Hans-CN");
    }
    if (a.level === 2) {
      const parent = nodes.find((node) => node.id === a.parentId);
      const domainLabel = parent?.label ?? "";
      const diff = getAreaOrder(domainLabel, a.label) - getAreaOrder(domainLabel, b.label);
      if (diff !== 0) {
        return diff;
      }
    }
    return a.label.localeCompare(b.label, "zh-Hans-CN");
  });
}
