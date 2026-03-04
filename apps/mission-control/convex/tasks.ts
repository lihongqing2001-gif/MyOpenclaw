import { queryGeneric } from "convex/server";

export const listEvents = queryGeneric({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("events").withIndex("by_timestamp").order("desc").take(20);
  }
});
