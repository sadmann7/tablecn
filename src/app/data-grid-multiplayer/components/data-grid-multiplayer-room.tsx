"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { generateId } from "@/lib/id";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  React.useEffect(() => {
    if (!roomId) {
      const newRoom = generateId({
        length: 8,
        alphabet: "abcdefghijklmnopqrstuvwxyz0123456789",
      });
      router.replace(`/data-grid-multiplayer?room=${newRoom}`);
    }
  }, [roomId, router]);

  if (!roomId) {
    return <DataGridMultiplayerSkeleton />;
  }

  return <DataGridMultiplayerDemo roomId={roomId} />;
}
