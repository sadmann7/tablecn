"use client";

import dynamic from "next/dynamic";

import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/registry/bases/radix/components/data-grid/data-grid-skeleton";

// Renders on the client only, since the live query has no server snapshot and the collection's preload fetch fails while prerendering
export const DataGridLiveLoader = dynamic(
  () => import("./data-grid-live-demo").then((mod) => mod.DataGridLiveDemo),
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
