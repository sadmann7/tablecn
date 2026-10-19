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
  SequencedChange,
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
const CHANGE_LOG_SIZE = 500;

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
  // A new epoch tells reconnecting clients their seq is from a room that restarted or reset
  private epoch = crypto.randomUUID();
  private seq = 0;
  private changeLog: SequencedChange[] = [];
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
    this.epoch = crypto.randomUUID();
    this.changeLog = [];
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

    connection.send(
      JSON.stringify(
        this.getCatchUp(url, users, userId) ?? {
          type: "snapshot",
          users,
          userId,
          rows: this.rows,
          epoch: this.epoch,
          seq: this.seq,
        },
      ),
    );

    if (isNewUser) {
      const joinMsg: ServerMessage = { type: "user-join", userId, user };
      this.broadcast(JSON.stringify(joinMsg), [connection.id]);
    }
  }

  private getCatchUp(
    url: URL,
    users: Record<string, UserPresence>,
    userId: string,
  ): ServerMessage | null {
    const lastSeq = Number(url.searchParams.get("seq"));
    if (url.searchParams.get("epoch") !== this.epoch) return null;
    if (!Number.isInteger(lastSeq) || lastSeq > this.seq) return null;

    const oldestSeq = this.changeLog[0]?.seq ?? this.seq + 1;
    if (lastSeq < oldestSeq - 1) return null;

    return {
      type: "catch-up",
      users,
      userId,
      changes: this.changeLog.filter((change) => change.seq > lastSeq),
      epoch: this.epoch,
      seq: this.seq,
    };
  }

  private commitChange(
    sender: PresenceConnection,
    mutationId: string,
    change: RowChange,
  ) {
    this.seq += 1;
    const sequenced: SequencedChange = {
      ...change,
      seq: this.seq,
      userId: this.getUserId(sender),
    };
    this.changeLog.push(sequenced);
    if (this.changeLog.length > CHANGE_LOG_SIZE) this.changeLog.shift();

    this.broadcast(JSON.stringify(sequenced), [sender.id]);
    sender.send(
      JSON.stringify({
        type: "ack",
        mutationId,
        seq: this.seq,
      } satisfies ServerMessage),
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
      if (this.rows.some((r) => r.id === row.id))
        return "The row already exists";
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
        this.persistRows({
          upserts: msg.updates.map((update) => update.rowId),
        });
        this.commitChange(sender, msg.mutationId, {
          type: "cells-update",
          updates: msg.updates,
        });
        break;
      }

      case "rows-add": {
        const invalid = this.getInvalidRows(msg.rows);
        if (invalid) {
          this.reject(sender, msg.mutationId, invalid);
          break;
        }
        this.rows.push(...msg.rows);
        this.persistRows({ upserts: msg.rows.map((row) => row.id as string) });
        this.commitChange(sender, msg.mutationId, {
          type: "rows-add",
          rows: msg.rows,
        });
        break;
      }

      case "rows-delete": {
        const ids = new Set(msg.ids);
        this.rows = this.rows.filter((r) => !ids.has(r.id as string));
        this.persistRows({ deletes: msg.ids });
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
