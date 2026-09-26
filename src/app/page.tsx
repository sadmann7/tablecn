import { Suspense } from "react";

import type { Task } from "@/db/schema";
import type { SearchParams } from "@/types";

import { Shell } from "@/components/shell";
import { getDataTableQuery } from "@/lib/parsers";
import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { FeatureFlagsProvider } from "./components/feature-flags-provider";
import { TasksTable } from "./components/tasks-table";
import {
  getEstimatedHoursRange,
  getTaskPriorityCounts,
  getTaskStatusCounts,
  getTasks,
} from "./lib/queries";
import { searchParamsCache, tasksFilterableColumns } from "./lib/validations";

interface IndexPageProps {
  searchParams: Promise<SearchParams>;
}

export default function IndexPage(props: IndexPageProps) {
  return (
    <Shell>
      <Suspense
        fallback={
          <DataTableSkeleton
            columnCount={7}
            filterCount={2}
            cellWidths={[
              "10rem",
              "30rem",
              "10rem",
              "10rem",
              "6rem",
              "6rem",
              "6rem",
            ]}
            shrinkZero
          />
        }
      >
        <FeatureFlagsProvider>
          <TasksTableWrapper {...props} />
        </FeatureFlagsProvider>
      </Suspense>
    </Shell>
  );
}

async function TasksTableWrapper(props: IndexPageProps) {
  const searchParams = await props.searchParams;
  const search = searchParamsCache.parse(searchParams);

  const promises = Promise.all([
    getTasks(getDataTableQuery<Task>(search, tasksFilterableColumns)),
    getTaskStatusCounts(),
    getTaskPriorityCounts(),
    getEstimatedHoursRange(),
  ]);

  return <TasksTable promises={promises} />;
}
