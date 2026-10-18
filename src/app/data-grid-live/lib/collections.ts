import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { getAbsoluteUrl } from "@/lib/utils";

import { type SkaterSchema, skaterSchema } from "./validation";

const queryClient = new QueryClient();

// Write handlers put the server's rows straight into the collection instead of refetching every row
const skatersResponseSchema = z.object({ skaters: skaterSchema.array() });

// Writes run in mutation order, so an update can't reach the server before its row's insert
let pendingWrite: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(write: () => Promise<T>) {
  const result = pendingWrite.then(write, write);
  pendingWrite = result.catch(() => undefined);
  return result;
}

export const skatersCollection = createCollection(
  queryCollectionOptions({
    id: "skaters",
    queryKey: ["skaters"],
    queryClient,
    queryFn: async (): Promise<SkaterSchema[]> => {
      const response = await fetch(getAbsoluteUrl("/api/skaters"));
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
    onInsert: ({ transaction, collection }) =>
      enqueueWrite(async () => {
        const skatersToInsert = transaction.mutations
          .map((m) => m?.modified)
          .filter((modified): modified is SkaterSchema => modified != null)
          .map(
            ({
              // The server sets the timestamps
              createdAt: _createdAt,
              updatedAt: _updatedAt,
              ...data
            }) => data,
          );

        if (skatersToInsert.length === 0) return { refetch: false };

        const response = await fetch(getAbsoluteUrl("/api/skaters"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skaters: skatersToInsert }),
        });

        if (!response.ok) {
          throw new Error("Failed to create skaters");
        }

        const { skaters } = skatersResponseSchema.parse(await response.json());
        collection.utils.writeInsert(skaters);

        return { refetch: false };
      }),
    onUpdate: ({ transaction, collection }) =>
      enqueueWrite(async () => {
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

        if (updates.length === 0) return { refetch: false };

        const response = await fetch(getAbsoluteUrl("/api/skaters"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update skaters");
        }

        const { skaters } = skatersResponseSchema.parse(await response.json());
        collection.utils.writeUpdate(skaters);

        return { refetch: false };
      }),
    onDelete: ({ transaction, collection }) =>
      enqueueWrite(async () => {
        const ids = transaction.mutations
          .map((m) => m?.key)
          .filter((id): id is string => id != null);

        if (ids.length === 0) return { refetch: false };

        const response = await fetch(getAbsoluteUrl("/api/skaters"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });

        if (!response.ok) {
          throw new Error("Failed to delete skaters");
        }

        collection.utils.writeDelete(ids);

        return { refetch: false };
      }),
  }),
);
