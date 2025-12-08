import { z } from "zod";

export const taskSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string().nullable(),
  status: z.enum(["todo", "in-progress", "done", "canceled"]),
  label: z.enum(["bug", "feature", "enhancement", "documentation"]),
  priority: z.enum(["low", "medium", "high"]),
  estimatedHours: z.number(),
  archived: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export type TaskSchema = z.infer<typeof taskSchema>;
