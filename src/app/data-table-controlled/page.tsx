import type { Metadata } from "next";

import { DataTableExamples } from "@/app/components/data-table-examples";

import { TasksControlledTables } from "./components/tasks-controlled-tables";

export const metadata: Metadata = {
  title: "Data Tables with a controlled query",
  description:
    "Two data tables on one page, each holding its query in local state instead of the URL.",
};

export default function DataTableControlledPage() {
  return (
    <div className="container flex flex-col gap-8 py-4">
      <h1 className="sr-only">Data Tables with a controlled query</h1>
      <DataTableExamples />
      <TasksControlledTables />
    </div>
  );
}
