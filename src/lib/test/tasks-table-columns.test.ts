import { describe, expect, it, vi } from "vitest";

import { getTasksTableColumns } from "@/app/components/tasks-table-columns";
import { tasksColumns } from "@/app/lib/validations";
import { getFilterableColumns, getSortableColumns } from "@/lib/parsers";

vi.mock("@/app/lib/actions", () => ({ updateTask: vi.fn() }));

const columns = getTasksTableColumns({
  statusCounts: { todo: 0, "in-progress": 0, done: 0, canceled: 0 },
  priorityCounts: { low: 0, medium: 0, high: 0 },
  estimatedHoursRange: { min: 0, max: 0 },
  setRowAction: () => {},
});

const dataColumns = columns.filter(
  (column) => "accessorKey" in column || "accessorFn" in column,
);

describe("getTasksTableColumns", () => {
  it("defines exactly the columns in `tasksColumns`", () => {
    const columnIds = dataColumns.flatMap((column) =>
      column.id ? [column.id] : [],
    );

    expect(columnIds.sort(compareColumnId)).toEqual(
      Object.keys(tasksColumns).sort(compareColumnId),
    );
  });

  it("filters the same columns and variants the server parses", () => {
    const filterableColumns = Object.fromEntries(
      dataColumns.flatMap((column) =>
        column.id && column.enableColumnFilter
          ? [[column.id, column.meta?.variant ?? "text"]]
          : [],
      ),
    );

    expect(filterableColumns).toEqual(getFilterableColumns(tasksColumns));
  });

  it("sorts the same columns the server parses", () => {
    const sortableColumns = dataColumns.flatMap((column) =>
      column.id && column.enableSorting !== false ? [column.id] : [],
    );

    expect(sortableColumns.sort(compareColumnId)).toEqual(
      getSortableColumns(tasksColumns).sort(compareColumnId),
    );
  });
});

function compareColumnId(a: string, b: string) {
  return a.localeCompare(b);
}
