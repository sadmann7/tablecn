import { z } from "zod";

// The demo's rows live in the room server's durable object storage, so these
// enums are defined here rather than in a database schema
export const SKATER_STANCES = ["regular", "goofy"] as const;
export const SKATER_STYLES = [
  "street",
  "vert",
  "park",
  "freestyle",
  "all-around",
] as const;
export const SKATER_STATUSES = [
  "amateur",
  "sponsored",
  "pro",
  "legend",
] as const;

const mediaSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().optional(),
});

export const skaterSchema = z.object({
  id: z.string(),
  order: z.number(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  stance: z.enum(SKATER_STANCES).nullable(),
  style: z.enum(SKATER_STYLES).nullable(),
  status: z.enum(SKATER_STATUSES).nullable(),
  yearsSkating: z.number().nullable(),
  startedSkating: z.coerce.date().nullable(),
  isPro: z.boolean(),
  tricks: z.array(z.string()).nullable(),
  media: z.array(mediaSchema).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export type SkaterSchema = z.infer<typeof skaterSchema>;
