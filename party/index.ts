// PartyKit server is the source of truth for the multiplayer demo.
// Rows are persisted in Durable Object storage so data survives hibernation.
// Each room seeds from party/seeds.ts on first use and stores mutations from there.

import type * as Party from "partykit/server";
import { ADJECTIVES, ANIMALS, COLORS } from "./constants";
import { seedRows } from "./seeds";
import type {
  ClientMessage,
  RowPayload,
  ServerMessage,
  UserPresence,
} from "./types";

interface RoomState {
  users: Record<string, UserPresence>;
  usedColors: string[];
  rows: RowPayload[];
}

function generateUserName(): string {
  const adj =
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? "Swift";
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] ?? "Fox";
  return `${adj} ${animal}`;
}

function pickColor(usedColors: string[]): string {
  const available = COLORS.filter((c) => !usedColors.includes(c));
  const pool = available.length > 0 ? available : COLORS;
  return pool[Math.floor(Math.random() * pool.length)] ?? COLORS[0] ?? "";
}

export default class SkaterRoom implements Party.Server {
  state: RoomState = { users: {}, usedColors: [], rows: [] };

  constructor(readonly room: Party.Room) {}

  // Runs before any connection is accepted — the room waits for this to complete.
  async onStart() {
    const stored = await this.room.storage.get<RowPayload[]>("rows");
    if (Array.isArray(stored) && stored.length > 0) {
      this.state.rows = stored;
    } else {
      // Deep-clone so per-room mutations never bleed into the shared module-level array.
      // Persist immediately so a hibernation before any mutation doesn't re-seed with new IDs.
      this.state.rows = structuredClone(seedRows);
      await this.room.storage.put("rows", this.state.rows);
    }
  }

  // Surface storage write failures rather than silently swallowing them.
  private persistRows() {
    this.room.storage
      .put("rows", this.state.rows)
      .catch((err) => console.error("[party] Failed to persist rows:", err));
  }

  onConnect(conn: Party.Connection) {
    const url = new URL(conn.uri);
    const name = url.searchParams.get("name") ?? generateUserName();
    const color = url.searchParams.get("color") ?? pickColor(this.state.usedColors);
    if (!this.state.usedColors.includes(color)) this.state.usedColors.push(color);

    const user: UserPresence = {
      name,
      color,
      activeCell: { rowId: null, columnId: null },
    };
    this.state.users[conn.id] = user;

    const snapshot: ServerMessage = {
      type: "snapshot",
      users: this.state.users,
      userId: conn.id,
      rows: this.state.rows,
    };
    conn.send(JSON.stringify(snapshot));

    const joinMsg: ServerMessage = { type: "user-join", userId: conn.id, user };
    this.room.broadcast(JSON.stringify(joinMsg), [conn.id]);
  }

  onClose(conn: Party.Connection) {
    const user = this.state.users[conn.id];
    if (user) {
      this.state.usedColors = this.state.usedColors.filter(
        (c) => c !== user.color,
      );
    }
    delete this.state.users[conn.id];

    const leaveMsg: ServerMessage = { type: "user-leave", userId: conn.id };
    this.room.broadcast(JSON.stringify(leaveMsg));
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "row-add": {
        this.state.rows.push(msg.row);
        this.persistRows();
        this.room.broadcast(
          JSON.stringify({
            type: "row-add",
            row: msg.row,
            userId: sender.id,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "rows-add": {
        this.state.rows.push(...msg.rows);
        this.persistRows();
        this.room.broadcast(
          JSON.stringify({
            type: "rows-add",
            rows: msg.rows,
            userId: sender.id,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "cell-update": {
        const row = this.state.rows.find((r) => r.id === msg.rowId);
        if (row) row[msg.columnId] = msg.value;
        this.persistRows();
        this.room.broadcast(
          JSON.stringify({
            type: "cell-update",
            rowId: msg.rowId,
            columnId: msg.columnId,
            value: msg.value,
            userId: sender.id,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "rows-delete": {
        this.state.rows = this.state.rows.filter(
          (r) => !msg.ids.includes(r.id as string),
        );
        this.persistRows();
        this.room.broadcast(
          JSON.stringify({
            type: "rows-delete",
            ids: msg.ids,
            userId: sender.id,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "active-cell": {
        const user = this.state.users[sender.id];
        if (user)
          user.activeCell = { rowId: msg.rowId, columnId: msg.columnId };
        this.room.broadcast(
          JSON.stringify({
            type: "active-cell",
            userId: sender.id,
            rowId: msg.rowId,
            columnId: msg.columnId,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }
    }
  }
}
