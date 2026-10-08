"use client";

import type { ColumnDef } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { CellOpts } from "@/lib/data-grid-types";

import { useWindowSize } from "@/hooks/use-window-size";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";

const ROW_COUNT = 100_000;
const COLUMN_COUNT = 50;

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

function generateRows(): StressRow[] {
  return Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
    const row: StressRow = { id: `row-${rowIndex}` };
    for (let columnIndex = 0; columnIndex < COLUMN_COUNT; columnIndex++) {
      const variant = COLUMN_VARIANTS[columnIndex % COLUMN_VARIANTS.length];
      row[`col${columnIndex}`] = getCellValue(
        variant?.variant,
        (Math.imul(rowIndex + 1, 2_654_435_761) + columnIndex * 40_503) >>> 8,
      );
    }
    return row;
  });
}

export function DataGridStressDemo() {
  const [data, setData] = React.useState(generateRows);
  const windowSize = useWindowSize({ defaultHeight: 760 });

  const columns = React.useMemo<ColumnDef<DataGridFeatures, StressRow>[]>(
    () => [
      getDataGridSelectColumn<StressRow>({ enableRowMarkers: true }),
      ...Array.from({ length: COLUMN_COUNT }, (_, columnIndex) => {
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
    [],
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
      <DataGrid
        {...dataGridProps}
        table={table}
        height={Math.max(400, windowSize.height - 100)}
      />
    </div>
  );
}
