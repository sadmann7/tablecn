"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/components/data-grid/data-grid-skeleton";
import { generateId } from "@/lib/id";

const DataGridMultiplayerDemo = dynamic(
  () =>
    import("./components/data-grid-multiplayer-demo").then(
      (mod) => mod.DataGridMultiplayerDemo,
    ),
  {
    ssr: false,
    loading: () => (
      <DataGridSkeleton className="container flex flex-col gap-4 py-4">
        <DataGridSkeletonToolbar actionCount={5} />
        <DataGridSkeletonGrid />
      </DataGridSkeleton>
    ),
  },
);

export function DataGridMultiplayerPageClient() {
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
    return (
      <DataGridSkeleton className="container flex flex-col gap-4 py-4">
        <DataGridSkeletonToolbar actionCount={5} />
        <DataGridSkeletonGrid />
      </DataGridSkeleton>
    );
  }

  return <DataGridMultiplayerDemo roomId={roomId} />;
}
