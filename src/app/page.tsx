import * as React from "react";
import { createSearchParamsCache } from "nuqs/server";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { Shell } from "@/components/shell";
import { getValidFilters } from "@/lib/data-table";
import type { SearchParams } from "@/types";

import { FeatureFlagsProvider } from "./_components/feature-flags-provider";
import { TasksTable } from "./_components/tasks-table";
import {
  getEstimatedHoursRange,
  getTaskPriorityCounts,
  getTaskStatusCounts,
  getTasks,
} from "./_lib/queries";
import { searchParams } from "./_lib/validations";
import { FilterKeys } from "@/types/data-table";

const table1: FilterKeys = {
  page: "p1",
  perPage: "pp1",
  sort: "s1",
  filters: "f1",
  joinOperator: "j1",
}
const table2: FilterKeys = {
  page: "p2",
  perPage: "pp2",
  sort: "s2",
  filters: "f2",
  joinOperator: "j2",
}

const searchParamsCache1 = createSearchParamsCache(searchParams, { urlKeys: table1 })
const searchParamsCache2 = createSearchParamsCache(searchParams, { urlKeys: table2 })

interface IndexPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function IndexPage(props: IndexPageProps) {
  const searchParams = await props.searchParams;
  const search1 = searchParamsCache1.parse(searchParams);
  const search2 = searchParamsCache2.parse(searchParams);

  const validFilters1 = getValidFilters(search1.filters);
  const validFilters2 = getValidFilters(search2.filters);

  const promises1 = Promise.all([
    getTasks({
      ...search1,
      filters: validFilters1,
    }),
    getTaskStatusCounts(),
    getTaskPriorityCounts(),
    getEstimatedHoursRange(),
  ]);
  const promises2 = Promise.all([
    getTasks({
      ...search2,
      filters: validFilters2,
    }),
    getTaskStatusCounts(),
    getTaskPriorityCounts(),
    getEstimatedHoursRange(),
  ]);

  return (
    <Shell className="gap-2">
      <FeatureFlagsProvider>
        <React.Suspense
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
          <TasksTable promises={promises1} advancedFilterKeys={table1}/>
        </React.Suspense>
        <React.Suspense
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
          <TasksTable promises={promises2} advancedFilterKeys={table2}/>
        </React.Suspense>
      </FeatureFlagsProvider>
    </Shell>
  );
}
