// Shared with the Cloudflare Worker, so this file must not import React or Next.js.

export interface UserPresence {
  name: string;
  color: string;
  activeCell: { rowId: string | null; columnId: string | null };
}

export type RowPayload = Record<string, unknown>;

export interface CellUpdate {
  rowId: string;
  columnId: string;
  value: unknown;
}

export type ClientMessage =
  | { type: "cells-update"; mutationId: string; updates: CellUpdate[] }
  | { type: "rows-add"; mutationId: string; rows: RowPayload[] }
  | { type: "rows-delete"; mutationId: string; ids: string[] }
  | { type: "active-cell"; rowId: string | null; columnId: string | null };

export type RowChange =
  | { type: "cells-update"; updates: CellUpdate[] }
  | { type: "rows-add"; rows: RowPayload[] }
  | { type: "rows-delete"; ids: string[] };

export type ServerMessage =
  | {
      type: "snapshot";
      users: Record<string, UserPresence>;
      userId: string;
      rows: RowPayload[];
    }
  | (RowChange & { userId: string })
  | { type: "ack"; mutationId: string }
  | { type: "reject"; mutationId: string; reason: string }
  | {
      type: "active-cell";
      userId: string;
      rowId: string | null;
      columnId: string | null;
    }
  | { type: "user-join"; userId: string; user: UserPresence }
  | { type: "user-leave"; userId: string };
