import { Suspense } from "react";
import { DataGridDemo } from "@/components/data-grid-demo";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DataGridPage() {
  return (
    <Suspense
      fallback={
        <div className="container flex h-[calc(100dvh-5rem)] flex-col gap-4 py-4">
          <div className="flex items-center gap-2 self-end">
            <Skeleton className="h-7 w-18" />
            <Skeleton className="h-7 w-18" />
            <Skeleton className="h-7 w-18" />
          </div>
          <Skeleton className="h-full w-full" />
        </div>
      }
    >
      <DataGridDemo />
    </Suspense>
  );
}
