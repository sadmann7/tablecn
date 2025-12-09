"use client";

import type { Table } from "@tanstack/react-table";
import { ArrowUp, CheckCircle2, Download, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/components/ui/action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Task, tasks } from "@/db/schema";
import { exportTableToCSV } from "@/lib/export";
import { deleteTasks, updateTasks } from "../lib/actions";

interface TasksTableActionBarProps {
  table: Table<Task>;
}

export function TasksTableActionBar({ table }: TasksTableActionBarProps) {
  const rows = table.getFilteredSelectedRowModel().rows;

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        table.toggleAllRowsSelected(false);
      }
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
          ids: rows.map((row) => row.original.id),
          [field]: value,
        });

        if (error) {
          toast.error(error);
          return;
        }
        toast.success("Tasks updated");
      }
      update();
    },
    [rows],
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
        ids: rows.map((row) => row.original.id),
      });

      if (error) {
        toast.error(error);
        return;
      }
      table.toggleAllRowsSelected(false);
    }
    remove();
  }, [rows, table]);

  return (
    <ActionBar open={rows.length > 0} onOpenChange={onOpenChange}>
      <ActionBarSelection>
        <span className="font-medium">{rows.length}</span>
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
