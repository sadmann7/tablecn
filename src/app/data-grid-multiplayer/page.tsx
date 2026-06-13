import { Suspense } from "react";
import { DataGridMultiplayerRoom } from "./components/data-grid-multiplayer-room";
import { DataGridMultiplayerSkeleton } from "./components/data-grid-multiplayer-skeleton";

export default function DataGridMultiplayerPage() {
  return (
    <Suspense fallback={<DataGridMultiplayerSkeleton />}>
      <DataGridMultiplayerRoom />
    </Suspense>
  );
}
