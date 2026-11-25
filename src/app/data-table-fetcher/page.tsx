import type { Metadata } from "next";

import { Suspense } from "react";

import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { TasksFetcherTable } from "./components/tasks-fetcher-table";

export const metadata: Metadata = {
  title: "Data Table with a fetcher",
  description:
    "A data table that fetches its own rows from a route handler with plain fetch.",
};

export default function DataTableFetcherPage() {
  return (
    <div className="container flex flex-col gap-4 py-4">
      <h1 className="sr-only">Data Table with a fetcher</h1>
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={6} filterCount={2} shrinkZero />
        }
      >
        <TasksFetcherTable />
      </Suspense>
    </div>
  );
}
