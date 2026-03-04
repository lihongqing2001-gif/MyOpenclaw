import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  memories: defineTable({
    title: v.string(),
    summary: v.string(),
    source: v.string(),
    type: v.string(),
    tags: v.array(v.string()),
    createdAt: v.number()
  })
    .index("by_created_at", ["createdAt"])
    .index("by_source", ["source"])
    .index("by_type", ["type"]),
  teamMembers: defineTable({
    name: v.string(),
    role: v.string(),
    group: v.union(v.literal("Developers"), v.literal("Writers"), v.literal("Designers"), v.literal("Operations"))
  }).index("by_group", ["group"]),
  tasks: defineTable({
    title: v.string(),
    status: v.union(v.literal("todo"), v.literal("active"), v.literal("done")),
    owner: v.optional(v.string()),
    dueAt: v.optional(v.number())
  }),
  events: defineTable({
    title: v.string(),
    category: v.string(),
    timestamp: v.number(),
    detail: v.optional(v.string())
  }).index("by_timestamp", ["timestamp"])
});
