import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { type NewSkater, type Skater, skaters } from "@/db/schema";

import type { RowPayload } from "./types";

const DATE_COLUMNS = ["startedSkating", "createdAt", "updatedAt"] as const;

const { id: _id, ...updatableColumns } = getTableColumns(skaters);
const upsertSet = Object.fromEntries(
  Object.entries(updatableColumns).map(([key, column]) => [
    key,
    sql.raw(`excluded."${column.name}"`),
  ]),
);

function toPayload(row: Skater): RowPayload {
  const { roomId: _roomId, ...rest } = row;
  const payload: RowPayload = { ...rest };
  for (const key of DATE_COLUMNS) {
    const value = row[key];
    payload[key] = value instanceof Date ? value.toISOString() : value;
  }
  return payload;
}

function toRecord(roomId: string, payload: RowPayload): NewSkater {
  const record = { ...payload, roomId } as Record<string, unknown>;
  for (const key of DATE_COLUMNS) {
    const value = record[key];
    record[key] = typeof value === "string" ? new Date(value) : value;
  }
  return record as NewSkater;
}

export function createRoomDb(connectionString: string) {
  const db = drizzle(postgres(connectionString, { max: 1 }));

  return {
    async loadRows(roomId: string) {
      const rows = await db
        .select()
        .from(skaters)
        .where(eq(skaters.roomId, roomId))
        .orderBy(skaters.order);
      return rows.map(toPayload);
    },

    async saveRows(
      roomId: string,
      { upserts, deletes }: { upserts: RowPayload[]; deletes: string[] },
    ) {
      await db.transaction(async (tx) => {
        if (deletes.length > 0) {
          await tx
            .delete(skaters)
            .where(
              and(eq(skaters.roomId, roomId), inArray(skaters.id, deletes)),
            );
        }
        if (upserts.length > 0) {
          await tx
            .insert(skaters)
            .values(upserts.map((row) => toRecord(roomId, row)))
            .onConflictDoUpdate({ target: skaters.id, set: upsertSet });
        }
      });
    },

    async replaceRows(roomId: string, rows: RowPayload[]) {
      await db.transaction(async (tx) => {
        await tx.delete(skaters).where(eq(skaters.roomId, roomId));
        if (rows.length > 0) {
          await tx
            .insert(skaters)
            .values(rows.map((row) => toRecord(roomId, row)));
        }
      });
    },
  };
}

export type RoomDb = ReturnType<typeof createRoomDb>;
