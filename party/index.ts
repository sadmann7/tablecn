// PartyKit server — presence-only broadcast layer.
// Postgres (via Next.js API) is the source of truth for row data.
// This server only tracks who is in the room and relays patches between clients.

import type * as Party from "partykit/server";
import type {
  ClientMessage,
  RowPayload,
  ServerMessage,
  UserPresence,
} from "./types";

const ADJECTIVES = [
  "Swift",
  "Bold",
  "Calm",
  "Daring",
  "Eager",
  "Fierce",
  "Gentle",
  "Happy",
  "Icy",
  "Jolly",
  "Kind",
  "Lively",
  "Merry",
  "Noble",
  "Odd",
  "Proud",
  "Quiet",
  "Rapid",
  "Silly",
  "Tiny",
];

const ANIMALS = [
  "Badger",
  "Bear",
  "Crane",
  "Deer",
  "Eagle",
  "Fox",
  "Goat",
  "Hawk",
  "Ibis",
  "Jay",
  "Kite",
  "Lamb",
  "Mink",
  "Newt",
  "Otter",
  "Puma",
  "Quail",
  "Raven",
  "Seal",
  "Tiger",
];

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
];

interface RoomState {
  users: Record<string, UserPresence>;
  usedColors: string[];
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
  state: RoomState = { users: {}, usedColors: [] };

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    const color = pickColor(this.state.usedColors);
    this.state.usedColors.push(color);

    const user: UserPresence = {
      name: generateUserName(),
      color,
      activeCell: { rowId: null, columnId: null },
    };
    this.state.users[conn.id] = user;

    const snapshot: ServerMessage = {
      type: "snapshot",
      users: this.state.users,
      userId: conn.id,
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
      case "cell-update": {
        const out: ServerMessage = {
          type: "cell-update",
          rowId: msg.rowId,
          columnId: msg.columnId,
          value: msg.value,
          userId: sender.id,
        };
        this.room.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }

      case "row-add": {
        // Forward the full row payload so receivers can insert directly
        // without a refetch (avoids race conditions with Postgres writes).
        const out: ServerMessage = {
          type: "row-add",
          row: msg.row as RowPayload,
          userId: sender.id,
        };
        this.room.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }

      case "rows-add": {
        const out: ServerMessage = {
          type: "rows-add",
          rows: msg.rows as RowPayload[],
          userId: sender.id,
        };
        this.room.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }

      case "rows-delete": {
        const out: ServerMessage = {
          type: "rows-delete",
          ids: msg.ids,
          userId: sender.id,
        };
        this.room.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }

      case "active-cell": {
        const user = this.state.users[sender.id];
        if (user) {
          user.activeCell = { rowId: msg.rowId, columnId: msg.columnId };
        }
        const out: ServerMessage = {
          type: "active-cell",
          userId: sender.id,
          rowId: msg.rowId,
          columnId: msg.columnId,
        };
        this.room.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }
    }
  }
}
