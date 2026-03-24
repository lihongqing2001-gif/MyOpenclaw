import fs from "node:fs";
import path from "node:path";
import { AgentRoute } from "../types";

type RoutingInput = {
  domain: string;
  area: string;
  label: string;
  sourceType?: string;
  summary?: string;
  commands?: string[];
};

type RouteRule = {
  id: string;
  match?: {
    domains?: string[];
    areas?: string[];
    labels?: string[];
    sourceTypes?: string[];
  };
  route: AgentRoute;
};

type RouteConfig = {
  version: number;
  default: AgentRoute;
  rules: RouteRule[];
};

const configPath = path.join(process.cwd(), "agent-routing.config.json");

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function normalizedHaystack(input: RoutingInput) {
  return [
    input.domain,
    input.area,
    input.label,
    input.summary ?? "",
    ...(input.commands ?? []),
    input.sourceType ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function defaultRoute(): AgentRoute {
  return {
    orchestrator: "main",
    preferredAgents: ["executor", "engineer", "designer"],
    reason: "main 先接单，再按任务性质把工作分派给最合适的专门 agent。",
  };
}

function fallbackRoute(input: RoutingInput): AgentRoute {
  const haystack = normalizedHaystack(input);

  if (
    haystack.includes("日记") ||
    haystack.includes("calendar") ||
    haystack.includes("trip") ||
    haystack.includes("reminder") ||
    haystack.includes("个人管理") ||
    haystack.includes("journal")
  ) {
    return {
      orchestrator: "main",
      preferredAgents: ["life-assistant", "executor"],
      reason: "这是个人管理/日程/日记类任务，main 应优先分派给 life-assistant 处理，需要执行落地时再借助 executor。",
    };
  }

  if (
    haystack.includes("小红书") ||
    haystack.includes("xiaohongshu") ||
    haystack.includes("xhs") ||
    haystack.includes("内容") ||
    haystack.includes("热点") ||
    haystack.includes("模仿") ||
    haystack.includes("评论") ||
    haystack.includes("crawl")
  ) {
    return {
      orchestrator: "main",
      preferredAgents: ["executor", "designer", "engineer"],
      reason: "这是内容/抓取/生成类任务，main 应先让 executor 落地执行，涉及呈现与包装时再调 designer，确有工程改造再调 engineer。",
    };
  }

  if (
    haystack.includes("设计") ||
    haystack.includes("ui") ||
    haystack.includes("ux") ||
    haystack.includes("dashboard") ||
    haystack.includes("界面") ||
    haystack.includes("体验")
  ) {
    return {
      orchestrator: "main",
      preferredAgents: ["designer", "engineer"],
      reason: "这是界面与体验类任务，main 应优先让 designer 定义与调整方案，必要时再让 engineer 实现。",
    };
  }

  if (
    haystack.includes("工程") ||
    haystack.includes("script") ||
    haystack.includes("python") ||
    haystack.includes("node ") ||
    haystack.includes("归档") ||
    haystack.includes("索引") ||
    haystack.includes("file")
  ) {
    return {
      orchestrator: "main",
      preferredAgents: ["engineer", "executor"],
      reason: "这是工程/脚本/文件处理类任务，main 应优先分派给 engineer，执行量大的步骤再交 executor。",
    };
  }

  return defaultRoute();
}

function loadRouteConfig(): RouteConfig | null {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(configPath, "utf-8")) as RouteConfig;
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function ruleMatches(input: RoutingInput, rule: RouteRule) {
  const haystack = normalizedHaystack(input);
  const match = rule.match ?? {};

  const domainOk =
    !match.domains || match.domains.some((item) => input.domain.includes(item));
  const areaOk =
    !match.areas || match.areas.some((item) => input.area.includes(item));
  const sourceOk =
    !match.sourceTypes ||
    match.sourceTypes.some((item) => (input.sourceType ?? "").includes(item));
  const labelOk =
    !match.labels ||
    match.labels.some((item) => haystack.includes(item.toLowerCase()));

  return domainOk && areaOk && sourceOk && labelOk;
}

export function resolveAgentRoute(input: RoutingInput): AgentRoute {
  const config = loadRouteConfig();
  if (config) {
    for (const rule of config.rules ?? []) {
      if (ruleMatches(input, rule)) {
        return {
          orchestrator: rule.route.orchestrator || "main",
          preferredAgents: unique(rule.route.preferredAgents ?? []),
          reason: rule.route.reason || defaultRoute().reason,
        };
      }
    }

    return {
      orchestrator: config.default?.orchestrator || "main",
      preferredAgents: unique(config.default?.preferredAgents ?? []),
      reason: config.default?.reason || defaultRoute().reason,
    };
  }

  const fallback = fallbackRoute(input);
  return {
    orchestrator: fallback.orchestrator || "main",
    preferredAgents: unique(fallback.preferredAgents ?? []),
    reason: fallback.reason || defaultRoute().reason,
  };
}
