"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { PUBLIC_ROOM_ID } from "../lib/rooms";
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

export function DataGridMultiplayerRoom() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") ?? PUBLIC_ROOM_ID;

  return <DataGridMultiplayerDemo roomId={roomId} />;
}
