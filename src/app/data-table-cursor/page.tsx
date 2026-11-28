import type { Metadata } from "next";

import { Suspense } from "react";

import { DataTableExamples } from "@/app/components/data-table-examples";
import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { TasksCursorTable } from "./components/tasks-cursor-table";

export const metadata: Metadata = {
  title: "Data Table with Load more",
  description:
    "A data table that pages with a keyset cursor and appends each page with a Load more row.",
};

export default function DataTableCursorPage() {
  return (
    <div className="container flex flex-col gap-4 py-4">
      <h1 className="sr-only">Data Table with Load more</h1>
      <DataTableExamples />
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={6} filterCount={2} shrinkZero />
        }
      >
        <TasksCursorTable />
      </Suspense>
    </div>
  );
}
