import type { Metadata } from "next";

import { Suspense } from "react";

import { DataTableExamples } from "@/app/components/data-table-examples";
import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { TasksQueryTable } from "./components/tasks-query-table";

export const metadata: Metadata = {
  title: "Data Table with TanStack Query",
  description:
    "A data table whose rows come from TanStack Query, keyed by the table's query.",
};

export default function DataTableQueryPage() {
  return (
    <div className="container flex flex-col gap-4 py-4">
      <h1 className="sr-only">Data Table with TanStack Query</h1>
      <DataTableExamples />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={6} filterCount={2} shrinkZero />
        }
      >
        <TasksQueryTable />
      </Suspense>
    </div>
  );
}
