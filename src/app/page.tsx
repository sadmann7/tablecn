import { Suspense } from "react";

import type { SearchParams } from "@/types";

import { getDataTableQuery } from "@/lib/data-table-parsers";
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
  getTaskStatusCounts,
  getTasks,
} from "./lib/queries";
import { searchParamsCache, tasksColumnConfigs } from "./lib/validations";

interface IndexPageProps {
  searchParams: Promise<SearchParams>;
}

export default function IndexPage(props: IndexPageProps) {
  return (
    <div className="container flex flex-col gap-4 py-4">
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
  const { dataMode } = search;

  const tasksPromise =
    dataMode === "client"
      ? getRecentTasks().then((data) => ({ data, pageCount: 0 }))
      : getTasks(getDataTableQuery(search, tasksColumnConfigs));

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
      filterMode={search.filterMode}
      promises={promises}
    />
  );
}
