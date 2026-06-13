// Shared types between PartyKit server and Next.js client.
// No React/Next.js deps — safe for Cloudflare Workers environment.

export interface UserPresence {
  name: string;
  color: string;
  activeCell: { rowId: string | null; columnId: string | null };
}

// Row data as plain JSON (dates serialized to ISO strings)
export type RowPayload = Record<string, unknown>;

// Messages sent CLIENT → SERVER
export type ClientMessage =
  | { type: "cell-update"; rowId: string; columnId: string; value: unknown }
  | { type: "row-add"; row: RowPayload }
  | { type: "rows-add"; rows: RowPayload[] }
  | { type: "rows-delete"; ids: string[] }
  | { type: "active-cell"; rowId: string | null; columnId: string | null };

// Messages sent SERVER → CLIENT
export type ServerMessage =
  | { type: "snapshot"; users: Record<string, UserPresence>; userId: string }
  | { type: "cell-update"; rowId: string; columnId: string; value: unknown; userId: string }
  | { type: "row-add"; row: RowPayload; userId: string }
  | { type: "rows-add"; rows: RowPayload[]; userId: string }
  | { type: "rows-delete"; ids: string[]; userId: string }
  | { type: "active-cell"; userId: string; rowId: string | null; columnId: string | null }
  | { type: "user-join"; userId: string; user: UserPresence }
  | { type: "user-leave"; userId: string };
