import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EvidenceLevel, KnowledgeItem, KnowledgeSourceKind, KnowledgeType } from "../types";
import { listIndexedSkills } from "./skillIndex";

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

const homeDir = os.homedir();
const workspaceRoot = path.join(homeDir, ".openclaw", "workspace");
const contentSkillTreePath = path.join(
  workspaceRoot,
  "content_system",
  "skilltree",
  "data.json",
);
const sopsRoot = path.join(workspaceRoot, "sops");
const agentsKnowledgeRoot = path.join(workspaceRoot, "agents", "knowledge");

function toDocUrl(targetPath?: string) {
  if (!targetPath) {
    return "#";
  }

  if (/^https?:\/\//i.test(targetPath)) {
    return targetPath;
  }

  return `/api/v1/doc?path=${encodeURIComponent(targetPath)}`;
}

function exists(targetPath: string) {
  return fs.existsSync(targetPath);
}

function readTextIfExists(targetPath: string) {
  if (!exists(targetPath)) {
    return null;
  }
  return fs.readFileSync(targetPath, "utf-8");
}

function firstHeading(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
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
  return sectionContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

function extractCommands(text: string) {
  const commands = new Set<string>();
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();
    if (
      /^\/[a-z0-9_-]+(?:\s|$)/i.test(candidate) ||
      candidate.startsWith("python ") ||
      candidate.startsWith("python3 ") ||
      candidate.startsWith("npm ") ||
      candidate.startsWith("node ") ||
      candidate.startsWith("claw ")
    ) {
      commands.add(candidate);
    }
  }
  return [...commands];
}

function extractExternalLinks(markdown: string) {
  const links: { title: string; url: string }[] = [];
  for (const match of markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    links.push({ title: match[1], url: match[2] });
  }
  return links;
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

function evidenceFromFrontmatter(frontmatter: Record<string, string>): EvidenceLevel {
  const raw = frontmatter.evidence?.trim().toLowerCase();
  if (raw === "confirmed") {
    return "confirmed";
  }
  if (raw === "runtime" || raw === "human-feedback") {
    return "runtime";
  }
  return "declared";
}

function knowledgeTypeFromAgentPath(relativePath: string, frontmatter: Record<string, string>): KnowledgeType {
  const explicit = frontmatter.knowledge_type?.trim().toLowerCase();
  if (
    explicit === "case-study" ||
    explicit === "runtime-lesson" ||
    explicit === "feedback" ||
    explicit === "asset-index"
  ) {
    return explicit;
  }

  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("cases/")) {
    return "case-study";
  }
  if (normalized.startsWith("runtime-lessons/")) {
    return "runtime-lesson";
  }
  if (normalized.startsWith("feedback/")) {
    return "feedback";
  }
  return "agent-knowledge";
}

function sourceKindFromKnowledgeType(type: KnowledgeType): KnowledgeSourceKind {
  if (type === "case-study" || type === "runtime-lesson" || type === "asset-index") {
    return "runtime";
  }
  if (type === "feedback") {
    return "feedback";
  }
  if (type === "qmd-result") {
    return "index";
  }
  return "reference";
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

function readAgentKnowledgeFiles() {
  if (!exists(agentsKnowledgeRoot)) {
    return [];
  }

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(fullPath);
      }
    }
  };

  walk(agentsKnowledgeRoot);
  return files.sort();
}

function buildAgentKnowledge(): KnowledgeItem[] {
  return readAgentKnowledgeFiles().map((docPath) => {
    const markdown = readTextIfExists(docPath) ?? "";
    const frontmatter = parseFrontmatter(markdown);
    const title =
      firstHeading(markdown)?.replace(/^#\s*/, "") ||
      path.basename(docPath, ".md");
    const summary = firstParagraph(markdown) || "Agent knowledge document";
    const relative = path.relative(agentsKnowledgeRoot, docPath);
    const pathParts = relative.split(path.sep);
    const topLevel = pathParts[0] || "agents-knowledge";
    const commands = extractCommands(markdown);
    const externalLinks = extractExternalLinks(markdown);
    const examples = extractBulletLines(extractSection(markdown, "Examples")).map(
      (item) => ({
        title: item,
        summary: `${title} example`,
      }),
    );
    const knowledgeType = knowledgeTypeFromAgentPath(relative, frontmatter);
    const evidenceLevel = evidenceFromFrontmatter(frontmatter);

    return {
      id: `kb-agent-${relative.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
      evidenceLevel,
      knowledgeType,
      sourceKind: sourceKindFromKnowledgeType(knowledgeType),
      updatedAt: frontmatter.updated_at,
      human: {
        title,
        summary,
        content_md: markdown.slice(0, 6000),
        tags: ["agent-knowledge", topLevel, ...pathParts.slice(1, -1)].filter(Boolean),
        domain: "Agents Knowledge",
        platform: topLevel,
        links: [{ title: relative, url: toDocUrl(docPath) }, ...externalLinks],
        examples,
      },
      machine: {
        intent: "agent_knowledge",
        entities: { docPath, relativePath: relative },
        steps: extractBulletLines(extractSection(markdown, "Steps")),
        commands,
        constraints: extractBulletLines(extractSection(markdown, "Constraints")),
      },
    } satisfies KnowledgeItem;
  });
}

function buildContentKnowledge(): KnowledgeItem[] {
  return readContentSystemNodes().map((item) => ({
    id: `kb-content-${item.id}`,
    evidenceLevel: "declared",
    knowledgeType: "content-reference",
    sourceKind: "reference",
    human: {
      title: item.title,
      summary: item.applications?.trim() || item.functions?.trim() || "Content workflow",
      content_md: [
        `# ${item.title}`,
        item.prerequisites ? `\n## Preconditions\n${item.prerequisites}` : "",
        item.functions ? `\n## Functions\n${item.functions}` : "",
        item.applications ? `\n## Applications\n${item.applications}` : "",
        item.invoke ? `\n## Invoke\n${item.invoke}` : "",
      ].join("\n"),
      tags: [item.category, item.subcategory, item.level, item.nodeType].filter(Boolean) as string[],
      domain: item.category || "Content",
      platform: "OpenClaw Content System",
      links: (item.portfolio ?? []).map((doc) => ({
        title: doc.title || "Portfolio",
        url: toDocUrl(doc.path),
      })),
      examples: (item.portfolio ?? []).map((doc) => ({
        title: doc.title || "Portfolio",
        summary: `${item.title} 示例资料`,
        url: toDocUrl(doc.path),
      })),
    },
    machine: {
      intent: "content_workflow",
      entities: { nodeId: item.id },
      steps: item.functions ? item.functions.split("→").map((step) => step.trim()).filter(Boolean) : [],
      commands: item.invoke ? extractCommands(item.invoke) : [],
      constraints: item.prerequisites ? [item.prerequisites] : [],
    },
  }));
}

function buildSkillKnowledge(): KnowledgeItem[] {
  const skills = listIndexedSkills();
  const scopeCounts = skills.reduce<Record<string, number>>((acc, skill) => {
    acc[skill.scope] = (acc[skill.scope] ?? 0) + 1;
    return acc;
  }, {});

  const indexItem =
    skills.length === 0
      ? []
      : [
          {
            id: "kb-skill-index-global",
            evidenceLevel: "declared",
            knowledgeType: "skill-reference",
            sourceKind: "reference",
            human: {
              title: "Global Skills Index",
              summary: `Indexed ${skills.length} skills across workspace, global, and system roots.`,
              content_md: [
                "# Global Skills Index",
                "",
                `- Workspace: ${scopeCounts.workspace ?? 0}`,
                `- Global: ${scopeCounts.global ?? 0}`,
                `- System: ${scopeCounts.system ?? 0}`,
                "",
                "## Skills",
                ...skills.map(
                  (skill) =>
                    `- ${skill.label} [${skill.scope}] :: ${skill.summary}`,
                ),
              ].join("\n"),
              tags: ["skill-index", "global-skills", "skills"],
              domain: "Skills",
              platform: "Unified Skill Index",
              links: skills.slice(0, 40).map((skill) => ({
                title: `${skill.label} (${skill.scope})`,
                url: toDocUrl(skill.skillPath),
              })),
              examples: [],
            },
            machine: {
              intent: "skill_index",
              entities: {
                count: skills.length,
                scopes: scopeCounts,
              },
              steps: skills.map((skill) => `${skill.label} (${skill.scope})`),
              commands: skills.flatMap((skill) => skill.commands).slice(0, 40),
              constraints: [],
            },
          } satisfies KnowledgeItem,
        ];

  return [
    ...indexItem,
    ...skills.map((skill) => {
      const skillMarkdown = readTextIfExists(skill.skillPath) ?? "";
      const readmeMarkdown = skill.readmePath
        ? readTextIfExists(skill.readmePath) ?? ""
        : "";
      const links = [
        { title: "SKILL.md", url: toDocUrl(skill.skillPath) },
        ...(skill.readmePath
          ? [{ title: "README.md", url: toDocUrl(skill.readmePath) }]
          : []),
        ...extractExternalLinks(`${skillMarkdown}\n${readmeMarkdown}`),
      ];

      return {
        id: `kb-skill-${skill.scope}-${skill.dirName}`,
        evidenceLevel: "declared",
        knowledgeType: "skill-reference",
        sourceKind: "reference",
        human: {
          title: skill.label,
          summary: skill.summary,
          content_md: [
            `# ${skill.label}`,
            "",
            `- Scope: ${skill.scope}`,
            `- Path: ${skill.skillPath}`,
            "",
            skill.summary,
            skill.features.length > 0
              ? `\n## Features\n- ${skill.features.join("\n- ")}`
              : "",
            skill.useCases.length > 0
              ? `\n## Use Cases\n- ${skill.useCases.join("\n- ")}`
              : "",
          ].join("\n"),
          tags: ["skill", skill.scope, skill.dirName],
          domain: "Skills",
          platform: skill.scopeLabel,
          links,
          examples: skill.useCases.map((item) => ({
            title: item,
            summary: `${skill.label} usage case`,
          })),
        },
        machine: {
          intent: "skill_reference",
          entities: {
            skillDir: skill.dirName,
            scope: skill.scope,
            sourcePath: skill.skillPath,
          },
          steps: skill.features,
          commands: skill.commands,
          constraints: [],
        },
      } satisfies KnowledgeItem;
    }),
  ];
}

function buildSopKnowledge(): KnowledgeItem[] {
  return readSopFiles().map((sopPath) => {
    const markdown = readTextIfExists(sopPath) ?? "";
    const title =
      firstHeading(markdown)?.replace(/^SOP:\s*/i, "") ||
      path.basename(sopPath, ".md");
    const summary = firstParagraph(markdown) || "SOP workflow";
    const triggers = extractBulletLines(extractSection(markdown, "Default Trigger"));
    const steps = extractSection(markdown, "Steps")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\)/.test(line))
      .map((line) => line.replace(/^\d+\)\s*/, "").trim());
    const constraints = extractBulletLines(extractSection(markdown, "Preconditions"));
    const commands = extractCommands(markdown);

    return {
      id: `kb-sop-${path.basename(sopPath, ".md")}`,
      evidenceLevel: "declared",
      knowledgeType: "sop-reference",
      sourceKind: "reference",
      human: {
        title,
        summary,
        content_md: markdown.slice(0, 6000),
        tags: ["sop", path.basename(sopPath, ".md")],
        domain: "SOP",
        platform: "OpenClaw Workflow",
        links: [{ title: path.basename(sopPath), url: toDocUrl(sopPath) }],
        examples: triggers.map((item) => ({
          title: item,
          summary,
        })),
      },
      machine: {
        intent: "sop_reference",
        entities: { sopPath },
        steps,
        commands,
        constraints,
      },
    } satisfies KnowledgeItem;
  });
}

export function buildWorkspaceKnowledgeItems() {
  const items = [
    ...buildContentKnowledge(),
    ...buildSkillKnowledge(),
    ...buildSopKnowledge(),
    ...buildAgentKnowledge(),
  ];
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}
