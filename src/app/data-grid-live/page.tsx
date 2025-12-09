"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import { skatersCollection } from "@/app/data-grid-live/lib/collections";
import { Shell } from "@/components/shell";

// Dynamic import to prevent SSR issues with useLiveQuery
const DataGridLiveDemo = dynamic(
  () =>
    import("./components/data-grid-live-demo").then(
      (mod) => mod.DataGridLiveDemo,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    ),
  },
);

export default function DataGridLivePage() {
  // Preload the collection before rendering
  use(skatersCollection.preload());

  return (
    <Shell>
      <DataGridLiveDemo />
    </Shell>
  );
}
