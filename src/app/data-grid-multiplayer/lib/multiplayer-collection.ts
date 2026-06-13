import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { getAbsoluteUrl } from "@/lib/utils";
import {
  type SkaterSchema,
  skaterSchema,
} from "@/app/data-grid-live/lib/validation";
import type { RowPayload } from "../../../../party/types";

export const queryClient = new QueryClient();

const log = (...args: unknown[]) => console.log("[multiplayer-collection]", ...args);

// Row IDs that arrived via WebSocket from another user.
// Prevents re-persisting to Postgres what the sender already persisted.
export const remoteIds = new Set<string>();

// Serialize a SkaterSchema row for wire transport (Date → ISO string)
function toWire(row: SkaterSchema): RowPayload {
  return {
    ...row,
    startedSkating: row.startedSkating?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

// -----------------------------------------------------------------
// Broadcast callbacks — set by the demo component after WS is ready.
// The collection handlers call these AFTER a successful Postgres write,
// so other clients only receive the broadcast once the data is durable.
// -----------------------------------------------------------------
export interface BroadcastCallbacks {
  onAfterInsert?: (rows: RowPayload[]) => void;
  onAfterUpdate?: (changes: Array<{ id: string; column: string; value: unknown }>) => void;
  onAfterDelete?: (ids: string[]) => void;
}

export const broadcastCallbacks: BroadcastCallbacks = {};

export const multiplayerCollection = createCollection(
  queryCollectionOptions({
    id: "multiplayer-skaters",
    queryKey: ["multiplayer-skaters"],
    queryClient,
    queryFn: async (): Promise<SkaterSchema[]> => {
      log("Fetching from /api/skaters");
      const response = await fetch(getAbsoluteUrl("/api/skaters"));
      if (!response.ok) throw new Error("Failed to fetch skaters");
      const data = skaterSchema.array().safeParse(await response.json()).data;
      if (!data) throw new Error("Failed to parse skaters");
      log(`Fetched ${data.length} rows`);
      return data;
    },
    getKey: (item: SkaterSchema) => item.id,
    schema: skaterSchema,

    onInsert: async ({ transaction }) => {
      const toInsert = transaction.mutations
        .map((m) => m?.modified)
        .filter((m): m is SkaterSchema => {
          if (!m) return false;
          if (remoteIds.has(m.id)) {
            log(`onInsert: skipping remote row id=${m.id}`);
            remoteIds.delete(m.id);
            return false;
          }
          return true;
        })
        .map(({ createdAt: _c, updatedAt: _u, ...data }) => data);

      if (toInsert.length === 0) {
        log("onInsert: all remote — skipping Postgres + broadcast");
        return;
      }

      log(`onInsert: persisting ${toInsert.length} row(s) to Postgres`);
      const response = await fetch(getAbsoluteUrl("/api/skaters"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skaters: toInsert }),
      });
      if (!response.ok) throw new Error("Failed to create skaters");

      // Broadcast AFTER Postgres write is confirmed — prevents race conditions
      // where receivers refetch before the row is visible in Postgres.
      const fullRows = transaction.mutations
        .map((m) => m?.modified)
        .filter((m): m is SkaterSchema => m != null && toInsert.some((t) => t.id === m.id));
      if (fullRows.length > 0) {
        log(`onInsert: broadcasting ${fullRows.length} row(s)`);
        broadcastCallbacks.onAfterInsert?.(fullRows.map(toWire));
      }
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations
        .filter(
          (m): m is typeof m & { key: string; changes: Partial<SkaterSchema> } => {
            if (!m?.key || !m.changes) return false;
            if (remoteIds.has(m.key)) {
              log(`onUpdate: skipping remote row id=${m.key}`);
              remoteIds.delete(m.key);
              return false;
            }
            return true;
          },
        )
        .map((m) => ({ id: m.key, changes: m.changes }));

      if (updates.length === 0) {
        log("onUpdate: all remote — skipping Postgres + broadcast");
        return;
      }

      log(`onUpdate: persisting ${updates.length} update(s) to Postgres`);
      const response = await fetch(getAbsoluteUrl("/api/skaters"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error("Failed to update skaters");

      // Broadcast individual cell changes after Postgres write
      const cellChanges: Array<{ id: string; column: string; value: unknown }> = [];
      for (const { id, changes } of updates) {
        for (const [column, value] of Object.entries(changes)) {
          cellChanges.push({
            id,
            column,
            value: value instanceof Date ? value.toISOString() : value,
          });
        }
      }
      if (cellChanges.length > 0) {
        log(`onUpdate: broadcasting ${cellChanges.length} cell change(s)`);
        broadcastCallbacks.onAfterUpdate?.(cellChanges);
      }
    },

    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations
        .map((m) => m?.key)
        .filter((id): id is string => {
          if (!id) return false;
          if (remoteIds.has(id)) {
            log(`onDelete: skipping remote row id=${id}`);
            remoteIds.delete(id);
            return false;
          }
          return true;
        });

      if (ids.length === 0) {
        log("onDelete: all remote — skipping Postgres + broadcast");
        return;
      }

      log(`onDelete: persisting ${ids.length} delete(s) to Postgres`);
      const response = await fetch(getAbsoluteUrl("/api/skaters"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("Failed to delete skaters");

      log(`onDelete: broadcasting ${ids.length} id(s)`);
      broadcastCallbacks.onAfterDelete?.(ids);
    },
  }),
);
