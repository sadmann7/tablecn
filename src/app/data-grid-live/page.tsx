import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DataGridLiveDemo } from "./components/data-grid-live-demo";

export default function DataGridLivePage() {
  return (
    <Suspense
      fallback={
        <div className="container flex h-[calc(100dvh-5.5rem)] flex-col gap-4 py-4">
          <div className="flex items-center gap-2 self-end">
            <Skeleton className="h-7 w-18" />
            <Skeleton className="h-7 w-18" />
            <Skeleton className="h-7 w-18" />
          </div>
          <Skeleton className="h-full w-full" />
        </div>
      }
    >
      <DataGridLiveDemo />
    </Suspense>
  );
}
