"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { parseAsStringEnum, useQueryState } from "nuqs";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { CellOpts } from "@/lib/data-grid-types";

import { useWindowSize } from "@/hooks/use-window-size";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { DataGridRowHeightMenu } from "@/registry/bases/radix/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { Skeleton } from "@/registry/bases/radix/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";

const ROW_COUNTS = {
  "100k": { label: "100k × 100", rowCount: 100_000, columnCount: 100 },
  "1m": { label: "1M × 100", rowCount: 1_000_000, columnCount: 100 },
} as const;

// Eager rows past this count would need several GB, so larger sizes generate cells on read
const EAGER_ROW_LIMIT = 100_000;

type RowCount = keyof typeof ROW_COUNTS;

const ROW_COUNT_KEYS = Object.keys(ROW_COUNTS) as RowCount[];

const STATUSES = ["Todo", "In Progress", "Review", "Done", "Blocked"];
const TAGS = ["React", "Rust", "Go", "Python", "Design", "Ops", "Data"];
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];

const COLUMN_VARIANTS: CellOpts[] = [
  { variant: "short-text" },
  { variant: "number" },
  {
    variant: "select",
    options: STATUSES.map((status) => ({ label: status, value: status })),
  },
  { variant: "checkbox" },
  {
    variant: "multi-select",
    options: TAGS.map((tag) => ({ label: tag, value: tag })),
  },
  { variant: "date" },
  { variant: "url" },
];

type StressRow = { id: string } & Record<
  string,
  string | number | boolean | string[]
>;

function getCellValue(variant: CellOpts["variant"] | undefined, seed: number) {
  switch (variant) {
    case "number":
      return (seed * 7919) % 100_000;
    case "select":
      return STATUSES[seed % STATUSES.length] ?? "";
    case "checkbox":
      return seed % 3 === 0;
    case "multi-select":
      return TAGS.filter((_, index) => (seed >> index) % 3 === 0).slice(0, 3);
    case "date":
      return new Date(Date.UTC(2024, seed % 12, (seed % 28) + 1))
        .toISOString()
        .slice(0, 10);
    case "url":
      return `https://${WORDS[seed % WORDS.length]}.example.com`;
    default:
      return `${WORDS[seed % WORDS.length]} ${seed}`;
  }
}

function getGeneratedValue(rowIndex: number, columnIndex: number) {
  const variant = COLUMN_VARIANTS[columnIndex % COLUMN_VARIANTS.length];
  return getCellValue(
    variant?.variant,
    (Math.imul(rowIndex + 1, 2_654_435_761) + columnIndex * 40_503) >>> 8,
  );
}

function generateRows(rowCount: number, columnCount: number): StressRow[] {
  if (rowCount > EAGER_ROW_LIMIT)
    return generateLazyRows(rowCount, columnCount);

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: StressRow = { id: `row-${rowIndex}` };
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      row[`col${columnIndex}`] = getGeneratedValue(rowIndex, columnIndex);
    }
    return row;
  });
}

const ROW_INDEX = Symbol("rowIndex");
const ROW_CACHE = Symbol("rowCache");

interface LazyRowTarget {
  id: string;
  [ROW_INDEX]: number;
  [ROW_CACHE]?: Map<number, StressRow[string]>;
}

function generateLazyRows(rowCount: number, columnCount: number) {
  const keys = [
    "id",
    ...Array.from({ length: columnCount }, (_, i) => `col${i}`),
  ];

  const getColumnIndex = (key: string | symbol) => {
    if (typeof key !== "string" || !key.startsWith("col")) return -1;
    const columnIndex = Number(key.slice(3));
    return Number.isInteger(columnIndex) && columnIndex < columnCount
      ? columnIndex
      : -1;
  };

  // Values are cached per row so cells keep stable references across renders
  const getValue = (target: LazyRowTarget, columnIndex: number) => {
    target[ROW_CACHE] ??= new Map();
    let value = target[ROW_CACHE].get(columnIndex);
    if (value === undefined) {
      value = getGeneratedValue(target[ROW_INDEX], columnIndex);
      target[ROW_CACHE].set(columnIndex, value);
    }
    return value;
  };

  // Edits copy rows with Object.entries, so every column reports as an own key
  const handler: ProxyHandler<LazyRowTarget> = {
    get(target, key) {
      const columnIndex = getColumnIndex(key);
      return columnIndex === -1
        ? Reflect.get(target, key)
        : getValue(target, columnIndex);
    },
    has(target, key) {
      return getColumnIndex(key) !== -1 || Reflect.has(target, key);
    },
    ownKeys() {
      return keys;
    },
    getOwnPropertyDescriptor(target, key) {
      const columnIndex = getColumnIndex(key);
      if (columnIndex === -1)
        return Reflect.getOwnPropertyDescriptor(target, key);
      return {
        value: getValue(target, columnIndex),
        enumerable: true,
        configurable: true,
        writable: true,
      };
    },
  };

  return Array.from(
    { length: rowCount },
    (_, rowIndex) =>
      new Proxy<LazyRowTarget>(
        { id: `row-${rowIndex}`, [ROW_INDEX]: rowIndex },
        handler,
      ) as unknown as StressRow,
  );
}

interface StressData {
  rowCount: RowCount;
  rows: StressRow[];
}

export function DataGridStressDemo() {
  const [rowCount, setRowCount] = useQueryState(
    "rowCount",
    parseAsStringEnum(ROW_COUNT_KEYS)
      .withDefault("100k")
      .withOptions({ clearOnDefault: true }),
  );
  const [data, setData] = React.useState<StressData | null>(null);
  const windowSize = useWindowSize({ defaultHeight: 760 });
  const height = Math.max(400, windowSize.height - 150);

  // Generation blocks for seconds, so it runs after the toggle and skeleton have painted
  React.useEffect(() => {
    let timeout = 0;
    const frame = requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        const { rowCount: count, columnCount } = ROW_COUNTS[rowCount];
        setData({ rowCount, rows: generateRows(count, columnCount) });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [rowCount]);

  const rowCountToggle = (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Row count"
      value={rowCount}
      onValueChange={(value) => {
        const next = ROW_COUNT_KEYS.find((key) => key === value);
        if (next) void setRowCount(next);
      }}
    >
      {ROW_COUNT_KEYS.map((key) => (
        <ToggleGroupItem key={key} value={key}>
          {ROW_COUNTS[key].label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  if (data?.rowCount !== rowCount) {
    return (
      <div className="container flex flex-col gap-4 py-4">
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex items-center gap-2 self-end"
        >
          {rowCountToggle}
          <Skeleton className="h-7 w-20" />
        </div>
        <Skeleton className="w-full" style={{ height }} />
      </div>
    );
  }

  return (
    <DataGridStress
      key={data.rowCount}
      initialRows={data.rows}
      columnCount={ROW_COUNTS[data.rowCount].columnCount}
      height={height}
      toolbar={rowCountToggle}
    />
  );
}

interface DataGridStressProps {
  initialRows: StressRow[];
  columnCount: number;
  height: number;
  toolbar: React.ReactNode;
}

function DataGridStress({
  initialRows,
  columnCount,
  height,
  toolbar,
}: DataGridStressProps) {
  const [data, setData] = React.useState(initialRows);

  const columns = React.useMemo<ColumnDef<DataGridFeatures, StressRow>[]>(
    () => [
      getDataGridSelectColumn<StressRow>({ enableRowMarkers: true }),
      ...Array.from({ length: columnCount }, (_, columnIndex) => {
        const id = `col${columnIndex}`;
        const cell =
          COLUMN_VARIANTS[columnIndex % COLUMN_VARIANTS.length] ??
          ({ variant: "short-text" } satisfies CellOpts);
        return {
          id,
          accessorKey: id,
          header: `Column ${columnIndex + 1}`,
          size: 160,
          meta: { label: `Column ${columnIndex + 1}`, cell },
        } satisfies ColumnDef<DataGridFeatures, StressRow>;
      }),
    ],
    [columnCount],
  );

  const { table, ...dataGridProps } = useDataGrid({
    data,
    columns,
    onDataChange: setData,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: { start: ["select"], end: [] },
    },
  });

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        {toolbar}
        <DataGridRowHeightMenu table={table} align="end" />
      </div>
      <DataGrid {...dataGridProps} table={table} height={height} />
    </div>
  );
}
