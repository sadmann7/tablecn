import type { ClientMessage, RowPayload, ServerMessage } from "@party/types";
import type {
  ChangeMessageOrDeleteKeyMessage,
  SyncConfig,
} from "@tanstack/react-db";

import { createCollection } from "@tanstack/react-db";

import {
  type SkaterSchema,
  skaterSchema,
} from "@/app/data-grid-multiplayer/lib/validation";

type SyncParams = Parameters<SyncConfig<SkaterSchema, string>["sync"]>[0];
type SkaterChange = ChangeMessageOrDeleteKeyMessage<SkaterSchema, string>;

export interface RoomConnection {
  send: (message: ClientMessage) => void;
  subscribe: (listener: (message: ServerMessage) => void) => () => void;
}

function parseSkater(raw: RowPayload) {
  const result = skaterSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function serializeValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeSkater(row: SkaterSchema): RowPayload {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializeValue(value)]),
  );
}

export function createSkatersCollection(connection: RoomConnection) {
  let syncParams: SyncParams | null = null;

  function writeSynced(changes: SkaterChange[], immediate = false) {
    if (!syncParams || changes.length === 0) return;
    syncParams.begin({ immediate });
    for (const change of changes) syncParams.write(change);
    void syncParams.commit();
  }

  function getUpsert(row: SkaterSchema): SkaterChange {
    return {
      type: syncParams?.collection.has(row.id) ? "update" : "insert",
      value: row,
    };
  }

  function onServerMessage(message: ServerMessage) {
    if (!syncParams) return;
    const { collection } = syncParams;

    switch (message.type) {
      case "snapshot": {
        syncParams.begin();
        syncParams.truncate();
        for (const raw of message.rows) {
          const row = parseSkater(raw);
          if (row) syncParams.write({ type: "insert", value: row });
        }
        void syncParams.commit();
        syncParams.markReady();
        break;
      }

      case "cell-update": {
        const existing = collection.get(message.rowId);
        if (!existing) break;
        const row = parseSkater({
          ...existing,
          [message.columnId]: message.value,
        });
        if (row) writeSynced([{ type: "update", value: row }]);
        break;
      }

      case "row-add":
      case "rows-add": {
        const raws = message.type === "row-add" ? [message.row] : message.rows;
        const rows = raws.flatMap((raw) => parseSkater(raw) ?? []);
        writeSynced(rows.map(getUpsert));
        break;
      }

      case "rows-delete": {
        writeSynced(
          message.ids
            .filter((id) => collection.has(id))
            .map((key) => ({ type: "delete", key })),
        );
        break;
      }
    }
  }

  return createCollection<SkaterSchema, string>({
    getKey: (row) => row.id,
    startSync: true,
    sync: {
      sync: (params) => {
        syncParams = params;
        const unsubscribe = connection.subscribe(onServerMessage);
        return () => {
          unsubscribe();
          syncParams = null;
        };
      },
    },
    // The room doesn't echo writes back to their sender, so each handler confirms its own change
    onInsert: async ({ transaction }) => {
      const rows = transaction.mutations.map((mutation) => mutation.modified);
      connection.send({ type: "rows-add", rows: rows.map(serializeSkater) });
      writeSynced(rows.map(getUpsert), true);
    },
    onUpdate: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        for (const [columnId, value] of Object.entries(mutation.changes)) {
          connection.send({
            type: "cell-update",
            rowId: mutation.key,
            columnId,
            value: serializeValue(value),
          });
        }
      }
      writeSynced(
        transaction.mutations.map((mutation) => ({
          type: "update",
          value: mutation.modified,
        })),
        true,
      );
    },
    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key);
      connection.send({ type: "rows-delete", ids });
      writeSynced(
        ids.map((key) => ({ type: "delete", key })),
        true,
      );
    },
  });
}

export type SkatersCollection = ReturnType<typeof createSkatersCollection>;
