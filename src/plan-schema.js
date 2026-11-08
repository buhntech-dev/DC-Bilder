const { z } = require("zod");

const channelSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "voice"]),
  topic: z.string(),
  privateToRoles: z.array(z.string())
});

const categorySchema = z.object({
  name: z.string(),
  channels: z.array(channelSchema)
});

const roleSchema = z.object({
  name: z.string(),
  color: z.string(),
  hoist: z.boolean(),
  mentionable: z.boolean()
});

const serverPlanSchema = z.object({
  serverName: z.string(),
  summary: z.string(),
  roles: z.array(roleSchema),
  categories: z.array(categorySchema)
});

module.exports = { serverPlanSchema };