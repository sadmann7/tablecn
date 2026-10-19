import { z } from "zod";

import { skaters } from "@/db/schema";

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
  stance: z.enum(skaters.stance.enumValues).nullable(),
  style: z.enum(skaters.style.enumValues).nullable(),
  status: z.enum(skaters.status.enumValues).nullable(),
  yearsSkating: z.number().nullable(),
  startedSkating: z.coerce.date().nullable(),
  isPro: z.boolean(),
  tricks: z.array(z.string()).nullable(),
  media: z.array(mediaSchema).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export type SkaterSchema = z.infer<typeof skaterSchema>;
