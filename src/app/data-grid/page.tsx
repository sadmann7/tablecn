import { Suspense } from "react";
import { DataGridDemo } from "@/components/data-grid/data-grid-demo";

export default async function DataGridPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[600px] items-center justify-center">
          Loading...
        </div>
      }
    >
      <DataGridDemo />
    </Suspense>
  );
}
