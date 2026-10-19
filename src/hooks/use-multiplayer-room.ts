"use client";

import type { RowPayload, ServerMessage, UserPresence } from "@party/types";

import { ADJECTIVES, ANIMALS, COLORS } from "@party/constants";
import PartySocket from "partysocket";
import * as React from "react";

import { skaterSchema } from "@/app/data-grid-live/lib/validation";
import { multiplayerCollection } from "@/app/data-grid-multiplayer/lib/multiplayer-collection";
import { env } from "@/env";
import { generateId } from "@/lib/id";

const PARTYKIT_HOST = env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
const STORAGE_KEY = "multiplayer-identity";
const HIDDEN_DISCONNECT_MS = 60_000;
const ACTIVE_CELL_THROTTLE_MS = 100;

interface Identity {
  clientId: string;
  name: string;
  color: string;
}

function getOrCreateIdentity(): Identity {
  let stored: Partial<Identity> | null = null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value) stored = JSON.parse(value) as Partial<Identity>;
  } catch {}

  if (stored?.clientId && stored.name && stored.color) {
    return stored as Identity;
  }

  const adj =
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? "Swift";
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] ?? "Fox";
  const identity: Identity = {
    clientId: stored?.clientId ?? generateId(),
    name: stored?.name ?? `${adj} ${animal}`,
    color:
      stored?.color ??
      COLORS[Math.floor(Math.random() * COLORS.length)] ??
      "#3b82f6",
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Fails silently if localStorage is not available
  }

  return identity;
}

function parseRow(raw: RowPayload) {
  const result = skaterSchema.safeParse(raw);
  if (result.success) return result.data;
  return null;
}

interface UseMultiplayerRoomReturn {
  users: Record<string, UserPresence>;
  currentUserId: string;
  sendCellUpdate: (rowId: string, columnId: string, value: unknown) => void;
  sendRowAdd: (row: RowPayload) => void;
  sendRowsAdd: (rows: RowPayload[]) => void;
  sendRowsDelete: (ids: string[]) => void;
  sendActiveCell: (rowId: string | null, columnId: string | null) => void;
}

export function useMultiplayerRoom(roomId: string): UseMultiplayerRoomReturn {
  const [users, setUsers] = React.useState<Record<string, UserPresence>>({});
  const [currentUserId, setCurrentUserId] = React.useState("");

  const socketRef = React.useRef<PartySocket | null>(null);
  const activeCellMessageRef = React.useRef<string | null>(null);
  const activeCellTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const knownIds = new Set<string>();
    const identity = getOrCreateIdentity();

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
      id: generateId(),
      query: {
        clientId: identity.clientId,
        name: identity.name,
        color: identity.color,
      },
    });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      if (activeCellMessageRef.current) {
        socket.send(activeCellMessageRef.current);
      }
    });

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
          const snapshotIds = new Set<string>();
          for (const raw of msg.rows ?? []) {
            const row = parseRow(raw);
            if (!row) continue;
            snapshotIds.add(row.id);
            if (knownIds.has(row.id)) {
              multiplayerCollection.update(row.id, (draft) => {
                Object.assign(draft, row);
              });
            } else {
              multiplayerCollection.insert(row);
              knownIds.add(row.id);
            }
          }
          const removedIds = [...knownIds].filter((id) => !snapshotIds.has(id));
          if (removedIds.length > 0) {
            multiplayerCollection.delete(removedIds);
            for (const id of removedIds) knownIds.delete(id);
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

    let hiddenTimeout = 0;
    function onVisibilityChange() {
      window.clearTimeout(hiddenTimeout);
      if (document.visibilityState === "hidden") {
        hiddenTimeout = window.setTimeout(
          () => socket.close(),
          HIDDEN_DISCONNECT_MS,
        );
      } else if (socket.readyState === PartySocket.CLOSED) {
        socket.reconnect();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearTimeout(hiddenTimeout);
      socket.close();
      if (activeCellTimeoutRef.current !== null) {
        window.clearTimeout(activeCellTimeoutRef.current);
        activeCellTimeoutRef.current = null;
      }
      socketRef.current = null;
      activeCellMessageRef.current = null;
      setUsers({});
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
      activeCellMessageRef.current = JSON.stringify({
        type: "active-cell",
        rowId,
        columnId,
      });
      if (activeCellTimeoutRef.current !== null) return;

      activeCellTimeoutRef.current = window.setTimeout(() => {
        activeCellTimeoutRef.current = null;
        if (activeCellMessageRef.current) {
          socketRef.current?.send(activeCellMessageRef.current);
        }
      }, ACTIVE_CELL_THROTTLE_MS);
    },
    [],
  );

  return {
    users,
    currentUserId,
    sendCellUpdate,
    sendRowAdd,
    sendRowsAdd,
    sendRowsDelete,
    sendActiveCell,
  };
}
