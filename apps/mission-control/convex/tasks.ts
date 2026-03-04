import { queryGeneric as query } from "convex/server";

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("events").withIndex("by_timestamp").order("desc").take(20);
  }
});
