import { Suspense } from "react";

import { DataGridDoomPlayer } from "./components/data-grid-doom-player";
import { DataGridDoomSkeleton } from "./components/data-grid-doom-skeleton";

export default function DataGridDoomPage() {
  return (
    <>
      <h1 className="sr-only">Data Grid DOOM</h1>
      <Suspense fallback={<DataGridDoomSkeleton />}>
        <DataGridDoomPlayer />
      </Suspense>
    </>
  );
}
