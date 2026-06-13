// PartyKit server — in-memory source of truth for the multiplayer demo.
// Each room starts with seed data and holds all mutations in memory.
// Data is ephemeral: cleared when the last user leaves (Durable Object hibernates).

import type * as Party from "partykit/server";
import { seedRows } from "./seeds";
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

  onConnect(conn: Party.Connection) {
    // Seed with data on first connection
    if (this.state.rows.length === 0) {
      this.state.rows = [...seedRows];
    }

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
