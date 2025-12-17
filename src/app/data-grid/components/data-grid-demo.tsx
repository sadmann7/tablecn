"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import type { ColumnDef } from "@tanstack/react-table";
import { Languages } from "lucide-react";
import * as React from "react";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { Toggle } from "@/components/ui/toggle";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
import type { Direction } from "@/types/data-grid";
import {
  departments,
  initialData,
  type Person,
  skills,
  statuses,
} from "../lib/seeds";

interface DataGridDemoImplProps extends UseDataGridProps<Person> {
  dir: Direction;
  onDirChange: (dir: Direction) => void;
  height: number;
}

function DataGridDemoImpl({
  dir,
  onDirChange,
  height,
  ...props
}: DataGridDemoImplProps) {
  const { table, ...dataGridProps } = useDataGrid({
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: {
        left: ["select"],
      },
    },
    enableSearch: true,
    enablePaste: true,
    ...props,
  });

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        <Toggle
          aria-label="Toggle text direction"
          dir={dir}
          variant="outline"
          size="sm"
          className="bg-background dark:bg-input/30 dark:hover:bg-input/50"
          pressed={dir === "rtl"}
          onPressedChange={(pressed) => onDirChange(pressed ? "rtl" : "ltr")}
        >
          <Languages className="text-muted-foreground" />
          {dir === "ltr" ? "LTR" : "RTL"}
        </Toggle>
        <DataGridFilterMenu table={table} align="end" />
        <DataGridSortMenu table={table} align="end" />
        <DataGridRowHeightMenu table={table} align="end" />
        <DataGridViewMenu table={table} align="end" />
      </div>
      <DataGridKeyboardShortcuts enableSearch={!!dataGridProps.searchState} />
      <DataGrid {...dataGridProps} table={table} height={height} />
    </div>
  );
}

export function DataGridDemo() {
  const [data, setData] = React.useState<Person[]>(initialData);
  const [dir, setDir] = React.useState<Direction>("ltr");
  const windowSize = useWindowSize({ defaultHeight: 760 });

  const filterFn = React.useMemo(() => getFilterFn<Person>(), []);

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      getDataGridSelectColumn<Person>(),
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        minSize: 180,
        filterFn,
        meta: {
          label: "Name",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "age",
        accessorKey: "age",
        header: "Age",
        minSize: 100,
        filterFn,
        meta: {
          label: "Age",
          cell: {
            variant: "number",
            min: 18,
            max: 100,
            step: 1,
          },
        },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        minSize: 240,
        filterFn,
        meta: {
          label: "Email",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "website",
        accessorKey: "website",
        header: "Website",
        minSize: 240,
        filterFn,
        meta: {
          label: "Website",
          cell: {
            variant: "url",
          },
        },
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        minSize: 200,
        filterFn,
        meta: {
          label: "Notes",
          cell: {
            variant: "long-text",
          },
        },
      },
      {
        id: "salary",
        accessorKey: "salary",
        header: "Salary",
        minSize: 180,
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
        id: "department",
        accessorKey: "department",
        header: "Department",
        minSize: 180,
        filterFn,
        meta: {
          label: "Department",
          cell: {
            variant: "select",
            options: departments.map((dept) => ({
              label: dept,
              value: dept,
            })),
          },
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        minSize: 180,
        filterFn,
        meta: {
          label: "Status",
          cell: {
            variant: "select",
            options: statuses.map((status) => ({
              label: status,
              value: status,
            })),
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
            options: skills.map((skill) => ({
              label: skill,
              value: skill,
            })),
          },
        },
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: "Active",
        minSize: 140,
        filterFn,
        meta: {
          label: "Active",
          cell: {
            variant: "checkbox",
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
        id: "attachments",
        accessorKey: "attachments",
        header: "Attachments",
        minSize: 240,
        filterFn,
        meta: {
          label: "Attachments",
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

  const onRowAdd: NonNullable<UseDataGridProps<Person>["onRowAdd"]> =
    React.useCallback(() => {
      // Called when user manually adds a single row (e.g., clicking "Add Row" button)
      // In a real app, you would make a server call here:
      // await fetch('/api/people', {
      //   method: 'POST',
      //   body: JSON.stringify({ name: 'New Person' })
      // });

      // For this demo, just add a new row to the data
      setData((prev) => [
        ...prev,
        {
          id: generateId(),
        },
      ]);

      return {
        rowIndex: data.length,
        columnId: "name",
      };
    }, [data.length]);

  const onRowsAdd: NonNullable<UseDataGridProps<Person>["onRowsAdd"]> =
    React.useCallback((count: number) => {
      // Called when paste operation needs to create multiple rows at once
      // This is more efficient than calling onRowAdd multiple times - only a single API call needed
      // In a real app, you would make a server call here:
      // await fetch('/api/people/bulk', {
      //   method: 'POST',
      //   body: JSON.stringify({ count })
      // });

      // For this demo, create multiple rows in a single state update
      setData((prev) => {
        const newRows = Array.from({ length: count }, () => ({
          id: generateId(),
        }));
        return [...prev, ...newRows];
      });
    }, []);

  const onRowsDelete: NonNullable<UseDataGridProps<Person>["onRowsDelete"]> =
    React.useCallback((rows) => {
      // In a real app, you would make a server call here:
      // await fetch('/api/people', {
      //   method: 'DELETE',
      //   body: JSON.stringify({ ids: rows.map(r => r.id) })
      // });

      // For this demo, just filter out the deleted rows
      setData((prev) => prev.filter((row) => !rows.includes(row)));
    }, []);

  const onFilesUpload: NonNullable<UseDataGridProps<Person>["onFilesUpload"]> =
    React.useCallback(
      async ({ files, rowIndex: _rowIndex, columnId: _columnId }) => {
        // In a real app, you would upload multiple files to your server/storage:
        // const row = data[rowIndex];
        // const formData = new FormData();
        // files.forEach(file => formData.append('files', file));
        // formData.append('personId', row.id);
        // formData.append('columnId', columnId);
        //
        // const response = await fetch('/api/upload', {
        //   method: 'POST',
        //   body: formData
        // });
        // const data = await response.json();
        // return data.files.map(f => ({
        //   id: f.fileId,
        //   name: f.fileName,
        //   size: f.fileSize,
        //   type: f.fileType,
        //   url: f.fileUrl
        // }));

        // For this demo, simulate an upload delay and create local URLs
        await new Promise((resolve) => setTimeout(resolve, 800));

        return files.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        }));
      },
      [],
    );

  const onFilesDelete: NonNullable<UseDataGridProps<Person>["onFilesDelete"]> =
    React.useCallback(async ({ fileIds, rowIndex, columnId }) => {
      // In a real app, you would delete multiple files from your server/storage:
      // const row = data[rowIndex];
      // await fetch('/api/files/batch-delete', {
      //   method: 'DELETE',
      //   body: JSON.stringify({ fileIds, personId: row.id, columnId })
      // });

      // For this demo, just log the deletion
      console.log(
        `Deleting ${fileIds.length} file(s) from row ${rowIndex}, column ${columnId}:`,
        fileIds,
      );
    }, []);

  const height = Math.max(400, windowSize.height - 150);

  return (
    <DirectionProvider dir={dir}>
      <DataGridDemoImpl
        data={data}
        onDataChange={setData}
        columns={columns}
        onRowAdd={onRowAdd}
        onRowsAdd={onRowsAdd}
        onRowsDelete={onRowsDelete}
        onFilesUpload={onFilesUpload}
        onFilesDelete={onFilesDelete}
        height={height}
        dir={dir}
        onDirChange={setDir}
      />
    </DirectionProvider>
  );
}
