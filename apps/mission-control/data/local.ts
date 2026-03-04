export type MemoryEntry = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  owner: string;
  updatedAt: string;
  source: string;
  notes: string[];
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  group: "Developers" | "Writers" | "Designers" | "Operations";
  focus: string;
  status: "active" | "standby";
  skills: string[];
};

export const memoryEntries: MemoryEntry[] = [
  {
    id: "mem-ops-001",
    title: "Mission Control local-first rollout",
    summary: "Operations/Memory/Team 页面改为本地数据源，移除云端依赖。",
    tags: ["ops", "local-first"],
    owner: "中枢",
    updatedAt: "2026-03-05 04:10",
    source: "ops/notebook",
    notes: ["保留监控系统原入口", "Operations 全屏优先"]
  },
  {
    id: "mem-ops-002",
    title: "Monitoring continuity",
    summary: "旧监控面板继续接管，直到新版覆盖关键路径。",
    tags: ["monitoring", "parity"],
    owner: "Guardian",
    updatedAt: "2026-03-05 03:40",
    source: "ops/monitor",
    notes: ["新旧并行", "指标一致性优先"]
  },
  {
    id: "mem-prod-001",
    title: "Release checklist v1",
    summary: "发布前统一检查：监控、回滚、日志保留。",
    tags: ["release", "checklist"],
    owner: "Fixer",
    updatedAt: "2026-03-04 22:15",
    source: "ops/playbook",
    notes: ["回滚脚本放在 ops/bin", "灰度窗口 20min"]
  }
];

export const teamMembers: TeamMember[] = [
  {
    id: "team-dev-01",
    name: "Builder",
    role: "Platform integration",
    group: "Developers",
    focus: "API stitching & infra",
    status: "active",
    skills: ["Node", "Integrations", "Infra"]
  },
  {
    id: "team-dev-02",
    name: "Fixer",
    role: "Reliability + ops tooling",
    group: "Developers",
    focus: "Stability & observability",
    status: "active",
    skills: ["SRE", "Tooling", "Alerts"]
  },
  {
    id: "team-writer-01",
    name: "Scribe",
    role: "Docs + handoffs",
    group: "Writers",
    focus: "Runbooks & delivery notes",
    status: "standby",
    skills: ["Docs", "Handoff", "Narrative"]
  },
  {
    id: "team-design-01",
    name: "Lens",
    role: "UI polish + narrative",
    group: "Designers",
    focus: "Visual systems",
    status: "active",
    skills: ["UI", "Brand", "Motion"]
  },
  {
    id: "team-ops-01",
    name: "Guardian",
    role: "Monitoring + response",
    group: "Operations",
    focus: "Incident response",
    status: "active",
    skills: ["Monitoring", "Incident", "Recovery"]
  }
];
