"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { DataGridMultiplayerSkeleton } from "./data-grid-multiplayer-skeleton";

const DataGridMultiplayerDemo = dynamic(
  () =>
    import("./data-grid-multiplayer-demo").then(
      (mod) => mod.DataGridMultiplayerDemo,
    ),
  {
    ssr: false,
    loading: () => <DataGridMultiplayerSkeleton />,
  },
);

// Everyone shares this room unless they open a link to their own with ?room=
const DEFAULT_ROOM_ID = "lobby";

export function DataGridMultiplayerRoom() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") ?? DEFAULT_ROOM_ID;

  return <DataGridMultiplayerDemo roomId={roomId} />;
}
