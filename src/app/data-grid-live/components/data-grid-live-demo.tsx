"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, CheckCircle2, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { employeesCollection } from "@/app/data-grid-live/lib/collections";
import {
  generateRandomEmployee,
  getDepartmentIcon,
  getEmployeeStatusIcon,
  getRoleIcon,
} from "@/app/lib/utils";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/components/ui/action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { employees } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { useUploadThing } from "@/lib/uploadthing";
import type { EmployeeSchema } from "../lib/validation";

const departmentOptions = employees.department.enumValues.map((dept) => ({
  label: dept.charAt(0).toUpperCase() + dept.slice(1),
  value: dept,
  icon: getDepartmentIcon(dept),
}));

const roleOptions = employees.role.enumValues.map((role) => ({
  label: role.charAt(0).toUpperCase() + role.slice(1),
  value: role,
  icon: getRoleIcon(role),
}));

const statusOptions = employees.status.enumValues.map((status) => ({
  label: status.charAt(0).toUpperCase() + status.slice(1).replace("-", " "),
  value: status,
  icon: getEmployeeStatusIcon(status),
}));

const skillOptions = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "SQL",
  "AWS",
  "Docker",
  "Git",
  "Agile",
] as const;

const skillSelectOptions = skillOptions.map((skill) => ({
  label: skill,
  value: skill,
}));

export function DataGridLiveDemo() {
  const { height } = useWindowSize();

  const { data = [], isLoading } = useLiveQuery((q) =>
    q.from({ employee: employeesCollection }),
  );

  const { startUpload } = useUploadThing("taskAttachment");

  const filterFn = React.useMemo(() => getFilterFn<EmployeeSchema>(), []);

  const columns = React.useMemo<ColumnDef<EmployeeSchema>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row, table }) => (
          <Checkbox
            aria-label="Select row"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => {
              const onRowSelect = table.options.meta?.onRowSelect;
              if (onRowSelect) {
                onRowSelect(row.index, !!value, false);
              } else {
                row.toggleSelected(!!value);
              }
            }}
            onClick={(event: React.MouseEvent) => {
              if (event.shiftKey) {
                event.preventDefault();
                const onRowSelect = table.options.meta?.onRowSelect;
                if (onRowSelect) {
                  onRowSelect(row.index, !row.getIsSelected(), true);
                }
              }
            }}
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        minSize: 200,
        filterFn,
        meta: {
          label: "Name",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        minSize: 250,
        filterFn,
        meta: {
          label: "Email",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "department",
        accessorKey: "department",
        header: "Department",
        minSize: 180,
        filterFn,
        meta: {
          label: "Department",
          cell: {
            variant: "select",
            options: departmentOptions,
          },
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        minSize: 160,
        filterFn,
        meta: {
          label: "Role",
          cell: {
            variant: "select",
            options: roleOptions,
          },
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        minSize: 160,
        filterFn,
        meta: {
          label: "Status",
          cell: {
            variant: "select",
            options: statusOptions,
          },
        },
      },
      {
        id: "skills",
        accessorKey: "skills",
        header: "Skills",
        minSize: 240,
        filterFn,
        meta: {
          label: "Skills",
          cell: {
            variant: "multi-select",
            options: skillSelectOptions,
          },
        },
      },
      {
        id: "salary",
        accessorKey: "salary",
        header: "Salary",
        minSize: 140,
        filterFn,
        meta: {
          label: "Salary",
          cell: {
            variant: "number",
            min: 0,
            step: 1000,
          },
        },
      },
      {
        id: "startDate",
        accessorKey: "startDate",
        header: "Start Date",
        minSize: 150,
        filterFn,
        meta: {
          label: "Start Date",
          cell: {
            variant: "date",
          },
        },
      },
      {
        id: "isVerified",
        accessorKey: "isVerified",
        header: "Verified",
        minSize: 120,
        filterFn,
        meta: {
          label: "Verified",
          cell: {
            variant: "checkbox",
          },
        },
      },
      {
        id: "documents",
        accessorKey: "documents",
        header: "Documents",
        minSize: 240,
        filterFn,
        meta: {
          label: "Documents",
          cell: {
            variant: "file",
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            accept:
              "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
            multiple: true,
          },
        },
      },
    ],
    [filterFn],
  );

  const onDataChange: NonNullable<
    UseDataGridProps<EmployeeSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      // Diff and update changed employees via TanStack DB for optimistic updates
      for (const employee of newData) {
        const existingEmployee = data.find((e) => e.id === employee.id);
        if (!existingEmployee) continue;

        // Check if any field changed using JSON comparison for arrays/objects
        const hasChanges = (
          Object.keys(employee) as Array<keyof EmployeeSchema>
        ).some((key) => {
          const existingValue =
            existingEmployee[key] instanceof Date
              ? (existingEmployee[key] as Date).toISOString()
              : existingEmployee[key];
          const newValue =
            employee[key] instanceof Date
              ? (employee[key] as Date).toISOString()
              : employee[key];

          return JSON.stringify(existingValue) !== JSON.stringify(newValue);
        });

        if (hasChanges) {
          employeesCollection.update(employee.id, (draft) => {
            Object.assign(draft, employee);
          });
        }
      }
    },
    [data],
  );

  const onRowAdd: NonNullable<UseDataGridProps<EmployeeSchema>["onRowAdd"]> =
    React.useCallback(() => {
      employeesCollection.insert(
        generateRandomEmployee({
          name: "",
        }),
      );

      return {
        rowIndex: data.length,
        columnId: "name",
      };
    }, [data.length]);

  const onRowsAdd: NonNullable<UseDataGridProps<EmployeeSchema>["onRowsAdd"]> =
    React.useCallback((count: number) => {
      for (let i = 0; i < count; i++) {
        employeesCollection.insert({
          id: crypto.randomUUID(),
          name: null,
          email: null,
          department: "engineering",
          role: "developer",
          status: "active",
          salary: 0,
          startDate: null,
          isVerified: false,
          skills: null,
          documents: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }, []);

  const onRowsDelete: NonNullable<
    UseDataGridProps<EmployeeSchema>["onRowsDelete"]
  > = React.useCallback((rowsToDelete) => {
    // Use batch delete - single transaction for all deletions
    employeesCollection.delete(rowsToDelete.map((emp) => emp.id));
  }, []);

  const onFilesUpload: NonNullable<
    UseDataGridProps<EmployeeSchema>["onFilesUpload"]
  > = React.useCallback(
    async ({ files }) => {
      // Try to upload via UploadThing, fall back to simulation if not configured
      try {
        const uploadedFiles = await startUpload(files);

        if (uploadedFiles) {
          return uploadedFiles.map((file) => ({
            id: file.key,
            name: file.name,
            size: file.size,
            type: file.type,
            url: file.ufsUrl,
          }));
        }
      } catch {
        // UploadThing not configured, fall back to simulation
      }

      // Simulate upload for demo/development without UploadThing
      await new Promise((resolve) => setTimeout(resolve, 800));

      return files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));
    },
    [startUpload],
  );

  const onFilesDelete: NonNullable<
    UseDataGridProps<EmployeeSchema>["onFilesDelete"]
  > = React.useCallback(async ({ fileIds }) => {
    // Try to delete from UploadThing, silently fail if not configured
    try {
      await fetch("/api/uploadthing/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKeys: fileIds }),
      });
    } catch {
      // UploadThing not configured or delete failed, ignore
    }
  }, []);

  const { table, ...dataGridProps } = useDataGrid({
    data,
    onDataChange,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    onFilesUpload,
    onFilesDelete,
    columns,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: {
        left: ["select"],
      },
    },
    enableSearch: true,
    enablePaste: true,
  });

  const updateSelectedEmployees = React.useCallback(
    (
      field: "status" | "department",
      value: EmployeeSchema["status"] | EmployeeSchema["department"],
    ) => {
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        toast.error("No employees selected");
        return;
      }

      // Use batch update - single transaction for all updates
      employeesCollection.update(
        selectedRows.map((row) => row.original.id),
        (drafts) => {
          for (const draft of drafts) {
            draft[field] = value as never;
          }
        },
      );

      toast.success(
        `${selectedRows.length} employee${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const deleteSelectedEmployees = React.useCallback(() => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("No employees selected");
      return;
    }

    // Use batch delete - single transaction for all deletions
    employeesCollection.delete(selectedRows.map((row) => row.original.id));

    toast.success(
      `${selectedRows.length} employee${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table]);

  const gridHeight = height ? Math.min(height - 170, 800) : 600;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading employees...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        <DataGridKeyboardShortcuts />
        <DataGridViewMenu table={table} align="end" />
        <DataGridFilterMenu table={table} align="end" />
        <DataGridSortMenu table={table} align="end" />
        <DataGridRowHeightMenu table={table} align="end" />
      </div>
      <DataGrid {...dataGridProps} table={table} height={gridHeight} />
      <ActionBar
        data-grid-popover
        open={table.getSelectedRowModel().rows.length > 0}
        onOpenChange={(open) => {
          if (!open) table.toggleAllRowsSelected(false);
        }}
      >
        <ActionBarSelection>
          <span className="font-medium">
            {table.getSelectedRowModel().rows.length}
          </span>
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
              <ActionBarItem variant="secondary" size="sm">
                <CheckCircle2 />
                Status
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() =>
                    updateSelectedEmployees("status", option.value)
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionBarItem variant="secondary" size="sm">
                <Building2 />
                Department
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {departmentOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() =>
                    updateSelectedEmployees("department", option.value)
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ActionBarItem
            variant="destructive"
            size="sm"
            onClick={deleteSelectedEmployees}
          >
            <Trash2 />
            Delete
          </ActionBarItem>
        </ActionBarGroup>
      </ActionBar>
    </div>
  );
}
