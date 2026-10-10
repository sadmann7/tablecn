import { generateId } from "@/lib/id";

// Everyone shares this room unless they open a link to their own with ?room=
export const PUBLIC_ROOM_ID = "lobby";

export function createRoomId() {
  return generateId({
    length: 8,
    alphabet: "abcdefghijklmnopqrstuvwxyz0123456789",
  });
}

export function getRoomPath(roomId: string) {
  return roomId === PUBLIC_ROOM_ID
    ? "/data-grid-multiplayer"
    : `/data-grid-multiplayer?room=${roomId}`;
}
