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

import {
  ADJECTIVES,
  ANIMALS,
  COLORS,
  PRIVATE_ROOM_ID_PATTERN,
  PUBLIC_ROOM_ID,
} from "./constants";
import { seedRows } from "./seeds";

const RESET_DELAY = 10 * 60 * 1000;
const PERSIST_DELAY = 500;

interface Env {
  Main: DurableObjectNamespace<SkaterRoom>;
}

interface PresenceState {
  userId: string;
  user: UserPresence;
}

type PresenceConnection = Connection<PresenceState>;

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
  static options = { hibernate: true };

  rows: RowPayload[] = [];
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;

  async onStart() {
    const stored = await this.ctx.storage.get<RowPayload[]>("rows");
    if (Array.isArray(stored) && stored.length > 0) {
      this.rows = stored;
    } else {
      this.rows = structuredClone(seedRows);
      await this.ctx.storage.put("rows", this.rows);
    }
  }

  private persistRows() {
    if (this.persistTimeout) return;

    this.persistTimeout = setTimeout(() => {
      this.persistTimeout = null;
      this.ctx.storage
        .put("rows", this.rows)
        .catch((err) => console.error("[party] Failed to persist rows:", err));
    }, PERSIST_DELAY);
  }

  private getUserId(connection: PresenceConnection) {
    return connection.state?.userId ?? connection.id;
  }

  private getUsers(excludeConnectionId?: string) {
    const users: Record<string, UserPresence> = {};
    for (const connection of this.getConnections<PresenceState>()) {
      if (connection.id === excludeConnectionId || !connection.state) continue;
      users[connection.state.userId] ??= structuredClone(
        connection.state.user,
      ) as UserPresence;
    }
    return users;
  }

  getConnectionTags(_connection: Connection, ctx: ConnectionContext) {
    const userId = new URL(ctx.request.url).searchParams.get("clientId");
    return userId ? [userId] : [];
  }

  async onAlarm() {
    if (Object.keys(this.getUsers()).length > 0) return;

    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    this.rows = structuredClone(seedRows);
    if (this.name === PUBLIC_ROOM_ID) {
      await this.ctx.storage.delete("rows");
    } else {
      await this.ctx.storage.deleteAll();
    }
  }

  onConnect(connection: PresenceConnection, ctx: ConnectionContext) {
    void this.ctx.storage.deleteAlarm();

    const url = new URL(ctx.request.url);
    const userId = url.searchParams.get("clientId") ?? connection.id;
    const users = this.getUsers(connection.id);

    let user = users[userId];
    const isNewUser = !user;
    if (!user) {
      const name = url.searchParams.get("name") ?? generateUserName();
      const usedColors = Object.values(users).map((u) => u.color);
      const color = url.searchParams.get("color") ?? pickColor(usedColors);
      user = { name, color, activeCell: { rowId: null, columnId: null } };
      users[userId] = user;
    }
    connection.setState({ userId, user });

    const snapshot: ServerMessage = {
      type: "snapshot",
      users,
      userId,
      rows: this.rows,
    };
    connection.send(JSON.stringify(snapshot));

    if (isNewUser) {
      const joinMsg: ServerMessage = { type: "user-join", userId, user };
      this.broadcast(JSON.stringify(joinMsg), [connection.id]);
    }
  }

  onClose(connection: PresenceConnection) {
    const userId = this.getUserId(connection);
    const users = this.getUsers(connection.id);
    // The user stays while any of their tabs is still connected
    if (users[userId]) return;

    const leaveMsg: ServerMessage = { type: "user-leave", userId };
    this.broadcast(JSON.stringify(leaveMsg), [connection.id]);

    if (Object.keys(users).length === 0) {
      void this.ctx.storage.setAlarm(Date.now() + RESET_DELAY);
    }
  }

  onMessage(sender: PresenceConnection, message: WSMessage) {
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
        this.rows.push(msg.row);
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
        this.rows.push(...msg.rows);
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
        const row = this.rows.find((r) => r.id === msg.rowId);
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
        this.rows = this.rows.filter((r) => !msg.ids.includes(r.id as string));
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
        const activeCell = { rowId: msg.rowId, columnId: msg.columnId };
        for (const connection of this.getConnections<PresenceState>(userId)) {
          const state = connection.state;
          if (!state) continue;
          connection.setState({
            userId: state.userId,
            user: { ...(state.user as UserPresence), activeCell },
          });
        }
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

function getIsValidRoom(request: Request) {
  const room = new URL(request.url).pathname.split("/")[3];
  return (
    room === undefined ||
    room === PUBLIC_ROOM_ID ||
    PRIVATE_ROOM_ID_PATTERN.test(room)
  );
}

export default {
  async fetch(request, env) {
    if (!getIsValidRoom(request)) {
      return new Response("Not found", { status: 404 });
    }

    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
