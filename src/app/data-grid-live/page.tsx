"use client";

import dynamic from "next/dynamic";
import { skatersCollection } from "@/app/data-grid-live/lib/collections";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

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
  const [isPreloaded, setIsPreloaded] = useState(false);

  // Preload the collection on the client side only to avoid SSR prerender fetch issues
  useEffect(() => {
    skatersCollection.preload().then(() => setIsPreloaded(true));
  }, []);

  if (!isPreloaded) {
    return (
      <div className="container flex h-[calc(100dvh-5.5rem)] flex-col gap-4 py-4">
        <div className="flex items-center gap-2 self-end">
          <Skeleton className="h-7 w-18" />
          <Skeleton className="h-7 w-18" />
          <Skeleton className="h-7 w-18" />
        </div>
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return <DataGridLiveDemo />;
}
