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

export const insertSkaterSchema = z.object({
  id: z.string().optional(),
  order: z.number().optional(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  stance: z.enum(skaters.stance.enumValues).nullable().optional(),
  style: z.enum(skaters.style.enumValues).nullable().optional(),
  status: z.enum(skaters.status.enumValues).nullable().optional(),
  yearsSkating: z.number().nullable().optional(),
  startedSkating: z.coerce.date().nullable().optional(),
  isPro: z.boolean().optional(),
  tricks: z.array(z.string()).nullable().optional(),
  media: z.array(mediaSchema).nullable().optional(),
});

export const insertSkatersSchema = z.object({
  skaters: z.array(insertSkaterSchema).min(1),
});

export const updateSkaterSchema = z.object({
  name: z.string().nullable().optional(),
  order: z.number().optional(),
  email: z.string().nullable().optional(),
  stance: z.enum(skaters.stance.enumValues).nullable().optional(),
  style: z.enum(skaters.style.enumValues).nullable().optional(),
  status: z.enum(skaters.status.enumValues).nullable().optional(),
  yearsSkating: z.number().nullable().optional(),
  startedSkating: z.coerce.date().nullable().optional(),
  isPro: z.boolean().optional(),
  tricks: z.array(z.string()).nullable().optional(),
  media: z.array(mediaSchema).nullable().optional(),
});

export const updateSkatersSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        changes: updateSkaterSchema,
      }),
    )
    .min(1),
});

export const deleteSkatersSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export type SkaterSchema = z.infer<typeof skaterSchema>;
