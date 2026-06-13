"use client";

import type { RowPayload, ServerMessage, UserPresence } from "@party/types";
import PartySocket from "partysocket";
import * as React from "react";
import { skaterSchema } from "@/app/data-grid-live/lib/validation";
import { multiplayerCollection } from "@/app/data-grid-multiplayer/lib/multiplayer-collection";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

const log = (...args: unknown[]) => console.log("[multiplayer]", ...args);

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

    // Track all IDs inserted this session so we can clean up on unmount / room change
    const knownIds = new Set<string>();

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
          // Populate collection with server's current rows
          for (const raw of msg.rows) {
            const row = parseRow(raw);
            if (row) {
              multiplayerCollection.insert(row);
              knownIds.add(row.id);
            }
          }
          log(
            `Snapshot: ${Object.keys(msg.users).length} user(s), ${msg.rows.length} row(s)`,
          );
          break;
        }

        case "cell-update": {
          multiplayerCollection.update(msg.rowId, (draft) => {
            const key = msg.columnId as keyof typeof draft;
            const raw = msg.value;
            if (
              (key === "startedSkating" ||
                key === "createdAt" ||
                key === "updatedAt") &&
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
          const row = parseRow(msg.row);
          if (row) {
            multiplayerCollection.insert(row);
            knownIds.add(row.id);
          }
          break;
        }

        case "rows-add": {
          for (const raw of msg.rows) {
            const row = parseRow(raw);
            if (row) {
              multiplayerCollection.insert(row);
              knownIds.add(row.id);
            }
          }
          break;
        }

        case "rows-delete": {
          multiplayerCollection.delete(msg.ids);
          for (const id of msg.ids) knownIds.delete(id);
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
      // Clear collection rows from this session
      if (knownIds.size > 0) multiplayerCollection.delete([...knownIds]);
    };
  }, [roomId]);

  const sendCellUpdate = React.useCallback(
    (rowId: string, columnId: string, value: unknown) => {
      socketRef.current?.send(
        JSON.stringify({ type: "cell-update", rowId, columnId, value }),
      );
    },
    [],
  );

  const sendRowAdd = React.useCallback((row: RowPayload) => {
    socketRef.current?.send(JSON.stringify({ type: "row-add", row }));
  }, []);

  const sendRowsAdd = React.useCallback((rows: RowPayload[]) => {
    socketRef.current?.send(JSON.stringify({ type: "rows-add", rows }));
  }, []);

  const sendRowsDelete = React.useCallback((ids: string[]) => {
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
