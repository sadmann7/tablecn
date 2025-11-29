"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader, RocketIcon, SquarePen } from "lucide-react";
import * as React from "react";
import { DataGrid } from "@/components/data-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDataGrid } from "@/hooks/use-data-grid";
import { getFilterFn } from "@/lib/data-grid-filters";
import type { UpdateCell } from "@/types/data-grid";

interface Person {
  id: string;
  name?: string;
  age?: number;
  email?: string;
  salary?: number;
  department?: string;
}

const DEPARTMENTS = ["Engineering", "Marketing", "Sales", "HR", "Finance"];
const NAME_PREFIXES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley"];
const EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
];
const CELL_COUNT_OPTIONS = [1, 5, 10, 25, 50, 100, 250, 500];

faker.seed(123);

function generatePerson(): Person {
  return {
    id: faker.string.nanoid(8),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 22, max: 65 }),
    email: faker.internet.email().toLowerCase(),
    salary: faker.number.int({ min: 40000, max: 150000 }),
    department: faker.helpers.arrayElement(DEPARTMENTS),
  };
}

const initialData: Person[] = Array.from({ length: 100 }, () =>
  generatePerson(),
);

export function DataGridRenderDemo() {
  const [data, setData] = React.useState<Person[]>(initialData);
  const [renderStats, setRenderStats] = React.useState({
    componentRenders: 0,
    lastUpdateTime: 0,
    cellsUpdated: 0,
  });
  const [cellCount, setCellCount] = React.useState(50);
  const [isUpdatePending, startUpdateTransition] = React.useTransition();
  const [isRapidUpdating, setIsRapidUpdating] = React.useState(false);

  const componentRenderCount = React.useRef(0);
  componentRenderCount.current++;

  const updateCycleRef = React.useRef(0);

  React.useEffect(() => {
    console.log(
      `%c[DataGridRenderTest] Component render #${componentRenderCount.current}`,
      "color: #ff6b6b; font-weight: bold;",
    );
  });

  const filterFn = React.useMemo(() => getFilterFn<Person>(), []);

  const columns = React.useMemo<ColumnDef<Person>[]>(
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
            options: DEPARTMENTS.map((dept) => ({
              label: dept,
              value: dept,
            })),
          },
        },
      },
    ],
    [filterFn],
  );

  const onDataChange = React.useCallback((newData: Person[]) => {
    setData(newData);
  }, []);

  const { table, ...dataGridProps } = useDataGrid({
    columns,
    data,
    onDataChange,
    getRowId: (row) => row.id,
    enableSearch: true,
    enablePaste: true,
  });

  const onCellsUpdate = React.useCallback(
    (count: number) => {
      startUpdateTransition(() => {
        const cycle = updateCycleRef.current++;
        console.log(
          `%c\n========== UPDATING ${count} CELLS (cycle ${cycle}) ==========`,
          "color: #ffd43b; font-size: 14px; font-weight: bold;",
        );
        const startTime = performance.now();

        if (table.options.meta?.onDataUpdate) {
          const columnsToFill = [
            "name",
            "email",
            "department",
            "age",
            "salary",
          ] as const;
          const updates: UpdateCell[] = [];
          for (let i = 0; i < count; i++) {
            const rowIndex = Math.floor(i / columnsToFill.length);
            const colIndex = i % columnsToFill.length;
            const col = columnsToFill[colIndex];

            if (!col) continue;

            let value: string | number;
            switch (col) {
              case "name":
                value = `${NAME_PREFIXES[(rowIndex + cycle) % NAME_PREFIXES.length]} ${rowIndex + 1}`;
                break;
              case "email":
                value = `user${rowIndex + 1}@${EMAIL_DOMAINS[(rowIndex + cycle) % EMAIL_DOMAINS.length]}`;
                break;
              case "department":
                value =
                  DEPARTMENTS[(rowIndex + cycle) % DEPARTMENTS.length] ??
                  "Engineering";
                break;
              case "age":
                value = 22 + ((rowIndex + cycle * 7) % 43);
                break;
              case "salary":
                value = 40000 + ((rowIndex + cycle) % 20) * 5000;
                break;
            }

            updates.push({
              rowIndex,
              columnId: col,
              value,
            });
          }

          table.options.meta.onDataUpdate(updates);

          const endTime = performance.now();
          setRenderStats({
            componentRenders: componentRenderCount.current,
            lastUpdateTime: endTime - startTime,
            cellsUpdated: count,
          });
        }
      });
    },
    [table],
  );

  const onRapidCellsUpdate = React.useCallback(
    async (count: number) => {
      if (isRapidUpdating) return;

      console.log(
        `%c\n========== RAPID UPDATE: ${count} CELLS ==========`,
        "color: #845ef7; font-size: 14px; font-weight: bold;",
      );
      setIsRapidUpdating(true);
      const overallStartTime = performance.now();

      try {
        if (!table.options.meta?.onDataUpdate) return;

        const columnsToFill = [
          "name",
          "email",
          "department",
          "age",
          "salary",
        ] as const;
        const rowsCount = Math.ceil(count / columnsToFill.length);

        // Helper to build updates for a given range
        function buildUpdates(
          startCell: number,
          endCell: number,
          getValue: (
            row: number,
            col: (typeof columnsToFill)[number],
          ) => string | number,
        ) {
          const updates: UpdateCell[] = [];
          for (let i = startCell; i < endCell; i++) {
            const rowIndex = Math.floor(i / columnsToFill.length);
            const colIndex = i % columnsToFill.length;
            const col = columnsToFill[colIndex];
            if (!col || rowIndex >= rowsCount) continue;
            updates.push({
              rowIndex,
              columnId: col,
              value: getValue(rowIndex, col),
            });
          }
          return updates;
        }

        // Phase 1: Mark all cells as "Searching..."
        console.log(
          `%c[Phase 1] Marking ${count} cells as "Searching..."`,
          "color: #845ef7;",
        );
        const searchingUpdates = buildUpdates(
          0,
          count,
          () => "🔍 Searching...",
        );
        table.options.meta.onDataUpdate(searchingUpdates);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Phase 2: Mark cells as "Generating..."
        console.log(
          `%c[Phase 2] Marking cells as "Generating..."`,
          "color: #845ef7;",
        );
        const generatingUpdates = buildUpdates(
          0,
          count,
          () => "✨ Generating...",
        );
        table.options.meta.onDataUpdate(generatingUpdates);
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Phase 3: Mark cells as "Processing..."
        console.log(
          `%c[Phase 3] Marking cells as "Processing..."`,
          "color: #845ef7;",
        );
        const processingUpdates = buildUpdates(
          0,
          count,
          () => "⚙️ Processing...",
        );
        table.options.meta.onDataUpdate(processingUpdates);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Phase 4: Stream final values in chunks
        console.log(`%c[Phase 4] Streaming final values...`, "color: #845ef7;");
        const chunkSize = Math.max(5, Math.floor(count / 10));
        const cycle = updateCycleRef.current++;
        for (let chunk = 0; chunk < Math.ceil(count / chunkSize); chunk++) {
          const startIdx = chunk * chunkSize;
          const endIdx = Math.min(startIdx + chunkSize, count);

          const chunkUpdates = buildUpdates(startIdx, endIdx, (row, col) => {
            switch (col) {
              case "name":
                return `${NAME_PREFIXES[(row + cycle) % NAME_PREFIXES.length]} ${row + 1}`;
              case "email":
                return `user${row + 1}@${EMAIL_DOMAINS[(row + cycle) % EMAIL_DOMAINS.length]}`;
              case "department":
                return (
                  DEPARTMENTS[(row + cycle) % DEPARTMENTS.length] ??
                  "Engineering"
                );
              case "age":
                return 22 + ((row + cycle * 7) % 43);
              case "salary":
                return 40000 + ((row + cycle) % 20) * 5000;
            }
          });

          table.options.meta.onDataUpdate(chunkUpdates);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const overallEndTime = performance.now();
        console.log(
          `%c[Rapid Update Complete] Total time: ${(overallEndTime - overallStartTime).toFixed(2)}ms`,
          "color: #845ef7; font-weight: bold;",
        );

        setRenderStats({
          componentRenders: componentRenderCount.current,
          lastUpdateTime: overallEndTime - overallStartTime,
          cellsUpdated: count,
        });
      } finally {
        setIsRapidUpdating(false);
      }
    },
    [table, isRapidUpdating],
  );

  return (
    <div className="container flex flex-col gap-4 py-8">
      <div className="rounded-lg border bg-background">
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h2 className="font-semibold text-2xl">
              Data Grid Render Performance Test
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Test how many times components render when updating multiple cells
            </p>
          </div>
          <Select
            value={String(cellCount)}
            onValueChange={(value) => setCellCount(Number(value))}
          >
            <SelectTrigger className="w-22">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Select cell count</SelectLabel>
                {CELL_COUNT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCellsUpdate(cellCount)}
              disabled={isUpdatePending}
            >
              {isUpdatePending ? (
                <Loader className="animate-spin" />
              ) : (
                <SquarePen />
              )}
              Update
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRapidCellsUpdate(cellCount)}
              disabled={isRapidUpdating}
            >
              {isRapidUpdating ? (
                <Loader className="animate-spin" />
              ) : (
                <RocketIcon />
              )}
              Rapid update
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="text-muted-foreground">Renders:</span>
              <span className="tabular-nums">
                {renderStats.componentRenders}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="text-muted-foreground">Cells updated:</span>
              <span className="tabular-nums">{renderStats.cellsUpdated}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="text-muted-foreground">Time:</span>
              <span className="tabular-nums">
                {renderStats.lastUpdateTime.toFixed(1)}ms
              </span>
            </div>
          </div>
        </div>
      </div>
      <DataGrid {...dataGridProps} table={table} height={600} />
    </div>
  );
}
