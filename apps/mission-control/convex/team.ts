import { queryGeneric } from "convex/server";

const seededTeam = [
  { _id: "seed-team-1", name: "Builder-01", role: "Backend systems", group: "Developers" },
  { _id: "seed-team-2", name: "Builder-02", role: "Frontend delivery", group: "Developers" },
  { _id: "seed-team-3", name: "Writer-01", role: "Runbooks and docs", group: "Writers" },
  { _id: "seed-team-4", name: "Designer-01", role: "UI and flow design", group: "Designers" },
  { _id: "seed-team-5", name: "Ops-01", role: "Deployments and monitoring", group: "Operations" }
] as const;

export const list = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("teamMembers").withIndex("by_group").collect();
    if (rows.length > 0) {
      return rows.map((row) => ({ _id: row._id, name: row.name, role: row.role, group: row.group }));
    }
    return seededTeam;
  }
});
