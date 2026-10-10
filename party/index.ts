import {
  type Connection,
  type ConnectionContext,
  routePartykitRequest,
  Server,
  type WSMessage,
} from "partyserver";

import type {
  ClientMessage,
  RowPayload,
  ServerMessage,
  UserPresence,
} from "./types";

import { ADJECTIVES, ANIMALS, COLORS } from "./constants";
import { seedRows } from "./seeds";

const RESET_DELAY = 10 * 60 * 1000;

interface Env {
  Main: DurableObjectNamespace<SkaterRoom>;
}

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

export class SkaterRoom extends Server<Env> {
  state: RoomState = { users: {}, usedColors: [], rows: [] };
  // Users are keyed by clientId so a browser's tabs show up as one person
  private connectionIdsByUserId = new Map<string, Set<string>>();
  private userIdByConnectionId = new Map<string, string>();

  private getUserId(conn: Connection) {
    return this.userIdByConnectionId.get(conn.id) ?? conn.id;
  }

  // Runs before any connection is accepted — the room waits for this to complete.
  async onStart() {
    const stored = await this.ctx.storage.get<RowPayload[]>("rows");
    if (Array.isArray(stored) && stored.length > 0) {
      this.state.rows = stored;
    } else {
      this.state.rows = structuredClone(seedRows);
      await this.ctx.storage.put("rows", this.state.rows);
    }
  }

  // Surface storage write failures rather than silently swallowing them.
  private persistRows() {
    this.ctx.storage
      .put("rows", this.state.rows)
      .catch((err) => console.error("[party] Failed to persist rows:", err));
  }

  async onAlarm() {
    if (Object.keys(this.state.users).length > 0) return;

    await this.ctx.storage.delete("rows");
    this.state.rows = structuredClone(seedRows);
  }

  onConnect(conn: Connection, ctx: ConnectionContext) {
    void this.ctx.storage.deleteAlarm();

    const url = new URL(ctx.request.url);
    // Older clients don't send a clientId, so each of their connections stays its own user
    const userId = url.searchParams.get("clientId") ?? conn.id;
    this.userIdByConnectionId.set(conn.id, userId);
    const connectionIds = this.connectionIdsByUserId.get(userId) ?? new Set();
    connectionIds.add(conn.id);
    this.connectionIdsByUserId.set(userId, connectionIds);

    let user = this.state.users[userId];
    const isNewUser = !user;
    if (!user) {
      const name = url.searchParams.get("name") ?? generateUserName();
      const color =
        url.searchParams.get("color") ?? pickColor(this.state.usedColors);
      if (!this.state.usedColors.includes(color))
        this.state.usedColors.push(color);

      user = { name, color, activeCell: { rowId: null, columnId: null } };
      this.state.users[userId] = user;
    }

    const snapshot: ServerMessage = {
      type: "snapshot",
      users: this.state.users,
      userId,
      rows: this.state.rows,
    };
    conn.send(JSON.stringify(snapshot));

    if (isNewUser) {
      const joinMsg: ServerMessage = { type: "user-join", userId, user };
      this.broadcast(JSON.stringify(joinMsg), [conn.id]);
    }
  }

  onClose(conn: Connection) {
    const userId = this.getUserId(conn);
    this.userIdByConnectionId.delete(conn.id);

    const connectionIds = this.connectionIdsByUserId.get(userId);
    connectionIds?.delete(conn.id);
    // The user stays while any of their tabs is still connected
    if (connectionIds && connectionIds.size > 0) return;
    this.connectionIdsByUserId.delete(userId);

    const user = this.state.users[userId];
    if (user) {
      this.state.usedColors = this.state.usedColors.filter(
        (c) => c !== user.color,
      );
    }
    delete this.state.users[userId];

    const leaveMsg: ServerMessage = { type: "user-leave", userId };
    this.broadcast(JSON.stringify(leaveMsg));

    if (Object.keys(this.state.users).length === 0) {
      void this.ctx.storage.setAlarm(Date.now() + RESET_DELAY);
    }
  }

  onMessage(sender: Connection, message: WSMessage) {
    if (typeof message !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    const userId = this.getUserId(sender);

    switch (msg.type) {
      case "row-add": {
        this.state.rows.push(msg.row);
        this.persistRows();
        this.broadcast(
          JSON.stringify({
            type: "row-add",
            row: msg.row,
            userId,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "rows-add": {
        this.state.rows.push(...msg.rows);
        this.persistRows();
        this.broadcast(
          JSON.stringify({
            type: "rows-add",
            rows: msg.rows,
            userId,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "cell-update": {
        const row = this.state.rows.find((r) => r.id === msg.rowId);
        if (row) row[msg.columnId] = msg.value;
        this.persistRows();
        this.broadcast(
          JSON.stringify({
            type: "cell-update",
            rowId: msg.rowId,
            columnId: msg.columnId,
            value: msg.value,
            userId,
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
        this.broadcast(
          JSON.stringify({
            type: "rows-delete",
            ids: msg.ids,
            userId,
          } satisfies ServerMessage),
          [sender.id],
        );
        break;
      }

      case "active-cell": {
        const user = this.state.users[userId];
        if (user)
          user.activeCell = { rowId: msg.rowId, columnId: msg.columnId };
        this.broadcast(
          JSON.stringify({
            type: "active-cell",
            userId,
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

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
