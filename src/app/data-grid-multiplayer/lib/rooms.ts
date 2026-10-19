import { PUBLIC_ROOM_ID } from "@party/constants";

const ROOM_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ROOM_ID_LENGTH = 16;
const MAX_UNBIASED_BYTE =
  Math.floor(256 / ROOM_ID_ALPHABET.length) * ROOM_ID_ALPHABET.length;

export function createRoomId() {
  let id = "";
  while (id.length < ROOM_ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ROOM_ID_LENGTH))) {
      if (byte >= MAX_UNBIASED_BYTE || id.length === ROOM_ID_LENGTH) continue;
      id += ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length];
    }
  }
  return id;
}

export function getRoomPath(roomId: string) {
  return roomId === PUBLIC_ROOM_ID
    ? "/data-grid-multiplayer"
    : `/data-grid-multiplayer?room=${roomId}`;
}
