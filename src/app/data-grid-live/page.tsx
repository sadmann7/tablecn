"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import { skatersCollection } from "@/app/data-grid-live/lib/collections";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic import to prevent SSR issues with useLiveQuery
const DataGridLiveDemo = dynamic(
  () =>
    import("./components/data-grid-live-demo").then(
      (mod) => mod.DataGridLiveDemo,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="container flex h-[calc(100dvh-5.5rem)] flex-col gap-4 py-4">
        <div className="flex items-center gap-2 self-end">
          <Skeleton className="h-7 w-18" />
          <Skeleton className="h-7 w-18" />
          <Skeleton className="h-7 w-18" />
        </div>
        <Skeleton className="h-full w-full" />
      </div>
    ),
  },
);

export default function DataGridLivePage() {
  // Preload the collection before rendering
  use(skatersCollection.preload());

  return <DataGridLiveDemo />;
}
