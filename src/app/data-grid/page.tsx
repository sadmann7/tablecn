import { Suspense } from "react";

import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/registry/bases/radix/components/data-grid/data-grid-skeleton";

import { DataGridDemo } from "./components/data-grid-demo";

export default async function DataGridPage() {
  return (
    <>
      <h1 className="sr-only">Data Grid</h1>
      <Suspense
        fallback={
          <DataGridSkeleton className="container flex flex-col gap-4 py-4">
            <DataGridSkeletonToolbar actionCount={5} />
            <DataGridSkeletonGrid />
          </DataGridSkeleton>
        }
      >
        <DataGridDemo />
      </Suspense>
    </>
  );
}
