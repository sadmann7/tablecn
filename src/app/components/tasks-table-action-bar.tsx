"use client";

import { Subscribe, type Table } from "@tanstack/react-table";
import { ArrowUp, CheckCircle2, Download, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { type Task, tasks } from "@/db/schema";
import { clearRowSelection } from "@/lib/data-table-utils";
import { exportTableToCSV } from "@/lib/export";
import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/registry/bases/radix/ui/action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";

import { deleteTasks, updateTasks } from "../lib/actions";

interface TasksTableActionBarProps {
  table: Table<DataTableFeatures, Task>;
}

export function TasksTableActionBar({ table }: TasksTableActionBarProps) {
  return (
    <Subscribe source={table.atoms.rowSelection}>
      {() => <TasksTableActionBarContent table={table} />}
    </Subscribe>
  );
}

function TasksTableActionBarContent({ table }: TasksTableActionBarProps) {
  const selectedIds = table.getSelectedRowIds();

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) clearRowSelection(table);
    },
    [table],
  );

  const onTaskUpdate = React.useCallback(
    (
      field: "status" | "priority",
      value: Task["status"] | Task["priority"],
    ) => {
      async function update() {
        const { error } = await updateTasks({
          ids: selectedIds,
          [field]: value,
        });

        if (error) {
          toast.error(error);
          return;
        }
        toast.success("Tasks updated");
      }
      void update();
    },
    [selectedIds],
  );

  const onTaskExport = React.useCallback(() => {
    exportTableToCSV(table, {
      excludeColumns: ["select", "actions"],
      onlySelected: true,
    });
  }, [table]);

  const onTaskDelete = React.useCallback(() => {
    async function remove() {
      const { error } = await deleteTasks({
        ids: selectedIds,
      });

      if (error) {
        toast.error(error);
        return;
      }
      clearRowSelection(table);
    }
    void remove();
  }, [selectedIds, table]);

  return (
    <ActionBar open={selectedIds.length > 0} onOpenChange={onOpenChange}>
      <ActionBarSelection>
        <span className="font-medium">{selectedIds.length}</span>
        <span>selected</span>
        <ActionBarSeparator />
        <ActionBarClose>
          <X />
        </ActionBarClose>
      </ActionBarSelection>
      <ActionBarSeparator />
      <ActionBarGroup>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionBarItem>
              <CheckCircle2 />
              Status
            </ActionBarItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {tasks.status.enumValues.map((status) => (
              <DropdownMenuItem
                key={status}
                className="capitalize"
                onClick={() => onTaskUpdate("status", status)}
              >
                {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionBarItem>
              <ArrowUp />
              Priority
            </ActionBarItem>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {tasks.priority.enumValues.map((priority) => (
              <DropdownMenuItem
                key={priority}
                className="capitalize"
                onClick={() => onTaskUpdate("priority", priority)}
              >
                {priority}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ActionBarItem onClick={onTaskExport}>
          <Download />
          Export
        </ActionBarItem>
        <ActionBarItem variant="destructive" onClick={onTaskDelete}>
          <Trash2 />
          Delete
        </ActionBarItem>
      </ActionBarGroup>
    </ActionBar>
  );
}
