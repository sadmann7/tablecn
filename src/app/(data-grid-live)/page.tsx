"use client";

import dynamic from "next/dynamic";
import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/components/data-grid/data-grid-skeleton";

// Dynamic import with ssr: false is required because:
// 1. useLiveQuery uses useSyncExternalStore which needs getServerSnapshot for SSR
// 2. Collection preload triggers fetch() which rejects during prerendering
const DataGridLiveDemo = dynamic(
  () =>
    import("./components/data-grid-live-demo").then(
      (mod) => mod.DataGridLiveDemo,
    ),
  {
    ssr: false,
    loading: () => (
      <DataGridSkeleton className="container flex flex-col gap-4 py-4">
        <DataGridSkeletonToolbar actionCount={4} />
        <DataGridSkeletonGrid />
      </DataGridSkeleton>
    ),
  },
);

export default function DataGridLivePage() {
  return <DataGridLiveDemo />;
}
