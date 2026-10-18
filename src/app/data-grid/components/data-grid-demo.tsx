"use client";

import type { ColumnDef, Table } from "@tanstack/react-table";

import {
  Copy,
  Languages,
  type LucideIcon,
  Rows2,
  Rows3,
  Rows4,
  Trash2,
} from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { Direction } from "@/lib/data-grid-types";

import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridActionsColumn } from "@/registry/bases/radix/components/data-grid/data-grid-actions-column";
import { DataGridFilterMenu } from "@/registry/bases/radix/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/registry/bases/radix/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/registry/bases/radix/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/registry/bases/radix/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/registry/bases/radix/components/data-grid/data-grid-view-menu";
import {
  type UseDataGridProps,
  useDataGrid,
} from "@/registry/bases/radix/hooks/use-data-grid";
import { DirectionProvider } from "@/registry/bases/radix/ui/direction";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/radix/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/radix/ui/select";
import { Toggle } from "@/registry/bases/radix/ui/toggle";

import {
  departments,
  generatePeople,
  type Person,
  skills,
  statuses,
} from "../lib/seeds";
import { DataGridBenchmark } from "./data-grid-benchmark";
import { DataGridDemoSkeleton } from "./data-grid-demo-skeleton";
import { PeopleGridActionBar } from "./people-grid-action-bar";

const ROW_COUNTS = {
  "10k": 10_000,
  "100k": 100_000,
  "500k": 500_000,
} as const;
type RowCount = keyof typeof ROW_COUNTS;
const ROW_COUNT_KEYS = Object.keys(ROW_COUNTS) as RowCount[];
const ROW_COUNT_ICONS: Record<RowCount, LucideIcon> = {
  "10k": Rows2,
  "100k": Rows3,
  "500k": Rows4,
};

interface DataGridDemoContentProps {
  initialRows: Person[];
  rowCountSelect: React.ReactNode;
}

function DataGridDemoContent({
  initialRows,
  rowCountSelect,
}: DataGridDemoContentProps) {
  const [data, setData] = React.useState<Person[]>(initialRows);
  const [dir, setDir] = React.useState<Direction>("ltr");
  const windowSize = useWindowSize({ defaultHeight: 760 });

  const filterFn = React.useMemo(() => getFilterFn<Person>(), []);

  // Duplicating is an app action, so it records its rows for undo through the table
  const tableRef = React.useRef<Table<DataGridFeatures, Person> | null>(null);

  const onRowsDuplicate = React.useCallback((rows: Person[]) => {
    const copies = new Map(
      rows.map((row) => [row.id, { ...row, id: generateId() }]),
    );

    setData((prev) =>
      prev.flatMap((row) => {
        const copy = copies.get(row.id);
        return copy ? [row, copy] : [row];
      }),
    );
    tableRef.current?.recordRowsAdd(
      [...copies.values()].map((copy) => copy.id),
    );
  }, []);

  const columns = React.useMemo<ColumnDef<DataGridFeatures, Person>[]>(() => {
    const dataColumns: ColumnDef<DataGridFeatures, Person>[] = [
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
        id: "feedback",
        accessorKey: "feedback",
        header: "Feedback",
        minSize: 200,
        filterFn,
        meta: {
          label: "Feedback",
          cell: {
            variant: "long-text",
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
    ];

    return [
      getDataGridSelectColumn<Person>({ enableRowMarkers: true }),
      ...dataColumns,
      getDataGridActionsColumn<Person>({
        actions: ({ row, table }) => (
          <>
            <DropdownMenuItem onSelect={() => onRowsDuplicate([row.original])}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void table.deleteRows([row.id])}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        ),
      }),
    ];
  }, [filterFn, onRowsDuplicate]);

  const onRowAdd: NonNullable<UseDataGridProps<Person>["onRowAdd"]> =
    React.useCallback(() => {
      const newRow: Person = {
        id: generateId(),
      };

      setData((prev) => [...prev, newRow]);

      return {
        rowId: newRow.id,
        columnId: "name",
      };
    }, []);

  const onRowsAdd: NonNullable<UseDataGridProps<Person>["onRowsAdd"]> =
    React.useCallback((count: number) => {
      const newRows: Person[] = Array.from({ length: count }, () => ({
        id: generateId(),
      }));

      setData((prev) => [...prev, ...newRows]);
    }, []);

  const onRowsDelete: NonNullable<UseDataGridProps<Person>["onRowsDelete"]> =
    React.useCallback((rows) => {
      const deleted = new Set(rows);
      setData((prev) => prev.filter((row) => !deleted.has(row)));
    }, []);

  const onFilesUpload: NonNullable<UseDataGridProps<Person>["onFilesUpload"]> =
    React.useCallback(async ({ files, rowId: _rowId, columnId: _columnId }) => {
      await new Promise((resolve) => setTimeout(resolve, 800));

      return files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));
    }, []);

  const onFilesDelete: NonNullable<UseDataGridProps<Person>["onFilesDelete"]> =
    React.useCallback(async ({ fileIds, rowId, columnId }) => {
      console.log(
        `Deleting ${fileIds.length} file(s) from row ${rowId}, column ${columnId}:`,
        fileIds,
      );
    }, []);

  const height = Math.max(400, windowSize.height - 150);

  const { table, ...dataGridProps } = useDataGrid({
    data,
    onDataChange: setData,
    columns,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    onFilesUpload,
    onFilesDelete,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: {
        start: ["select"],
        end: ["actions"],
      },
    },
    dir,
    enableSearch: true,
    enablePaste: true,
    enableUndoRedo: true,
  });
  tableRef.current = table;

  return (
    <DirectionProvider dir={dir}>
      <div className="container flex flex-col gap-4 py-4">
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex items-center gap-2 self-end"
        >
          <DataGridBenchmark
            table={table}
            dataGridRef={dataGridProps.dataGridRef}
          />
          {rowCountSelect}
          <Toggle
            aria-label="Toggle text direction"
            dir={dir}
            variant="outline"
            className="bg-background dark:bg-input/30 dark:hover:bg-input/50"
            pressed={dir === "rtl"}
            onPressedChange={(pressed) => setDir(pressed ? "rtl" : "ltr")}
          >
            <Languages className="text-muted-foreground" />
            {dir === "ltr" ? "LTR" : "RTL"}
          </Toggle>
          <DataGridFilterMenu table={table} align="end" />
          <DataGridSortMenu table={table} align="end" />
          <DataGridRowHeightMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
        <DataGridKeyboardShortcuts
          enableSearch
          enableUndoRedo
          enablePaste
          enableRowAdd
          enableRowsDelete
        />
        <DataGrid
          {...dataGridProps}
          table={table}
          height={height}
          actionBar={
            <PeopleGridActionBar
              table={table}
              onRowsDuplicate={onRowsDuplicate}
            />
          }
        />
      </div>
    </DirectionProvider>
  );
}

interface Dataset {
  rowCount: RowCount;
  rows: Person[];
}

export function DataGridDemo() {
  const [rowCount, setRowCount] = useQueryState(
    "rowCount",
    parseAsStringEnum(ROW_COUNT_KEYS)
      .withDefault("100k")
      .withOptions({ clearOnDefault: true }),
  );
  const [dataset, setDataset] = React.useState<Dataset | null>(null);

  // Generating hundreds of thousands of rows takes a moment, so it runs after the skeleton has painted
  React.useEffect(() => {
    let timeout = 0;
    const frame = requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        setDataset({ rowCount, rows: generatePeople(ROW_COUNTS[rowCount]) });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [rowCount]);

  const RowCountIcon = ROW_COUNT_ICONS[rowCount];
  const rowCountSelect = (
    <>
      <Select
        value={rowCount}
        onValueChange={(value) => {
          const next = ROW_COUNT_KEYS.find((key) => key === value);
          if (next) void setRowCount(next);
        }}
      >
        <SelectTrigger
          aria-label="Row count"
          className="[&_svg:nth-child(2)]:hidden"
        >
          <SelectValue>
            <RowCountIcon />
            {rowCount} rows
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {ROW_COUNT_KEYS.map((key) => {
              const Icon = ROW_COUNT_ICONS[key];
              return (
                <SelectItem key={key} value={key}>
                  <Icon />
                  {key} rows
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );

  if (dataset?.rowCount !== rowCount) {
    return <DataGridDemoSkeleton rowCountSelect={rowCountSelect} />;
  }

  return (
    <DataGridDemoContent
      key={dataset.rowCount}
      initialRows={dataset.rows}
      rowCountSelect={rowCountSelect}
    />
  );
}
