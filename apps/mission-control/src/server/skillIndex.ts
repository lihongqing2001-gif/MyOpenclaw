import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SkillIndexScope = "workspace" | "global" | "system";

export interface IndexedSkillRecord {
  dirName: string;
  label: string;
  summary: string;
  features: string[];
  useCases: string[];
  commands: string[];
  installUrl?: string;
  skillPath: string;
  readmePath?: string;
  scope: SkillIndexScope;
  scopeLabel: string;
  matchTokens: string[];
}

const homeDir = os.homedir();

const SKILL_ROOTS: Array<{
  root: string;
  scope: SkillIndexScope;
  priority: number;
  scopeLabel: string;
}> = [
  {
    root: path.join(homeDir, ".openclaw", "workspace", "skills"),
    scope: "workspace",
    priority: 0,
    scopeLabel: "Workspace Skill",
  },
  {
    root: path.join(homeDir, ".agents", "skills"),
    scope: "global",
    priority: 1,
    scopeLabel: "Global Skill",
  },
  {
    root: path.join(homeDir, ".codex", "skills"),
    scope: "system",
    priority: 2,
    scopeLabel: "System Skill",
  },
];

const IGNORED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
]);

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
  return [...new Set(
    sectionContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean),
  )];
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
      candidate.startsWith("uv ") ||
      candidate.startsWith("claw ")
    ) {
      commands.add(candidate);
    }
  }
  return [...commands];
}

function extractExternalLink(markdown: string) {
  return markdown.match(/\[(?:[^\]]+)\]\((https?:\/\/[^)]+)\)/)?.[1];
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

function walkSkillDirectories(root: string) {
  if (!exists(root)) {
    return [];
  }

  const results: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[] = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      results.push(current);
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      stack.push(path.join(current, entry.name));
    }
  }

  return results.sort();
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

export function getSkillSourceRoots() {
  return SKILL_ROOTS.map((item) => item.root).filter(exists);
}

export function listIndexedSkills() {
  const indexed = new Map<
    string,
    { priority: number; record: IndexedSkillRecord }
  >();
  const ignoredTokens = new Set([
    "skill",
    "skills",
    "agent",
    "wrap",
    "plus",
    "auto",
    "openclaw",
  ]);

  for (const source of SKILL_ROOTS) {
    for (const dirPath of walkSkillDirectories(source.root)) {
      const skillPath = path.join(dirPath, "SKILL.md");
      const readmePath = path.join(dirPath, "README.md");
      const skillMarkdown = readTextIfExists(skillPath);
      if (!skillMarkdown) {
        continue;
      }

      const readmeMarkdown = readTextIfExists(readmePath) ?? "";
      const frontmatter = parseFrontmatter(skillMarkdown);
      const dirName = path.basename(dirPath);
      const label = frontmatter.name || firstHeading(skillMarkdown) || dirName;
      const summary =
        frontmatter.description ||
        firstParagraph(skillMarkdown) ||
        `${source.scopeLabel} indexed by OpenClaw.`;
      const features = extractBulletLines(
        extractSection(skillMarkdown, "Key Features") ||
          extractSection(skillMarkdown, "Features") ||
          extractSection(skillMarkdown, "What Makes This Different?"),
      );
      const useCases = extractBulletLines(extractSection(skillMarkdown, "Use Cases"));
      const commands = extractCommands(`${skillMarkdown}\n${readmeMarkdown}`);
      const installUrl = extractExternalLink(`${skillMarkdown}\n${readmeMarkdown}`);
      const matchTokens = unique([
        dirName.toLowerCase(),
        label.toLowerCase(),
        ...dirName
          .split(/[-_]/)
          .map((token) => token.toLowerCase())
          .filter((token) => token.length >= 4 && !ignoredTokens.has(token)),
      ]);

      const record: IndexedSkillRecord = {
        dirName,
        label,
        summary,
        features,
        useCases,
        commands,
        installUrl: installUrl || undefined,
        skillPath,
        readmePath: exists(readmePath) ? readmePath : undefined,
        scope: source.scope,
        scopeLabel: source.scopeLabel,
        matchTokens,
      };

      const key = dirName.toLowerCase();
      const previous = indexed.get(key);
      if (!previous || source.priority < previous.priority) {
        indexed.set(key, {
          priority: source.priority,
          record,
        });
      }
    }
  }

  return [...indexed.values()]
    .map((item) => item.record)
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}
