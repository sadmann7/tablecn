"use client";

import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { type TaskSchema, taskSchema } from "./task-schema";

// Create a QueryClient at module level for the collection
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchInterval: 3000, // Poll every 3 seconds like in the TanStack example
    },
  },
});

// Create the tasks collection at module level
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
      return response.json() as Promise<TaskSchema[]>;
    },
    getKey: (item: TaskSchema) => item.id,
    schema: taskSchema,
    // Handle inserts by posting to API
    onInsert: async ({ transaction }) => {
      const mutation = transaction.mutations[0];
      if (!mutation?.modified) return;

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.modified),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      return response.json();
    },
    // Handle updates by patching to API
    onUpdate: async ({ transaction }) => {
      const mutation = transaction.mutations[0];
      if (!mutation?.key || !mutation?.modified) return;

      const response = await fetch(`/api/tasks/${mutation.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.modified),
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      return response.json();
    },
    // Handle deletes by sending DELETE request to API
    onDelete: async ({ transaction }) => {
      const mutation = transaction.mutations[0];
      if (!mutation?.key) return;

      const response = await fetch(`/api/tasks/${mutation.key}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }

      return response.json();
    },
    // Use eager mode to load all tasks upfront (good for <10k rows)
    syncMode: "eager",
  }),
);
