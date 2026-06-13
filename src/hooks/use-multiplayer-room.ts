"use client";

import { ADJECTIVES, ANIMALS, COLORS } from "@party/constants";
import type { RowPayload, ServerMessage, UserPresence } from "@party/types";
import PartySocket from "partysocket";
import * as React from "react";
import { skaterSchema } from "@/app/data-grid-live/lib/validation";
import { multiplayerCollection } from "@/app/data-grid-multiplayer/lib/multiplayer-collection";
import { env } from "@/env";
import { generateId } from "@/lib/id";

const PARTYKIT_HOST = env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
const STORAGE_KEY = "multiplayer-identity";

interface Identity {
  name: string;
  color: string;
}

function getOrCreateIdentity(): Identity {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Identity;
  } catch {}

  const adj =
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? "Swift";
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] ?? "Fox";
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#3b82f6";
  const identity: Identity = { name: `${adj} ${animal}`, color };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Fail silently if sessionStorage is not available
  }

  return identity;
}

function parseRow(raw: RowPayload) {
  const result = skaterSchema.safeParse(raw);
  if (result.success) return result.data;
  console.warn("[multiplayer] Failed to parse row:", raw, result.error.issues);
  return null;
}

interface UseMultiplayerRoomReturn {
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
    const knownIds = new Set<string>();
    const identity = getOrCreateIdentity();

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
      id: generateId(),
      query: { name: identity.name, color: identity.color },
    });
    socketRef.current = socket;

    socket.addEventListener("open", () => setIsConnected(true));
    socket.addEventListener("close", () => setIsConnected(false));

    socket.addEventListener("message", (evt: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as ServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "snapshot": {
          setCurrentUserId(msg.userId);
          setUsers(msg.users);
          for (const raw of msg.rows ?? []) {
            const row = parseRow(raw);
            if (row) {
              multiplayerCollection.insert(row);
              knownIds.add(row.id);
            }
          }
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
          setUsers((prev) => ({ ...prev, [msg.userId]: msg.user }));
          break;
        }

        case "user-leave": {
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
      socket.close();
      socketRef.current = null;
      setIsConnected(false);
      if (knownIds.size > 0) multiplayerCollection.delete([...knownIds]);
    };
  }, [roomId]);

  function sendCellUpdate(rowId: string, columnId: string, value: unknown) {
    socketRef.current?.send(
      JSON.stringify({ type: "cell-update", rowId, columnId, value }),
    );
  }

  function sendRowAdd(row: RowPayload) {
    socketRef.current?.send(JSON.stringify({ type: "row-add", row }));
  }

  function sendRowsAdd(rows: RowPayload[]) {
    socketRef.current?.send(JSON.stringify({ type: "rows-add", rows }));
  }

  function sendRowsDelete(ids: string[]) {
    socketRef.current?.send(JSON.stringify({ type: "rows-delete", ids }));
  }

  function sendActiveCell(rowId: string | null, columnId: string | null) {
    socketRef.current?.send(
      JSON.stringify({ type: "active-cell", rowId, columnId }),
    );
  }

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
