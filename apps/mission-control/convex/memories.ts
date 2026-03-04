import { queryGeneric } from "convex/server";
import { v } from "convex/values";

type MemoryRecord = {
  _id: string;
  title: string;
  summary: string;
  source: string;
  type: string;
  tags: string[];
};

const seededMemories: MemoryRecord[] = [
  {
    _id: "seed-memory-1",
    title: "Incident Playbook",
    summary: "Escalation path and rollback checklist for production incidents.",
    source: "operations",
    type: "runbook",
    tags: ["incident", "escalation"]
  },
  {
    _id: "seed-memory-2",
    title: "Release Cadence Decision",
    summary: "Ship weekly on Wednesdays; hotfix window remains same-day.",
    source: "product",
    type: "decision",
    tags: ["release", "process"]
  },
  {
    _id: "seed-memory-3",
    title: "Monitoring Migration Retrospective",
    summary: "Mirror metrics in Mission Control before cutting over dashboards.",
    source: "engineering",
    type: "retrospective",
    tags: ["monitoring", "migration"]
  }
];

export const list = queryGeneric({
  args: {
    search: v.optional(v.string()),
    source: v.optional(v.string()),
    type: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("memories").withIndex("by_created_at").order("desc").collect();
    const source: MemoryRecord[] =
      rows.length > 0
        ? rows.map((row) => ({
            _id: row._id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            type: row.type,
            tags: row.tags
          }))
        : seededMemories;

    const term = args.search?.trim().toLowerCase();

    return source.filter((memory) => {
      if (args.source && memory.source !== args.source) {
        return false;
      }
      if (args.type && memory.type !== args.type) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        memory.title.toLowerCase().includes(term) ||
        memory.summary.toLowerCase().includes(term) ||
        memory.source.toLowerCase().includes(term) ||
        memory.type.toLowerCase().includes(term) ||
        memory.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }
});
