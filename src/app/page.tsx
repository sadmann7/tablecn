import { Suspense } from "react";

import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { TasksTable } from "./components/tasks-table";
import {
  TasksTableControlMenu,
  TasksTableControlMenuSkeleton,
} from "./components/tasks-table-control-menu";
import {
  getEstimatedHoursRange,
  getRecentTasks,
  getTaskPriorityCounts,
  getTasks,
  getTaskStatusCounts,
} from "./lib/queries";
import { searchParamsCache, tasksTable } from "./lib/validations";

export default function IndexPage(props: PageProps<"/">) {
  return (
    <div className="container flex flex-col gap-4 py-4">
      <h1 className="sr-only">Data Table</h1>
      <Suspense fallback={<TasksTableControlMenuSkeleton />}>
        <TasksTableControlMenu />
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
            className="max-h-[calc(100svh-9rem)]"
          />
        }
      >
        <TasksTableWrapper {...props} />
      </Suspense>
    </div>
  );
}

async function TasksTableWrapper(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const { dataMode, dir, filterMode } = searchParamsCache.parse(searchParams);

  const tasksPromise =
    dataMode === "client"
      ? getRecentTasks().then((data) => ({ data, pageCount: 0 }))
      : getTasks(tasksTable.parse(searchParams));

  const promises = Promise.all([
    tasksPromise,
    getTaskStatusCounts(),
    getTaskPriorityCounts(),
    getEstimatedHoursRange(),
  ]);

  return (
    <TasksTable
      key={dataMode}
      dataMode={dataMode}
      dir={dir}
      filterMode={filterMode}
      promises={promises}
    />
  );
}
