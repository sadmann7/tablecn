"use client";

import type { ServerMessage, UserPresence } from "@party/types";

import { ADJECTIVES, ANIMALS, COLORS } from "@party/constants";
import PartySocket from "partysocket";
import * as React from "react";

import {
  createSkatersCollection,
  type SkatersCollection,
} from "@/app/data-grid-multiplayer/lib/multiplayer-collection";
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
  } catch {
    // Fails silently if localStorage is not available
  }

  if (stored?.clientId && stored.name && stored.color) {
    return stored as Identity;
  }

  const adjective =
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? "Swift";
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] ?? "Fox";
  const identity: Identity = {
    clientId: stored?.clientId ?? generateId(),
    name: stored?.name ?? `${adjective} ${animal}`,
    color:
      stored?.color ??
      COLORS[Math.floor(Math.random() * COLORS.length)] ??
      "#3b82f6",
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {}

  return identity;
}

interface Room {
  socket: PartySocket;
  collection: SkatersCollection;
  subscribe: (listener: (message: ServerMessage) => void) => () => void;
}

function createRoom(roomId: string): Room {
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
    startClosed: true,
  });

  const listeners = new Set<(message: ServerMessage) => void>();
  socket.addEventListener("message", (event: MessageEvent) => {
    let message: ServerMessage;
    try {
      message = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      return;
    }
    for (const listener of listeners) listener(message);
  });

  function subscribe(listener: (message: ServerMessage) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  const collection = createSkatersCollection({
    send: (message) => socket.send(JSON.stringify(message)),
    subscribe,
  });

  return { socket, collection, subscribe };
}

interface UseMultiplayerRoomReturn {
  collection: SkatersCollection;
  users: Record<string, UserPresence>;
  currentUserId: string;
  sendActiveCell: (rowId: string | null, columnId: string | null) => void;
}

export function useMultiplayerRoom(roomId: string): UseMultiplayerRoomReturn {
  const [room] = React.useState(() => createRoom(roomId));
  const [users, setUsers] = React.useState<Record<string, UserPresence>>({});
  const [currentUserId, setCurrentUserId] = React.useState("");

  const activeCellMessageRef = React.useRef<string | null>(null);
  const activeCellTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const { socket } = room;

    function onOpen() {
      if (activeCellMessageRef.current) {
        socket.send(activeCellMessageRef.current);
      }
    }
    socket.addEventListener("open", onOpen);

    const unsubscribe = room.subscribe((msg) => {
      switch (msg.type) {
        case "snapshot": {
          setCurrentUserId(msg.userId);
          setUsers(msg.users);
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

    socket.reconnect();

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
      socket.removeEventListener("open", onOpen);
      unsubscribe();
      socket.close();
      if (activeCellTimeoutRef.current !== null) {
        window.clearTimeout(activeCellTimeoutRef.current);
        activeCellTimeoutRef.current = null;
      }
      activeCellMessageRef.current = null;
      setUsers({});
    };
  }, [room]);

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
          room.socket.send(activeCellMessageRef.current);
        }
      }, ACTIVE_CELL_THROTTLE_MS);
    },
    [room],
  );

  return {
    collection: room.collection,
    users,
    currentUserId,
    sendActiveCell,
  };
}
