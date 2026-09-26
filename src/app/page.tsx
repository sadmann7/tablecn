import { Suspense } from "react";

import type { Task } from "@/db/schema";
import type { SearchParams } from "@/types";

import { getDataTableQuery } from "@/lib/parsers";
import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { TasksTable } from "./components/tasks-table";
import { TasksTableControls } from "./components/tasks-table-controls";
import {
  getEstimatedHoursRange,
  getRecentTasks,
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
    <div className="container flex flex-col gap-4 py-4">
      <Suspense fallback={null}>
        <TasksTableControls />
      </Suspense>
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
        <TasksTableWrapper {...props} />
      </Suspense>
    </div>
  );
}

async function TasksTableWrapper(props: IndexPageProps) {
  const searchParams = await props.searchParams;
  const search = searchParamsCache.parse(searchParams);
  const mode = search.tableMode;

  const tasks =
    mode === "client"
      ? getRecentTasks().then((data) => ({ data, pageCount: 0 }))
      : getTasks(getDataTableQuery<Task>(search, tasksFilterableColumns));

  const promises = Promise.all([
    tasks,
    getTaskStatusCounts(),
    getTaskPriorityCounts(),
    getEstimatedHoursRange(),
  ]);

  return (
    <TasksTable
      key={mode}
      mode={mode}
      filterFlag={search.filterFlag}
      promises={promises}
    />
  );
}
