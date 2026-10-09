import { Suspense } from "react";

import { DataGridMultiplayerRoom } from "./components/data-grid-multiplayer-room";
import { DataGridMultiplayerSkeleton } from "./components/data-grid-multiplayer-skeleton";

export default function DataGridMultiplayerPage() {
  return (
    <>
      <h1 className="sr-only">Data Grid Multiplayer</h1>
      <Suspense fallback={<DataGridMultiplayerSkeleton />}>
        <DataGridMultiplayerRoom />
      </Suspense>
    </>
  );
}
