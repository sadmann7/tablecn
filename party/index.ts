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
import { createRoomDb, type RoomDb } from "./db";
import { createSeedRows } from "./seeds";

const RESET_DELAY = 10 * 60 * 1000;
const PERSIST_DELAY = 500;

interface Env {
  Main: DurableObjectNamespace<SkaterRoom>;
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
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
  private db: RoomDb | null = null;
  private isLoaded = false;
  private dirtyIds = new Set<string>();
  private deletedIds = new Set<string>();
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Promise<void> = Promise.resolve();

  private getDb() {
    const connectionString =
      this.env.HYPERDRIVE?.connectionString ?? this.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Set DATABASE_URL or a HYPERDRIVE binding");
    }
    this.db ??= createRoomDb(connectionString);
    return this.db;
  }

  async onStart() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.isLoaded) return;

    const rows = await this.getDb().loadRows(this.name);
    if (rows.length > 0) {
      this.rows = rows;
    } else {
      this.rows = createSeedRows();
      await this.getDb().replaceRows(this.name, this.rows);
    }
    this.isLoaded = true;
  }

  private persistRows({
    upserts = [],
    deletes = [],
  }: {
    upserts?: string[];
    deletes?: string[];
  }) {
    for (const id of upserts) this.dirtyIds.add(id);
    for (const id of deletes) {
      this.dirtyIds.delete(id);
      this.deletedIds.add(id);
    }
    if (this.persistTimeout) return;

    this.persistTimeout = setTimeout(() => {
      this.persistTimeout = null;
      void this.flushRows();
    }, PERSIST_DELAY);
  }

  // Saves run one after another, so a delete can't land before the insert it follows
  private flushRows() {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }

    const dirtyIds = this.dirtyIds;
    const deletes = [...this.deletedIds];
    this.dirtyIds = new Set();
    this.deletedIds = new Set();
    const upserts = this.rows.filter((row) => dirtyIds.has(row.id as string));
    if (upserts.length === 0 && deletes.length === 0) return this.pendingSave;

    this.pendingSave = this.pendingSave.then(() =>
      this.getDb()
        .saveRows(this.name, { upserts, deletes })
        .catch((error: unknown) => {
          console.error("[party] Failed to save rows:", error);
          // Retried with the next change
          for (const row of upserts) this.dirtyIds.add(row.id as string);
          for (const id of deletes) this.deletedIds.add(id);
        }),
    );
    return this.pendingSave;
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

    await this.flushRows();
    if (this.name === PUBLIC_ROOM_ID) {
      this.rows = createSeedRows();
      await this.getDb().replaceRows(this.name, this.rows);
    } else {
      // Private rooms are seeded again only if someone comes back
      this.rows = [];
      this.isLoaded = false;
      await this.getDb().replaceRows(this.name, []);
    }
  }

  async onConnect(connection: PresenceConnection, ctx: ConnectionContext) {
    void this.ctx.storage.deleteAlarm();
    await this.ensureLoaded();

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
      void this.flushRows();
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
        this.persistRows({ upserts: [msg.row.id as string] });
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
        this.persistRows({ upserts: msg.rows.map((row) => row.id as string) });
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
        if (!row) break;
        row[msg.columnId] = msg.value;
        this.persistRows({ upserts: [msg.rowId] });
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
        this.persistRows({ deletes: msg.ids });
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
