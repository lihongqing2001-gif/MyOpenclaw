import { mutationGeneric } from "convex/server";

export const bootstrap = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const memoryCount = (await ctx.db.query("memories").collect()).length;
    if (memoryCount === 0) {
      await ctx.db.insert("memories", {
        title: "Incident Playbook",
        summary: "Escalation path and rollback checklist for production incidents.",
        source: "operations",
        type: "runbook",
        tags: ["incident", "escalation"],
        createdAt: Date.now()
      });
      await ctx.db.insert("memories", {
        title: "Release Cadence Decision",
        summary: "Ship weekly on Wednesdays; hotfix window remains same-day.",
        source: "product",
        type: "decision",
        tags: ["release", "process"],
        createdAt: Date.now()
      });
      await ctx.db.insert("memories", {
        title: "Monitoring Migration Retrospective",
        summary: "Mirror metrics in Mission Control before cutting over dashboards.",
        source: "engineering",
        type: "retrospective",
        tags: ["monitoring", "migration"],
        createdAt: Date.now()
      });
    }

    const teamCount = (await ctx.db.query("teamMembers").collect()).length;
    if (teamCount === 0) {
      await ctx.db.insert("teamMembers", {
        name: "Builder-01",
        role: "Backend systems",
        group: "Developers"
      });
      await ctx.db.insert("teamMembers", {
        name: "Builder-02",
        role: "Frontend delivery",
        group: "Developers"
      });
      await ctx.db.insert("teamMembers", {
        name: "Writer-01",
        role: "Runbooks and docs",
        group: "Writers"
      });
      await ctx.db.insert("teamMembers", {
        name: "Designer-01",
        role: "UI and flow design",
        group: "Designers"
      });
      await ctx.db.insert("teamMembers", {
        name: "Ops-01",
        role: "Deployments and monitoring",
        group: "Operations"
      });
    }

    return { ok: true };
  }
});
