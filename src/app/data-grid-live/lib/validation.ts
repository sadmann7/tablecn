import { z } from "zod";
import { tasks } from "@/db/schema";

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().optional(),
});

export const taskSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string().nullable(),
  status: z.enum(tasks.status.enumValues),
  label: z.enum(tasks.label.enumValues),
  priority: z.enum(tasks.priority.enumValues),
  estimatedHours: z.number(),
  archived: z.boolean(),
  tags: z.array(z.string()).nullable(),
  files: z.array(fileSchema).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const insertTaskSchema = z.object({
  code: z.string(),
  title: z.string().nullable().optional(),
  status: z.enum(tasks.status.enumValues).optional(),
  label: z.enum(tasks.label.enumValues).optional(),
  priority: z.enum(tasks.priority.enumValues).optional(),
  estimatedHours: z.number().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
  files: z.array(fileSchema).nullable().optional(),
});

export const insertTasksSchema = z.object({
  tasks: z.array(insertTaskSchema).min(1),
});

export const updateTaskSchema = z.object({
  title: z.string().nullable().optional(),
  status: z.enum(tasks.status.enumValues).optional(),
  label: z.enum(tasks.label.enumValues).optional(),
  priority: z.enum(tasks.priority.enumValues).optional(),
  estimatedHours: z.number().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()).nullable().optional(),
  files: z.array(fileSchema).nullable().optional(),
});

export const updateTasksSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        changes: updateTaskSchema,
      }),
    )
    .min(1),
});

export const deleteTasksSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export type TaskSchema = z.infer<typeof taskSchema>;
