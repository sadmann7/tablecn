"use client";

import PartySocket from "partysocket";
import * as React from "react";
import {
  multiplayerCollection,
  remoteIds,
} from "@/app/data-grid-multiplayer/lib/multiplayer-collection";
import { skaterSchema } from "@/app/data-grid-live/lib/validation";
import type { RowPayload, ServerMessage, UserPresence } from "../../party/types";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

const log = (...args: unknown[]) =>
  console.log("[multiplayer]", ...args);

/** Parse a wire row (ISO date strings) back to SkaterSchema (Date objects). */
function parseRow(raw: RowPayload) {
  const result = skaterSchema.safeParse(raw);
  if (result.success) return result.data;
  log("⚠️ Failed to parse row:", raw, result.error.flatten());
  return null;
}

export interface UseMultiplayerRoomReturn {
  isConnected: boolean;
  users: Record<string, UserPresence>;
  currentUserId: string;
  sendCellUpdate: (rowId: string, columnId: string, value: unknown) => void;
  sendRowAdd: (row: RowPayload) => void;
  sendRowsAdd: (rows: RowPayload[]) => void;
  sendRowsDelete: (ids: string[]) => void;
  sendActiveCell: (rowId: string | null, columnId: string | null) => void;
}

export function useMultiplayerRoom(roomId: string): UseMultiplayerRoomReturn {
  const [isConnected, setIsConnected] = React.useState(false);
  const [users, setUsers] = React.useState<Record<string, UserPresence>>({});
  const [currentUserId, setCurrentUserId] = React.useState("");

  const socketRef = React.useRef<PartySocket | null>(null);

  React.useEffect(() => {
    log(`Connecting to room "${roomId}" at ${PARTYKIT_HOST}`);
    const socket = new PartySocket({ host: PARTYKIT_HOST, room: roomId });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      log("Connected");
      setIsConnected(true);
    });

    socket.addEventListener("close", () => {
      log("Disconnected");
      setIsConnected(false);
    });

    socket.addEventListener("message", (evt: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as ServerMessage;
      } catch {
        log("Failed to parse message:", evt.data);
        return;
      }

      log("← received:", msg.type, msg);

      switch (msg.type) {
        case "snapshot": {
          setCurrentUserId(msg.userId);
          setUsers(msg.users);
          log(`Snapshot: ${Object.keys(msg.users).length} user(s) in room`);
          break;
        }

        case "cell-update": {
          log(`Remote cell-update row=${msg.rowId} col=${msg.columnId} val=`, msg.value);
          // Add to remoteIds BEFORE calling update so onUpdate skips Postgres
          remoteIds.add(msg.rowId);
          log("remoteIds after add:", [...remoteIds]);

          multiplayerCollection.update(msg.rowId, (draft) => {
            const key = msg.columnId as keyof typeof draft;
            const raw = msg.value;
            // Re-inflate date strings → Date objects
            if (
              (key === "startedSkating" || key === "createdAt" || key === "updatedAt") &&
              typeof raw === "string"
            ) {
              (draft as Record<string, unknown>)[key] = new Date(raw);
            } else {
              (draft as Record<string, unknown>)[key] = raw;
            }
          });
          break;
        }

        case "row-add": {
          // Full row payload arrives — insert directly without a refetch.
          // This avoids the race condition where Postgres might not have
          // committed yet by the time a plain invalidateQueries fires.
          const row = parseRow(msg.row);
          if (!row) break;

          log("Remote row-add id=", row.id);
          remoteIds.add(row.id);
          log("remoteIds after add:", [...remoteIds]);
          multiplayerCollection.insert(row);
          break;
        }

        case "rows-add": {
          log(`Remote rows-add: ${msg.rows.length} row(s)`);
          for (const rawRow of msg.rows) {
            const row = parseRow(rawRow);
            if (!row) continue;
            remoteIds.add(row.id);
            multiplayerCollection.insert(row);
          }
          log("remoteIds after adds:", [...remoteIds]);
          break;
        }

        case "rows-delete": {
          log("Remote rows-delete ids=", msg.ids);
          for (const id of msg.ids) {
            remoteIds.add(id);
            multiplayerCollection.delete(id);
          }
          log("remoteIds after deletes:", [...remoteIds]);
          break;
        }

        case "active-cell": {
          setUsers((prev) => {
            const user = prev[msg.userId];
            if (!user) return prev;
            return {
              ...prev,
              [msg.userId]: {
                ...user,
                activeCell: { rowId: msg.rowId, columnId: msg.columnId },
              },
            };
          });
          break;
        }

        case "user-join": {
          log(`User joined: ${msg.user.name} (${msg.userId})`);
          setUsers((prev) => ({ ...prev, [msg.userId]: msg.user }));
          break;
        }

        case "user-leave": {
          log(`User left: ${msg.userId}`);
          setUsers((prev) => {
            const next = { ...prev };
            delete next[msg.userId];
            return next;
          });
          break;
        }
      }
    });

    return () => {
      log("Closing socket");
      socket.close();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [roomId]);

  const sendCellUpdate = React.useCallback(
    (rowId: string, columnId: string, value: unknown) => {
      log(`→ cell-update row=${rowId} col=${columnId} val=`, value);
      socketRef.current?.send(
        JSON.stringify({ type: "cell-update", rowId, columnId, value }),
      );
    },
    [],
  );

  // Sends the full serialized row so receivers can insert without a refetch
  const sendRowAdd = React.useCallback((row: RowPayload) => {
    log("→ row-add id=", row.id);
    socketRef.current?.send(JSON.stringify({ type: "row-add", row }));
  }, []);

  const sendRowsAdd = React.useCallback((rows: RowPayload[]) => {
    log(`→ rows-add: ${rows.length} row(s)`);
    socketRef.current?.send(JSON.stringify({ type: "rows-add", rows }));
  }, []);

  const sendRowsDelete = React.useCallback((ids: string[]) => {
    log("→ rows-delete ids=", ids);
    socketRef.current?.send(JSON.stringify({ type: "rows-delete", ids }));
  }, []);

  const sendActiveCell = React.useCallback(
    (rowId: string | null, columnId: string | null) => {
      socketRef.current?.send(
        JSON.stringify({ type: "active-cell", rowId, columnId }),
      );
    },
    [],
  );

  return {
    isConnected,
    users,
    currentUserId,
    sendCellUpdate,
    sendRowAdd,
    sendRowsAdd,
    sendRowsDelete,
    sendActiveCell,
  };
}
