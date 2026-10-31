import {
  type Connection,
  type ConnectionContext,
  routePartykitRequest,
  Server,
  type WSMessage,
} from "partyserver";

import { skaterSchema } from "@/app/data-grid-multiplayer/lib/validation";

import type {
  CellUpdate,
  ClientMessage,
  RowChange,
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
import { createSeedRows } from "./seeds";

const RESET_DELAY = 10 * 60 * 1000;
const PERSIST_DELAY = 500;
const ROWS_KEY = "skaters";

interface Env {
  Main: DurableObjectNamespace<SkaterRoom>;
}

interface PresenceState {
  userId: string;
  user: UserPresence;
}

type PresenceConnection = Connection<PresenceState>;

export class SkaterRoom extends Server<Env> {
  static options = { hibernate: true };

  rows: RowPayload[] = [];
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;

  async onStart() {
    const stored = await this.ctx.storage.get<RowPayload[]>(ROWS_KEY);
    if (Array.isArray(stored) && stored.length > 0) {
      this.rows = stored;
    } else {
      this.rows = createSeedRows();
      await this.ctx.storage.put(ROWS_KEY, this.rows);
    }
  }

  private persistRows() {
    if (this.persistTimeout) return;

    this.persistTimeout = setTimeout(() => {
      this.persistTimeout = null;
      this.ctx.storage
        .put(ROWS_KEY, this.rows)
        .catch((error) =>
          console.error("[party] Failed to persist rows:", error),
        );
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
    this.rows = createSeedRows();
    if (this.name === PUBLIC_ROOM_ID) {
      await this.ctx.storage.delete(ROWS_KEY);
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

    connection.send(
      JSON.stringify({
        type: "snapshot",
        users,
        userId,
        rows: this.rows,
      } satisfies ServerMessage),
    );

    if (isNewUser) {
      const joinMsg: ServerMessage = { type: "user-join", userId, user };
      this.broadcast(JSON.stringify(joinMsg), [connection.id]);
    }
  }

  private commitChange(
    sender: PresenceConnection,
    mutationId: string,
    change: RowChange,
  ) {
    this.broadcast(
      JSON.stringify({
        ...change,
        userId: this.getUserId(sender),
      } satisfies ServerMessage),
      [sender.id],
    );
    this.ack(sender, mutationId);
  }

  private ack(sender: PresenceConnection, mutationId: string) {
    sender.send(
      JSON.stringify({ type: "ack", mutationId } satisfies ServerMessage),
    );
  }

  private reject(
    sender: PresenceConnection,
    mutationId: string,
    reason: string,
  ) {
    sender.send(
      JSON.stringify({
        type: "reject",
        mutationId,
        reason,
      } satisfies ServerMessage),
    );
  }

  private getInvalidUpdate(updates: CellUpdate[]) {
    for (const update of updates) {
      const row = this.rows.find((r) => r.id === update.rowId);
      if (!row) return "The row was deleted";
      if (
        update.columnId === "id" ||
        !(update.columnId in skaterSchema.shape)
      ) {
        return `Unknown column ${update.columnId}`;
      }
      const merged = { ...row, [update.columnId]: update.value };
      if (!skaterSchema.safeParse(merged).success) {
        return `Invalid value for ${update.columnId}`;
      }
    }
    return null;
  }

  private getInvalidRows(rows: RowPayload[]) {
    for (const row of rows) {
      if (!skaterSchema.safeParse(row).success) return "Invalid row";
    }
    return null;
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
      case "cells-update": {
        const invalid = this.getInvalidUpdate(msg.updates);
        if (invalid) {
          this.reject(sender, msg.mutationId, invalid);
          break;
        }
        for (const update of msg.updates) {
          const row = this.rows.find((r) => r.id === update.rowId);
          if (row) row[update.columnId] = update.value;
        }
        this.persistRows();
        this.commitChange(sender, msg.mutationId, {
          type: "cells-update",
          updates: msg.updates,
        });
        break;
      }

      case "rows-add": {
        const existingIds = new Set(this.rows.map((r) => r.id));
        const newRows = msg.rows.filter((row) => !existingIds.has(row.id));
        if (newRows.length === 0) {
          this.ack(sender, msg.mutationId);
          break;
        }
        const invalid = this.getInvalidRows(newRows);
        if (invalid) {
          this.reject(sender, msg.mutationId, invalid);
          break;
        }
        this.rows.push(...newRows);
        this.persistRows();
        this.commitChange(sender, msg.mutationId, {
          type: "rows-add",
          rows: newRows,
        });
        break;
      }

      case "rows-delete": {
        const ids = new Set(msg.ids);
        this.rows = this.rows.filter((r) => !ids.has(r.id as string));
        this.persistRows();
        this.commitChange(sender, msg.mutationId, {
          type: "rows-delete",
          ids: msg.ids,
        });
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

function getIsValidRoom(request: Request) {
  const room = new URL(request.url).pathname.split("/")[3];
  return (
    room === undefined ||
    room === PUBLIC_ROOM_ID ||
    PRIVATE_ROOM_ID_PATTERN.test(room)
  );
}
