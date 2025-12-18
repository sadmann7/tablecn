"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

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
  return <DataGridLiveDemo />;
}
