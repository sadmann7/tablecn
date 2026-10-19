import type {
  CellUpdate,
  ClientMessage,
  RowChange,
  RowPayload,
  ServerMessage,
} from "@party/types";
import type {
  ChangeMessageOrDeleteKeyMessage,
  SyncConfig,
} from "@tanstack/react-db";

import { createCollection } from "@tanstack/react-db";
import { toast } from "sonner";

import {
  type SkaterSchema,
  skaterSchema,
} from "@/app/data-grid-multiplayer/lib/validation";
import { generateId } from "@/lib/id";

const ACK_TIMEOUT_MS = 30_000;

type SyncParams = Parameters<SyncConfig<SkaterSchema, string>["sync"]>[0];
type SkaterChange = ChangeMessageOrDeleteKeyMessage<SkaterSchema, string>;
type MutationMessage = Extract<ClientMessage, { mutationId: string }>;

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
  const pendingAcks = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();

  function writeSynced(changes: SkaterChange[], immediate = false) {
    if (!syncParams || changes.length === 0) return;
    syncParams.begin({ immediate });
    for (const change of changes) syncParams.write(change);
    void syncParams.commit();
  }

  // Partial, so a confirmed or remote edit only touches the fields it changed
  function getCellChanges(updates: CellUpdate[]): SkaterChange[] {
    const byRow = new Map<string, Record<string, unknown>>();
    for (const { rowId, columnId, value } of updates) {
      const changes = byRow.get(rowId) ?? {};
      changes[columnId] = value;
      byRow.set(rowId, changes);
    }

    return [...byRow].flatMap(([rowId, changes]) => {
      const existing = syncParams?.collection.get(rowId);
      if (!existing) return [];
      const parsed = parseSkater({ ...serializeSkater(existing), ...changes });
      if (!parsed) return [];
      const value = { id: rowId } as Partial<SkaterSchema>;
      for (const key of Object.keys(changes) as Array<keyof SkaterSchema>) {
        Object.assign(value, { [key]: parsed[key] });
      }
      return [{ type: "update", value: value as SkaterSchema }];
    });
  }

  // `has()` also sees pending local edits, so confirmed own changes skip it
  function getRowChanges(change: RowChange, isOwn = false): SkaterChange[] {
    const collection = syncParams?.collection;
    switch (change.type) {
      case "cells-update":
        return getCellChanges(change.updates);
      case "rows-add":
        return change.rows.flatMap((raw): SkaterChange[] => {
          const row = parseSkater(raw);
          if (!row) return [];
          const type = !isOwn && collection?.has(row.id) ? "update" : "insert";
          return [{ type, value: row }];
        });
      case "rows-delete":
        return change.ids
          .filter((id) => isOwn || collection?.has(id))
          .map((key) => ({ type: "delete", key }));
    }
  }

  // Resolves on the room's ack; a reject or timeout throws so the collection rolls the edit back
  async function sendMutation(change: RowChange) {
    const mutationId = generateId();
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingAcks.delete(mutationId);
          reject(new Error("The room didn't confirm your change"));
        }, ACK_TIMEOUT_MS);

        pendingAcks.set(mutationId, {
          resolve: () => {
            clearTimeout(timeout);
            resolve();
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
        connection.send({ ...change, mutationId } as MutationMessage);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
    writeSynced(getRowChanges(change, true), true);
  }

  function onServerMessage(message: ServerMessage) {
    switch (message.type) {
      case "ack": {
        pendingAcks.get(message.mutationId)?.resolve();
        pendingAcks.delete(message.mutationId);
        return;
      }

      case "reject": {
        pendingAcks.get(message.mutationId)?.reject(new Error(message.reason));
        pendingAcks.delete(message.mutationId);
        return;
      }
    }

    if (!syncParams) return;

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

      case "catch-up": {
        for (const change of message.changes) {
          writeSynced(getRowChanges(change));
        }
        syncParams.markReady();
        break;
      }

      case "cells-update":
      case "rows-add":
      case "rows-delete": {
        writeSynced(getRowChanges(message));
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
    onInsert: async ({ transaction }) => {
      await sendMutation({
        type: "rows-add",
        rows: transaction.mutations.map((mutation) =>
          serializeSkater(mutation.modified),
        ),
      });
    },
    onUpdate: async ({ transaction }) => {
      await sendMutation({
        type: "cells-update",
        updates: transaction.mutations.flatMap((mutation) =>
          Object.entries(mutation.changes).map(([columnId, value]) => ({
            rowId: mutation.key,
            columnId,
            value: serializeValue(value),
          })),
        ),
      });
    },
    onDelete: async ({ transaction }) => {
      await sendMutation({
        type: "rows-delete",
        ids: transaction.mutations.map((mutation) => mutation.key),
      });
    },
  });
}

export type SkatersCollection = ReturnType<typeof createSkatersCollection>;
