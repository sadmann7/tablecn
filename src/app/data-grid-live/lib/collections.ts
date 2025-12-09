"use client";

import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { type SkaterSchema, skaterSchema } from "./validation";

const queryClient = new QueryClient();

export const skatersCollection = createCollection(
  queryCollectionOptions({
    id: "skaters",
    queryKey: ["skaters"],
    queryClient,
    queryFn: async (): Promise<SkaterSchema[]> => {
      const response = await fetch("/api/skaters");
      if (!response.ok) {
        throw new Error("Failed to fetch skaters");
      }
      const data = skaterSchema.array().safeParse(await response.json()).data;

      if (!data) {
        throw new Error("Failed to parse skaters");
      }

      return data;
    },
    getKey: (item: SkaterSchema) => item.id,
    schema: skaterSchema,
    onInsert: async ({ transaction }) => {
      const skatersToInsert = transaction.mutations
        .map((m) => m?.modified)
        .filter((modified): modified is SkaterSchema => modified != null)
        .map(
          ({
            // Exclude auto-generated fields
            id: _id,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...data
          }) => data,
        );

      if (skatersToInsert.length === 0) return;

      // Use bulk insert - single DB query for all inserts
      const response = await fetch("/api/skaters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skaters: skatersToInsert }),
      });

      if (!response.ok) {
        throw new Error("Failed to create skaters");
      }
    },
    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations
        .filter(
          (
            m,
          ): m is typeof m & {
            key: string;
            changes: Partial<SkaterSchema>;
          } => m?.key != null && m?.changes != null,
        )
        .map((m) => ({ id: m.key, changes: m.changes }));

      if (updates.length === 0) return;

      // Use bulk update - optimized for same-changes case
      const response = await fetch("/api/skaters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update skaters");
      }
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations
        .map((m) => m?.key)
        .filter((id): id is string => id != null);

      if (ids.length === 0) return;

      // Use bulk delete - single DB query for all deletes
      const response = await fetch("/api/skaters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete skaters");
      }
    },
  }),
);
