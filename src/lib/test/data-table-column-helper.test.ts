import { describe, expect, expectTypeOf, it } from "vitest";

import { createDataTableColumnHelper } from "@/lib/data-table-column-helper";
import { defineDataTable } from "@/lib/data-table-definition";

interface Task {
  id: string;
  code: string;
  status: "todo" | "done";
  estimatedHours: number;
}

const tasksTable = defineDataTable({
  columns: {
    code: { enableSorting: false },
    status: { variant: "multi-select" },
    estimatedHours: { variant: "number", filter: "range" },
  },
});

const columnHelper = createDataTableColumnHelper<Task>()(tasksTable);

describe("createDataTableColumnHelper", () => {
  it("names the column once and applies its config", () => {
    expect(columnHelper.accessor("code", { header: "Task" })).toEqual({
      id: "code",
      accessorKey: "code",
      header: "Task",
      meta: {},
      enableColumnFilter: false,
      enableSorting: false,
    });
  });

  it("merges display meta under the config's variant", () => {
    const column = columnHelper.accessor("estimatedHours", {
      meta: { label: "Est. Hours", unit: "hr", max: 24 },
    });

    expect(column).toMatchObject({
      meta: {
        label: "Est. Hours",
        unit: "hr",
        max: 24,
        variant: "number",
        filter: "range",
      },
      enableColumnFilter: true,
      enableSorting: true,
    });
  });

  it("types the cell value and the meta by column", () => {
    columnHelper.accessor("status", {
      cell: ({ cell }) => {
        expectTypeOf(cell.getValue()).toEqualTypeOf<"todo" | "done">();
        return null;
      },
      meta: { options: [{ label: "Todo", value: "todo" }] },
    });
    columnHelper.accessor("code", {
      // @ts-expect-error options only exist on select columns
      meta: { options: [] },
    });
    // @ts-expect-error the definition has no id column
    columnHelper.accessor("id", {});
    columnHelper.accessor("status", {
      // @ts-expect-error the definition owns the sorting flag
      enableSorting: false,
    });
  });

  it("keeps the rest of the TanStack column helper", () => {
    const columns = columnHelper.columns([
      columnHelper.accessor("code", {}),
      columnHelper.display({ id: "actions" }),
    ]);

    expect(columns.map((column) => column.id)).toEqual(["code", "actions"]);
  });
});
