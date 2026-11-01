"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { cn } from "cn";
import { Copy, Languages, Rows2, Rows3, Rows4, Trash2 } from "lucide-react";
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
  useDataGrid,
  type UseDataGridProps,
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

import { duplicateRows } from "../lib/duplicate-rows";
import {
  departments,
  generatePeople,
  type Person,
  skills,
  statuses,
} from "../lib/seeds";
import { worstCasePeople } from "../lib/worst-case";
import { DataGridBenchmark } from "./data-grid-benchmark";
import { DataGridDemoSkeleton } from "./data-grid-demo-skeleton";
import { PeopleDataGridActionBar } from "./people-data-grid-action-bar";

const rowCounts = [
  { value: "10k", count: 10_000, icon: Rows2 },
  { value: "100k", count: 100_000, icon: Rows3 },
  { value: "500k", count: 500_000, icon: Rows4 },
] as const;

type RowCount = (typeof rowCounts)[number]["value"];

const dataModes = [
  { value: "demo", label: "Demo data" },
  { value: "worst", label: "Worst case" },
  { value: "empty", label: "Empty" },
  { value: "one", label: "One" },
] as const;

type DataMode = (typeof dataModes)[number]["value"];

const isDev = process.env.NODE_ENV === "development";

interface Dataset {
  key: string;
  rows: Person[];
}

export function DataGridDemo() {
  const [rowCount, setRowCount] = useQueryState(
    "rowCount",
    parseAsStringEnum(rowCounts.map((option) => option.value))
      .withDefault("100k")
      .withOptions({ clearOnDefault: true }),
  );
  const [dataMode, setDataMode] = useQueryState(
    "data",
    parseAsStringEnum<DataMode>(dataModes.map((mode) => mode.value)),
  );
  const [dataset, setDataset] = React.useState<Dataset | null>(null);
  const datasetKey = `${dataMode}-${rowCount}`;

  // Generating hundreds of thousands of rows takes a moment, so it runs after the skeleton has painted
  React.useEffect(() => {
    let timeout = 0;
    const frame = requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        setDataset({
          key: datasetKey,
          rows: getRows(dataMode ?? "demo", rowCount),
        });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [datasetKey, dataMode, rowCount]);

  const selectedRowCount = getRowCountOption(rowCount);
  const rowCountSelect = (
    <Select
      value={rowCount}
      onValueChange={(value) => {
        const option = rowCounts.find((item) => item.value === value);
        if (option) void setRowCount(option.value);
      }}
    >
      <SelectTrigger
        aria-label="Row count"
        className="[&_svg:nth-child(2)]:hidden"
      >
        <SelectValue>
          <selectedRowCount.icon />
          {selectedRowCount.value} rows
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {rowCounts.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <option.icon />
              {option.value} rows
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const dataModeToggle =
    isDev && dataMode ? (
      <DataModeToggle
        value={dataMode}
        onValueChange={(value) => void setDataMode(value)}
      />
    ) : null;

  if (dataset?.key !== datasetKey) {
    return (
      <>
        <DataGridDemoSkeleton rowCountSelect={rowCountSelect} />
        {dataModeToggle}
      </>
    );
  }

  return (
    <>
      <DataGridDemoContent
        key={dataset.key}
        initialData={dataset.rows}
        rowCountSelect={rowCountSelect}
      />
      {dataModeToggle}
    </>
  );
}

function getRows(dataMode: DataMode, rowCount: RowCount) {
  if (!isDev || dataMode === "demo") {
    return generatePeople(getRowCountOption(rowCount).count);
  }
  if (dataMode === "worst") return worstCasePeople;
  if (dataMode === "one") return worstCasePeople.slice(0, 1);
  return [];
}

function getRowCountOption(value: RowCount) {
  return rowCounts.find((option) => option.value === value) ?? rowCounts[1];
}

interface DataModeToggleProps {
  value: DataMode;
  onValueChange: (value: DataMode) => void;
}

function DataModeToggle({ value, onValueChange }: DataModeToggleProps) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-0.5 rounded-full border border-input bg-background p-0.5 font-sans text-xs shadow-sm">
      {dataModes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={mode.value === value}
          className={cn(
            "rounded-full px-3 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            mode.value === value && "bg-muted text-foreground",
          )}
          onClick={() => onValueChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

const columnHelper = createColumnHelper<DataGridFeatures, Person>();

interface DataGridDemoContentProps {
  initialData: Person[];
  rowCountSelect: React.ReactNode;
}

function DataGridDemoContent({
  initialData,
  rowCountSelect,
}: DataGridDemoContentProps) {
  const [data, setData] = React.useState<Person[]>(initialData);
  const [dir, setDir] = React.useState<Direction>("ltr");
  const windowSize = useWindowSize({ defaultHeight: 760 });

  const filterFn = React.useMemo(() => getFilterFn<Person>(), []);

  const columns = React.useMemo(() => {
    return columnHelper.columns([
      getDataGridSelectColumn<Person>({ enableRowMarkers: true }),
      columnHelper.accessor("name", {
        id: "name",
        header: "Name",
        minSize: 180,
        filterFn,
        meta: {
          label: "Name",
          variant: "text",
        },
      }),
      columnHelper.accessor("age", {
        id: "age",
        header: "Age",
        minSize: 100,
        filterFn,
        meta: {
          label: "Age",
          variant: "number",
          min: 18,
          max: 100,
          step: 1,
        },
      }),
      columnHelper.accessor("email", {
        id: "email",
        header: "Email",
        minSize: 240,
        filterFn,
        meta: {
          label: "Email",
          variant: "text",
        },
      }),
      columnHelper.accessor("feedback", {
        id: "feedback",
        header: "Feedback",
        minSize: 200,
        filterFn,
        meta: {
          label: "Feedback",
          variant: "long-text",
        },
      }),
      columnHelper.accessor("department", {
        id: "department",
        header: "Department",
        minSize: 180,
        filterFn,
        meta: {
          label: "Department",
          variant: "select",
          options: departments.map((dept) => ({
            label: dept,
            value: dept,
          })),
        },
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: "Status",
        minSize: 180,
        filterFn,
        meta: {
          label: "Status",
          variant: "select",
          options: statuses.map((status) => ({
            label: status,
            value: status,
          })),
        },
      }),
      columnHelper.accessor("skills", {
        id: "skills",
        header: "Skills",
        minSize: 240,
        filterFn,
        meta: {
          label: "Skills",
          variant: "multi-select",
          options: skills.map((skill) => ({
            label: skill,
            value: skill,
          })),
        },
      }),
      columnHelper.accessor("startDate", {
        id: "startDate",
        header: "Start Date",
        minSize: 150,
        filterFn,
        meta: {
          label: "Start Date",
          variant: "date",
        },
      }),
      columnHelper.accessor("salary", {
        id: "salary",
        header: "Salary",
        minSize: 180,
        filterFn,
        meta: {
          label: "Salary",
          variant: "number",
          min: 0,
          step: 1000,
          format: {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          },
        },
      }),
      columnHelper.accessor("isActive", {
        id: "isActive",
        header: "Active",
        minSize: 140,
        filterFn,
        meta: {
          label: "Active",
          variant: "boolean",
        },
      }),
      columnHelper.accessor("website", {
        id: "website",
        header: "Website",
        minSize: 240,
        filterFn,
        meta: {
          label: "Website",
          variant: "url",
        },
      }),
      columnHelper.accessor("attachments", {
        id: "attachments",
        header: "Attachments",
        minSize: 240,
        filterFn,
        meta: {
          label: "Attachments",
          variant: "file",
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          accept:
            "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
          multiple: true,
        },
      }),
      getDataGridActionsColumn<Person>({
        actions: ({ row, table }) => (
          <>
            <DropdownMenuItem onSelect={() => duplicateRows(table, [row])}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => table.deleteRows([row.id])}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        ),
      }),
    ]);
  }, [filterFn]);

  const createRow: NonNullable<UseDataGridProps<Person>["createRow"]> =
    React.useCallback(() => ({ id: generateId() }), []);

  const uploadFiles: NonNullable<UseDataGridProps<Person>["uploadFiles"]> =
    React.useCallback(async ({ files }) => {
      await new Promise((resolve) => setTimeout(resolve, 800));

      return files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));
    }, []);

  const deleteFiles: NonNullable<UseDataGridProps<Person>["deleteFiles"]> =
    React.useCallback(async ({ fileIds, rowId, columnId }) => {
      console.log(
        `Deleting ${fileIds.length} file(s) from row ${rowId}, column ${columnId}:`,
        fileIds,
      );
    }, []);

  const height = Math.max(400, windowSize.height - 150);

  const { table, ...dataGridProps } = useDataGrid({
    data,
    columns,
    getRowId: (row) => row.id,
    onDataChange: setData,
    createRow,
    uploadFiles,
    deleteFiles,
    initialState: {
      columnPinning: {
        start: ["select"],
        end: ["actions"],
      },
    },
    dir,
    enableRowDeletion: true,
    enableSearch: true,
    enablePaste: true,
  });

  return (
    <DirectionProvider dir={dir}>
      <div className="container flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {rowCountSelect}
          <div
            role="toolbar"
            aria-orientation="horizontal"
            className="flex flex-wrap items-center gap-2"
          >
            <DataGridBenchmark
              table={table}
              dataGridRef={dataGridProps.dataGridRef}
            />
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
        </div>
        <DataGridKeyboardShortcuts
          enableSearch
          enableUndoRedo
          enablePaste
          enableRowCreation
          enableRowDeletion
        />
        <DataGrid
          {...dataGridProps}
          table={table}
          height={height}
          actionBar={<PeopleDataGridActionBar table={table} />}
        />
      </div>
    </DirectionProvider>
  );
}
