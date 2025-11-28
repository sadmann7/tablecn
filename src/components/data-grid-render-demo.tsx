"use client";

import { faker } from "@faker-js/faker";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { DataGrid } from "@/components/data-grid/data-grid";
import { Button } from "@/components/ui/button";
import { useDataGrid } from "@/hooks/use-data-grid";
import { getFilterFn } from "@/lib/data-grid-filters";

interface TestPerson {
  id: string;
  name?: string;
  age?: number;
  email?: string;
  salary?: number;
  department?: string;
}

faker.seed(123);

const departments = ["Engineering", "Marketing", "Sales", "HR", "Finance"];

function generatePerson(): TestPerson {
  return {
    id: faker.string.nanoid(8),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 22, max: 65 }),
    email: faker.internet.email().toLowerCase(),
    salary: faker.number.int({ min: 40000, max: 150000 }),
    department: faker.helpers.arrayElement(departments),
  };
}

const initialData: TestPerson[] = Array.from({ length: 100 }, () =>
  generatePerson(),
);

// Component to track renders
function RenderCounter({ label }: { label: string }) {
  const renderCount = React.useRef(0);
  renderCount.current++;

  return (
    <div className="text-muted-foreground text-xs">
      {label}: {renderCount.current} renders
    </div>
  );
}

export function DataGridRenderDemo() {
  const [data, setData] = React.useState<TestPerson[]>(initialData);
  const [renderStats, setRenderStats] = React.useState({
    componentRenders: 0,
    lastUpdateTime: 0,
    cellsUpdated: 0,
  });

  const componentRenderCount = React.useRef(0);
  componentRenderCount.current++;

  React.useEffect(() => {
    console.log(
      `%c[DataGridRenderTest] Component render #${componentRenderCount.current}`,
      "color: #ff6b6b; font-weight: bold;",
    );
  });

  const filterFn = React.useMemo(() => getFilterFn<TestPerson>(), []);

  const columns = React.useMemo<ColumnDef<TestPerson>[]>(
    () => [
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
            options: departments.map((dept) => ({
              label: dept,
              value: dept,
            })),
          },
        },
      },
    ],
    [filterFn],
  );

  const onDataChange = React.useCallback((newData: TestPerson[]) => {
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

  // Test functions to simulate AI autofill
  const updateSingleCell = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 1 CELL ==========`,
      "color: #ffd43b; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      table.options.meta.onDataUpdate({
        rowIndex: 0,
        columnId: "name",
        value: `Updated ${Date.now()}`,
      });

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 1,
      });
    }
  }, [table]);

  const update5Cells = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 5 CELLS ==========`,
      "color: #ffd43b; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      table.options.meta.onDataUpdate([
        { rowIndex: 0, columnId: "name", value: `Name ${Date.now()}` },
        { rowIndex: 0, columnId: "age", value: 25 },
        { rowIndex: 1, columnId: "name", value: `Name ${Date.now()}` },
        {
          rowIndex: 1,
          columnId: "email",
          value: `email${Date.now()}@test.com`,
        },
        { rowIndex: 2, columnId: "salary", value: 75000 },
      ]);

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 5,
      });
    }
  }, [table]);

  const update25Cells = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 25 CELLS ==========`,
      "color: #ffd43b; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      const updates = [];
      for (let i = 0; i < 25; i++) {
        updates.push({
          rowIndex: i,
          columnId: "name",
          value: `AI Generated ${i} - ${Date.now()}`,
        });
      }

      table.options.meta.onDataUpdate(updates);

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 25,
      });
    }
  }, [table]);

  const update100Cells = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 100 CELLS ==========`,
      "color: #ffd43b; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      const updates = [];
      for (let i = 0; i < 100; i++) {
        updates.push({
          rowIndex: i,
          columnId: "name",
          value: `AI Generated ${i} - ${Date.now()}`,
        });
      }

      table.options.meta.onDataUpdate(updates);

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 100,
      });
    }
  }, [table]);

  const updateMultipleColumns = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 50 CELLS (Multiple Columns) ==========`,
      "color: #ffd43b; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(
          { rowIndex: i, columnId: "name", value: `AI Name ${i}` },
          { rowIndex: i, columnId: "age", value: 20 + i },
          { rowIndex: i, columnId: "email", value: `ai${i}@example.com` },
          { rowIndex: i, columnId: "salary", value: 50000 + i * 1000 },
          {
            rowIndex: i,
            columnId: "department",
            value: departments[i % departments.length],
          },
        );
      }

      table.options.meta.onDataUpdate(updates);

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 50,
      });
    }
  }, [table]);

  const updateSequentially = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 10 CELLS SEQUENTIALLY (BAD) ==========`,
      "color: #ff6b6b; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      // BAD: Calling onDataUpdate multiple times
      for (let i = 0; i < 10; i++) {
        table.options.meta.onDataUpdate({
          rowIndex: i,
          columnId: "name",
          value: `Sequential ${i}`,
        });
      }

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 10,
      });
    }
  }, [table]);

  const updateBatched = React.useCallback(() => {
    console.log(
      `%c\n========== UPDATING 10 CELLS BATCHED (GOOD) ==========`,
      "color: #51cf66; font-size: 14px; font-weight: bold;",
    );
    const startTime = performance.now();

    if (table.options.meta?.onDataUpdate) {
      // GOOD: Single call with array of updates
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push({
          rowIndex: i,
          columnId: "name",
          value: `Batched ${i}`,
        });
      }
      table.options.meta.onDataUpdate(updates);

      const endTime = performance.now();
      setRenderStats({
        componentRenders: componentRenderCount.current,
        lastUpdateTime: endTime - startTime,
        cellsUpdated: 10,
      });
    }
  }, [table]);

  const [isSimulating, setIsSimulating] = React.useState(false);

  const simulateAIAutofill = React.useCallback(
    async (cellCount: number) => {
      if (isSimulating) return;

      console.log(
        `%c\n========== AI AUTOFILL: ${cellCount} CELLS ==========`,
        "color: #845ef7; font-size: 14px; font-weight: bold;",
      );
      setIsSimulating(true);
      const overallStartTime = performance.now();

      try {
        if (!table.options.meta?.onDataUpdate) return;

        // Calculate how many rows and which columns to update
        // Spread across multiple columns for realism
        const columnsToFill = ["name", "email", "department", "age"];
        const rowsCount = Math.ceil(cellCount / columnsToFill.length);

        // Phase 1: Mark cells as "Searching..." (simulating AI request sent)
        console.log(
          `%c[AI Phase 1] Marking ${cellCount} cells as "Searching..."`,
          "color: #845ef7;",
        );
        const searchingUpdates = [];
        let cellsAdded = 0;
        for (let row = 0; row < rowsCount && cellsAdded < cellCount; row++) {
          for (const col of columnsToFill) {
            if (cellsAdded >= cellCount) break;
            searchingUpdates.push({
              rowIndex: row,
              columnId: col,
              value: "🔍 Searching...",
            });
            cellsAdded++;
          }
        }
        table.options.meta.onDataUpdate(searchingUpdates);

        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Phase 2: Mark half as "Generating..." (simulating streaming AI response)
        const halfwayPoint = Math.floor(cellCount / 2);
        console.log(
          `%c[AI Phase 2] ${halfwayPoint} cells "Generating..."`,
          "color: #845ef7;",
        );
        const generatingUpdates = [];
        cellsAdded = 0;
        for (let row = 0; row < rowsCount && cellsAdded < halfwayPoint; row++) {
          for (const col of columnsToFill) {
            if (cellsAdded >= halfwayPoint) break;
            generatingUpdates.push({
              rowIndex: row,
              columnId: col,
              value: "✨ Generating...",
            });
            cellsAdded++;
          }
        }
        table.options.meta.onDataUpdate(generatingUpdates);

        await new Promise((resolve) => setTimeout(resolve, 600));

        // Phase 3: Update remaining cells to "Generating..."
        console.log(
          `%c[AI Phase 3] Remaining cells "Generating..."`,
          "color: #845ef7;",
        );
        const moreGeneratingUpdates = [];
        cellsAdded = 0;
        for (
          let row = Math.floor(halfwayPoint / columnsToFill.length);
          row < rowsCount && cellsAdded < cellCount - halfwayPoint;
          row++
        ) {
          for (const col of columnsToFill) {
            if (
              cellsAdded + halfwayPoint >= cellCount ||
              cellsAdded >= cellCount - halfwayPoint
            )
              break;
            // Skip cells already updated in phase 2
            const globalIndex =
              row * columnsToFill.length + columnsToFill.indexOf(col);
            if (globalIndex < halfwayPoint) continue;

            moreGeneratingUpdates.push({
              rowIndex: row,
              columnId: col,
              value: "✨ Generating...",
            });
            cellsAdded++;
          }
        }
        table.options.meta.onDataUpdate(moreGeneratingUpdates);

        await new Promise((resolve) => setTimeout(resolve, 400));

        // Phase 4: Start populating with AI results (simulate streaming)
        console.log(
          `%c[AI Phase 4] Populating with AI results...`,
          "color: #845ef7;",
        );

        // Simulate chunked streaming updates (like AI tokens arriving)
        const chunkSize = Math.max(5, Math.floor(cellCount / 10));
        cellsAdded = 0;
        for (let chunk = 0; chunk < Math.ceil(cellCount / chunkSize); chunk++) {
          const chunkUpdates = [];
          for (let i = 0; i < chunkSize && cellsAdded < cellCount; i++) {
            const globalIndex = chunk * chunkSize + i;
            const row = Math.floor(globalIndex / columnsToFill.length);
            const colIndex = globalIndex % columnsToFill.length;
            const col = columnsToFill[colIndex];

            if (!col || row >= rowsCount) break;

            let value: string | number;
            switch (col) {
              case "name":
                value = `AI Name ${row}`;
                break;
              case "email":
                value = `ai.generated.${row}@example.com`;
                break;
              case "department":
                value = departments[row % departments.length] ?? "Engineering";
                break;
              case "age":
                value = 25 + (row % 40);
                break;
              default:
                value = `AI Result ${row}`;
            }

            chunkUpdates.push({
              rowIndex: row,
              columnId: col,
              value,
            });
            cellsAdded++;
          }
          table.options.meta.onDataUpdate(chunkUpdates);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const overallEndTime = performance.now();
        console.log(
          `%c[AI Complete] Total time: ${(overallEndTime - overallStartTime).toFixed(2)}ms`,
          "color: #845ef7; font-weight: bold;",
        );

        setRenderStats({
          componentRenders: componentRenderCount.current,
          lastUpdateTime: overallEndTime - overallStartTime,
          cellsUpdated: cellCount,
        });
      } finally {
        setIsSimulating(false);
      }
    },
    [table, isSimulating],
  );

  const aiAutofill5 = React.useCallback(
    () => simulateAIAutofill(5),
    [simulateAIAutofill],
  );
  const aiAutofill25 = React.useCallback(
    () => simulateAIAutofill(25),
    [simulateAIAutofill],
  );
  const aiAutofill100 = React.useCallback(
    () => simulateAIAutofill(100),
    [simulateAIAutofill],
  );

  return (
    <div className="container flex flex-col gap-4 py-8">
      <div className="rounded-lg border bg-background">
        <div className="border-b p-6">
          <h2 className="font-semibold text-2xl">
            Data Grid Render Performance Test
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Test how many times components render when updating multiple cells
          </p>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 font-semibold text-sm">
                Basic Updates (Single Call)
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={updateSingleCell} variant="outline" size="sm">
                  Update 1 Cell
                </Button>
                <Button onClick={update5Cells} variant="outline" size="sm">
                  Update 5 Cells
                </Button>
                <Button onClick={update25Cells} variant="outline" size="sm">
                  Update 25 Cells
                </Button>
                <Button onClick={update100Cells} variant="outline" size="sm">
                  Update 100 Cells
                </Button>
                <Button
                  onClick={updateMultipleColumns}
                  variant="outline"
                  size="sm"
                >
                  Update 50 Cells (Multi-column)
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 font-semibold text-sm">
                Batched vs Sequential Updates
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={updateBatched}
                  variant="outline"
                  size="sm"
                  className="border-green-500 text-green-600 hover:bg-green-50"
                >
                  ✓ Batched (Good)
                </Button>
                <Button
                  onClick={updateSequentially}
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  ✗ Sequential (Bad)
                </Button>
              </div>
              <div className="mt-2 text-muted-foreground text-xs">
                Compare performance: batched updates should be much faster and
                cause fewer re-renders
              </div>
            </div>

            <div>
              <div className="mb-2 font-semibold text-sm">
                AI Autofill Simulation
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={aiAutofill5}
                  variant="outline"
                  size="sm"
                  disabled={isSimulating}
                  className="border-purple-500 text-purple-600 hover:bg-purple-50 disabled:opacity-50"
                >
                  {isSimulating ? "🤖 Running..." : "🤖 AI Autofill 5 Cells"}
                </Button>
                <Button
                  onClick={aiAutofill25}
                  variant="outline"
                  size="sm"
                  disabled={isSimulating}
                  className="border-purple-500 text-purple-600 hover:bg-purple-50 disabled:opacity-50"
                >
                  {isSimulating ? "🤖 Running..." : "🤖 AI Autofill 25 Cells"}
                </Button>
                <Button
                  onClick={aiAutofill100}
                  variant="outline"
                  size="sm"
                  disabled={isSimulating}
                  className="border-purple-500 text-purple-600 hover:bg-purple-50 disabled:opacity-50"
                >
                  {isSimulating ? "🤖 Running..." : "🤖 AI Autofill 100 Cells"}
                </Button>
              </div>
              <div className="mt-2 text-muted-foreground text-xs">
                Realistic AI workflow across <strong>multiple columns</strong>:
                idle → searching → generating → final values. Cells update in a
                scattered pattern across rows and columns, like real AI
                selection.
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="mb-2 font-semibold text-sm">Render Stats:</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Component Renders</div>
                <div className="font-bold text-2xl">
                  {renderStats.componentRenders}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Cells Updated</div>
                <div className="font-bold text-2xl">
                  {renderStats.cellsUpdated}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Update Time</div>
                <div className="font-bold text-2xl">
                  {renderStats.lastUpdateTime.toFixed(2)}ms
                </div>
              </div>
            </div>
            <div className="mt-4 text-muted-foreground text-xs">
              Open browser console to see detailed render logs
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <RenderCounter label="DataGridRenderTest" />
          </div>
        </div>
      </div>

      <DataGrid {...dataGridProps} table={table} height={600} />
    </div>
  );
}
