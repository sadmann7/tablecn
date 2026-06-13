import { Suspense } from "react";
import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/components/data-grid/data-grid-skeleton";
import { DataGridMultiplayerPageClient } from "./multiplayer-page-client";

function MultiplayerFallback() {
  return (
    <DataGridSkeleton className="container flex flex-col gap-4 py-4">
      <DataGridSkeletonToolbar actionCount={5} />
      <DataGridSkeletonGrid />
    </DataGridSkeleton>
  );
}

export default function DataGridMultiplayerPage() {
  return (
    <Suspense fallback={<MultiplayerFallback />}>
      <DataGridMultiplayerPageClient />
    </Suspense>
  );
}
