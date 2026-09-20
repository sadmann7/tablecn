"use client";

import type { Table } from "@tanstack/react-table";

import { Download } from "lucide-react";

import type { Task } from "@/db/schema";
import type { DataTableFeatures } from "@/lib/table-features";

import { exportTableToCSV } from "@/lib/export";
import { Button } from "@/registry/bases/radix/ui/button";

import { CreateTaskSheet } from "./create-task-sheet";
import { DeleteTasksDialog } from "./delete-tasks-dialog";

interface TasksTableToolbarActionsProps {
  table: Table<DataTableFeatures, Task>;
}

export function TasksTableToolbarActions({
  table,
}: TasksTableToolbarActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {table.getFilteredSelectedRowModel().rows.length > 0 ? (
        <DeleteTasksDialog
          tasks={table
            .getFilteredSelectedRowModel()
            .rows.map((row) => row.original)}
          onSuccess={() => table.toggleAllRowsSelected(false)}
        />
      ) : null}
      <CreateTaskSheet />
      <Button
        variant="outline"
        onClick={() =>
          exportTableToCSV(table, {
            filename: "tasks",
            excludeColumns: ["select", "actions"],
          })
        }
      >
        <Download />
        Export
      </Button>
      {/**
       * Other actions can be added here.
       * For example, import, view, etc.
       */}
    </div>
  );
}
