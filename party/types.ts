/**
 * Shared types between PartyKit server and Next.js client.
 * No React/Next.js deps; safe for Cloudflare Workers environment.
 */

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

// Every row change gets the room's next seq, so a reconnecting client can ask for what it missed
export type SequencedChange = RowChange & { seq: number; userId: string };

export type ServerMessage =
  | {
      type: "snapshot";
      users: Record<string, UserPresence>;
      userId: string;
      rows: RowPayload[];
      epoch: string;
      seq: number;
    }
  | {
      type: "catch-up";
      users: Record<string, UserPresence>;
      userId: string;
      changes: SequencedChange[];
      epoch: string;
      seq: number;
    }
  | SequencedChange
  | { type: "ack"; mutationId: string; seq: number }
  | { type: "reject"; mutationId: string; reason: string }
  | {
      type: "active-cell";
      userId: string;
      rowId: string | null;
      columnId: string | null;
    }
  | { type: "user-join"; userId: string; user: UserPresence }
  | { type: "user-leave"; userId: string };
