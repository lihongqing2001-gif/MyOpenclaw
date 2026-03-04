import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

type MemoryItem = {
  _id: string;
  title: string;
  summary: string;
  tags: string[];
};

const seededMemories: MemoryItem[] = [
  {
    _id: "seed-memory-1",
    title: "Incident Playbook",
    summary: "Escalation path and rollback checklist for production incidents.",
    tags: ["operations", "incident"]
  },
  {
    _id: "seed-memory-2",
    title: "Release Cadence",
    summary: "Ship weekly on Wednesdays; hotfix window remains same-day.",
    tags: ["release", "process"]
  },
  {
    _id: "seed-memory-3",
    title: "Monitoring Migration",
    summary: "Mirror metrics in Mission Control before cutting over dashboards.",
    tags: ["monitoring", "migration"]
  }
];

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("memories").withIndex("by_created_at").order("desc").collect();
    const source: MemoryItem[] =
      rows.length > 0
        ? rows.map((row) => ({
            _id: String(row._id),
            title: row.title,
            summary: row.summary,
            tags: row.tags
          }))
        : seededMemories;

    const term = args.search?.trim().toLowerCase();
    if (!term) {
      return source;
    }

    return source.filter(
      (memory) =>
        memory.title.toLowerCase().includes(term) ||
        memory.summary.toLowerCase().includes(term) ||
        memory.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  }
});
