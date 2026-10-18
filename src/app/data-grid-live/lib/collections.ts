import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  pendingWrite = result.catch((error: unknown) => {
    // Failed writes roll back, so tell the user instead of letting the edit vanish
    toast.error(
      error instanceof Error ? error.message : "Couldn't save your changes",
    );
  });
  return result;
}

function assertWriteOk(response: Response) {
  if (response.ok) return;
  throw new Error(
    response.status === 429
      ? "Too many changes at once, so the last one was undone. Try again in a few seconds."
      : "Couldn't save your changes, so they were undone.",
  );
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

        assertWriteOk(response);

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

        assertWriteOk(response);

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

        assertWriteOk(response);

        collection.utils.writeDelete(ids);

        return { refetch: false };
      }),
  }),
);
