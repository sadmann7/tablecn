import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { Shell } from "@/components/shell";
import { getValidFilters } from "@/lib/data-table";
import type { SearchParams } from "@/types";
import { FeatureFlagsProvider } from "./components/feature-flags-provider";
import { TasksTable } from "./components/tasks-table";
import {
  getEstimatedHoursRange,
  getTaskPriorityCounts,
  getTaskStatusCounts,
  getTasks,
} from "./lib/queries";
import { searchParamsCache } from "./lib/validations";

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

  const validFilters = getValidFilters(search.filters);

  const promises = Promise.all([
    getTasks({
      ...search,
      filters: validFilters,
    }),
    getTaskStatusCounts(),
    getTaskPriorityCounts(),
    getEstimatedHoursRange(),
  ]);

  return <TasksTable promises={promises} />;
}
