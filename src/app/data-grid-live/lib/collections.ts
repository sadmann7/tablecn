"use client";

import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { type TaskSchema, taskSchema } from "./validation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  },
});

export const tasksCollection = createCollection(
  queryCollectionOptions({
    id: "tasks",
    queryKey: ["tasks"],
    queryClient,
    queryFn: async (): Promise<TaskSchema[]> => {
      const response = await fetch("/api/tasks");
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      const data = taskSchema.array().safeParse(await response.json()).data;

      if (!data) {
        throw new Error("Failed to parse tasks");
      }

      return data;
    },
    getKey: (item: TaskSchema) => item.id,
    schema: taskSchema,
    onInsert: async ({ transaction }) => {
      const tasksToInsert = transaction.mutations
        .map((m) => m?.modified)
        .filter((modified): modified is TaskSchema => modified != null)
        .map(
          ({
            // Exclude auto-generated fields
            id: _id,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...data
          }) => data,
        );

      if (tasksToInsert.length === 0) return;

      // Use bulk insert - single DB query for all inserts
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tasksToInsert }),
      });

      if (!response.ok) {
        throw new Error("Failed to create tasks");
      }
    },
    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations
        .filter(
          (m): m is typeof m & { key: string; changes: Partial<TaskSchema> } =>
            m?.key != null && m?.changes != null,
        )
        .map((m) => ({ id: m.key, changes: m.changes }));

      if (updates.length === 0) return;

      // Use bulk update - optimized for same-changes case
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tasks");
      }
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations
        .map((m) => m?.key)
        .filter((id): id is string => id != null);

      if (ids.length === 0) return;

      // Use bulk delete - single DB query for all deletes
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete tasks");
      }
    },
  }),
);
