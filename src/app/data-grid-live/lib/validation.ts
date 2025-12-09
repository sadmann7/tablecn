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
  name: z.string().nullable(),
  email: z.string().nullable(),
  stance: z.enum(skaters.stance.enumValues),
  style: z.enum(skaters.style.enumValues),
  status: z.enum(skaters.status.enumValues),
  yearsSkating: z.number(),
  startedSkating: z.coerce.date().nullable(),
  isPro: z.boolean(),
  tricks: z.array(z.string()).nullable(),
  media: z.array(mediaSchema).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const insertSkaterSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  stance: z.enum(skaters.stance.enumValues).optional(),
  style: z.enum(skaters.style.enumValues).optional(),
  status: z.enum(skaters.status.enumValues).optional(),
  yearsSkating: z.number().optional(),
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
  email: z.string().nullable().optional(),
  stance: z.enum(skaters.stance.enumValues).optional(),
  style: z.enum(skaters.style.enumValues).optional(),
  status: z.enum(skaters.status.enumValues).optional(),
  yearsSkating: z.number().optional(),
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
