import type { ClientMessage, ServerMessage } from "@party/types";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSkatersCollection } from "../multiplayer-collection";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const snapshot: ServerMessage = {
  type: "snapshot",
  users: {},
  userId: "user-1",
  rows: [
    {
      id: "row-1",
      order: 1,
      name: "Ada Lovelace",
      email: null,
      stance: null,
      style: null,
      status: null,
      yearsSkating: null,
      startedSkating: null,
      isPro: false,
      tricks: null,
      media: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    },
  ],
};

function createRoom() {
  const sent: ClientMessage[] = [];
  let listener: ((message: ServerMessage) => void) | null = null;

  const collection = createSkatersCollection({
    send: (message) => {
      sent.push(message);
    },
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
  });

  return {
    collection,
    sent,
    emit: (message: ServerMessage) => listener?.(message),
  };
}

describe("createSkatersCollection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resends an unacked write when the room reconnects", async () => {
    const { collection, sent, emit } = createRoom();
    emit(snapshot);

    const transaction = collection.update("row-1", (draft) => {
      draft.name = "Grace Hopper";
    });
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    emit(snapshot);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(collection.get("row-1")?.name).toBe("Grace Hopper");

    const message = sent[0];
    if (!message || !("mutationId" in message)) {
      throw new Error("Expected a mutation");
    }
    emit({ type: "ack", mutationId: message.mutationId });
    await transaction.isPersisted.promise;

    expect(collection.get("row-1")?.name).toBe("Grace Hopper");
  });

  it("marks the collection as errored until the room answers", () => {
    vi.useFakeTimers();
    const { collection, emit } = createRoom();

    vi.advanceTimersByTime(10_000);
    expect(collection.status).toBe("error");

    emit(snapshot);
    expect(collection.status).toBe("ready");
  });
});
