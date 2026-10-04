import {
  createColumnHelper,
  type FilterFn,
  useTable,
} from "@tanstack/react-table";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { FilterVariant } from "@/lib/data-table-types";

import { dataTableFeatures } from "@/lib/data-table-features";
import { dataTableFilterFn } from "@/lib/data-table-filters";
import {
  getColumnPinningStyle,
  getColumnSizingStyle,
  getDefaultFilter,
} from "@/lib/data-table-utils";

interface Task {
  id: string;
  title: string;
  status: string;
  hours: number;
  createdAt: number;
  archived: boolean;
  children?: Task[];
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const exactTitle: FilterFn<DataTableFeatures, Task> = (row, columnId, value) =>
  row.getValue(columnId) === value;
exactTitle.resolveFilterValue = (value) =>
  typeof value === "string" ? value.trim() : value;
exactTitle.autoRemove = (value) => value === "";

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    meta: { variant: "text" },
  }),
  columnHelper.accessor("title", {
    id: "exact",
    filterFn: exactTitle,
  }),
  columnHelper.accessor("title", {
    id: "weird",
    meta: { variant: "bogus" as FilterVariant },
  }),
  columnHelper.accessor("status", {
    id: "status",
    meta: { variant: "multiSelect" },
  }),
  columnHelper.accessor("hours", {
    id: "hours",
    meta: { variant: "range" },
  }),
  columnHelper.accessor("createdAt", {
    id: "createdAt",
    meta: { variant: "date" },
  }),
  columnHelper.accessor("archived", {
    id: "archived",
    meta: { variant: "boolean" },
  }),
  columnHelper.accessor("title", {
    id: "a b",
  }),
]);

const tasks: Task[] = [
  {
    id: "alpha",
    title: "Alpha",
    status: "todo",
    hours: 2,
    createdAt: new Date(2026, 9, 3, 9).getTime(),
    archived: false,
  },
  {
    id: "beta",
    title: "Beta",
    status: "done",
    hours: 8,
    createdAt: new Date(2026, 9, 4, 9).getTime(),
    archived: true,
    children: [
      {
        id: "child",
        title: "Nested",
        status: "todo",
        hours: 1,
        createdAt: new Date(2026, 9, 3, 12).getTime(),
        archived: false,
      },
    ],
  },
  {
    id: "gamma",
    title: "Gamma",
    status: "todo",
    hours: 4,
    createdAt: new Date(2026, 9, 5, 9).getTime(),
    archived: false,
  },
];

function renderTaskTable({
  data = tasks,
  filterFromLeafRows,
  maxLeafRowFilterDepth,
  joinOperator,
}: {
  data?: Task[];
  filterFromLeafRows?: boolean;
  maxLeafRowFilterDepth?: number;
  joinOperator?: "and" | "or";
} = {}) {
  return renderHook(() =>
    useTable({
      features: dataTableFeatures,
      columns,
      data,
      getRowId: (row) => row.id,
      getSubRows: (row) => row.children,
      filterFromLeafRows,
      maxLeafRowFilterDepth,
      initialState: joinOperator ? { joinOperator } : undefined,
    }),
  );
}

function rowIds(
  table: ReturnType<typeof renderTaskTable>["result"]["current"],
) {
  return table.getFilteredRowModel().rows.map((row) => row.id);
}

function facetIds(
  table: ReturnType<typeof renderTaskTable>["result"]["current"],
  columnId: string,
) {
  return (
    table
      .getColumn(columnId)
      ?.getFacetedRowModel()
      .rows.map((row) => row.id) ?? []
  );
}

describe("filtered rows", () => {
  it("keeps every row when nothing narrows them", () => {
    const { result } = renderTaskTable();
    const table = result.current;

    expect(rowIds(table)).toEqual(["alpha", "beta", "gamma"]);
    expect(table.getFilteredRowModel()).toBe(table.getPreFilteredRowModel());

    act(() => {
      table.setColumnFilters([{ id: "missing", value: "x" }]);
    });
    expect(table.getFilteredRowModel()).toBe(table.getPreFilteredRowModel());

    act(() => {
      table.setColumnFilters([
        { id: "title", operator: "iLike", variant: "text", value: "" },
      ]);
    });
    expect(table.getFilteredRowModel()).toBe(table.getPreFilteredRowModel());
  });

  it("returns the empty model unchanged", () => {
    const { result } = renderTaskTable({ data: [] });
    act(() => {
      result.current.setColumnFilters([{ id: "title", value: "Alpha" }]);
    });
    expect(result.current.getFilteredRowModel().rows).toEqual([]);
    expect(result.current.getFilteredRowModel()).toBe(
      result.current.getPreFilteredRowModel(),
    );
  });

  it("joins filters on one column and across columns", () => {
    const { result } = renderTaskTable();
    const table = result.current;

    act(() => {
      table.setColumnFilters([
        { id: "title", operator: "iLike", variant: "text", value: "a" },
        { id: "title", operator: "eq", variant: "text", value: "Alpha" },
      ]);
    });
    expect(rowIds(table)).toEqual(["alpha"]);

    act(() => table.setJoinOperator("or"));
    act(() => {
      table.setColumnFilters([
        {
          id: "status",
          operator: "inArray",
          variant: "multiSelect",
          value: ["done"],
        },
        { id: "title", operator: "eq", variant: "text", value: "Alpha" },
      ]);
    });
    expect(rowIds(table)).toEqual(["alpha", "beta"]);

    const alpha = table
      .getPreFilteredRowModel()
      .flatRows.find((row) => row.id === "alpha");
    expect(
      alpha && "columnFilters" in alpha && alpha.columnFilters,
    ).toMatchObject({ status: false, title: true });
  });

  it("uses a column filter function until the filter has an operator", () => {
    const { result } = renderTaskTable();
    const table = result.current;
    const row = table.getRowModel().rows[0];

    expect(row && dataTableFilterFn(row, "title", "")).toBe(true);
    expect(row && dataTableFilterFn(row, "title", "Alpha")).toBe(true);
    expect(dataTableFilterFn.autoRemove?.("")).toBe(false);
    expect(dataTableFilterFn.autoRemove?.(undefined)).toBe(true);

    act(() => table.setColumnFilters([{ id: "exact", value: " Alpha" }]));
    expect(rowIds(table)).toEqual(["alpha"]);

    act(() => {
      table.setColumnFilters([
        { id: "exact", operator: "iLike", variant: "text", value: "alp" },
      ]);
    });
    expect(rowIds(table)).toEqual(["alpha"]);

    act(() => {
      table.setColumnFilters([
        { id: "weird", operator: "iLike", variant: "text", value: "alpha" },
      ]);
    });
    expect(rowIds(table)).toEqual(["alpha"]);
  });

  it("keeps a parent whose child matches only when filtering from the leaves", () => {
    function filterNested(filterFromLeafRows?: boolean, maxDepth?: number) {
      const { result } = renderTaskTable({
        filterFromLeafRows,
        maxLeafRowFilterDepth: maxDepth,
      });
      act(() => {
        result.current.setColumnFilters([
          { id: "title", operator: "eq", variant: "text", value: "Nested" },
        ]);
      });
      return result.current.getFilteredRowModel();
    }

    expect(filterNested(false).rows).toEqual([]);

    const fromLeaves = filterNested(true);
    expect(fromLeaves.rows.map((row) => row.id)).toEqual(["beta"]);
    expect(fromLeaves.flatRows.map((row) => row.id)).toEqual(["beta", "child"]);

    const shallow = filterNested(true, 0);
    expect(shallow.rows).toEqual([]);
  });

  it("keeps unfiltered children once the depth limit is reached", () => {
    const { result } = renderTaskTable({
      filterFromLeafRows: true,
      maxLeafRowFilterDepth: 0,
    });
    act(() => {
      result.current.setColumnFilters([
        { id: "title", operator: "eq", variant: "text", value: "Beta" },
      ]);
    });
    const model = result.current.getFilteredRowModel();
    expect(model.rows.map((row) => row.id)).toEqual(["beta"]);
    expect(model.flatRows.map((row) => row.id)).toEqual(["beta", "child"]);
  });

  it("does not keep a child that fails when filtering from the root", () => {
    const { result } = renderTaskTable();
    act(() => {
      result.current.setColumnFilters([
        { id: "title", operator: "eq", variant: "text", value: "Beta" },
      ]);
    });
    const model = result.current.getFilteredRowModel();
    expect(model.rows.map((row) => row.id)).toEqual(["beta"]);
    expect(model.rows[0]?.subRows).toEqual([]);
  });

  it("keeps every child once the depth limit is reached from the root", () => {
    const { result } = renderTaskTable({ maxLeafRowFilterDepth: 0 });
    act(() => {
      result.current.setColumnFilters([
        { id: "title", operator: "eq", variant: "text", value: "Beta" },
      ]);
    });
    expect(
      result.current.getFilteredRowModel().flatRows.map((row) => row.id),
    ).toEqual(["beta", "child"]);
  });
});

describe("faceted rows", () => {
  it("ignores a column's own filter when building its facets", () => {
    const { result } = renderTaskTable();
    const table = result.current;

    act(() => {
      table.setColumnFilters([
        {
          id: "status",
          operator: "inArray",
          variant: "multiSelect",
          value: ["done"],
        },
      ]);
    });
    expect(table.getColumn("status")?.getFacetedRowModel()).toBe(
      table.getPreFilteredRowModel(),
    );

    act(() => {
      table.setColumnFilters([
        { id: "title", operator: "eq", variant: "text", value: "Alpha" },
        {
          id: "status",
          operator: "inArray",
          variant: "multiSelect",
          value: ["done"],
        },
      ]);
    });
    expect(rowIds(table)).toEqual([]);
    expect(facetIds(table, "status")).toEqual(["alpha"]);
    expect(facetIds(table, "title")).toEqual(["beta"]);
  });

  it("facets an empty table without rebuilding it", () => {
    const { result } = renderTaskTable({ data: [] });
    act(() => {
      result.current.setColumnFilters([
        { id: "title", value: "Alpha" },
        { id: "status", value: ["done"] },
      ]);
    });
    expect(result.current.getColumn("status")?.getFacetedRowModel()).toBe(
      result.current.getPreFilteredRowModel(),
    );
  });
});

describe("column filter items", () => {
  it("adds, updates, and removes filters by id", () => {
    const { result } = renderTaskTable();
    const table = result.current;
    const filter = {
      id: "title",
      variant: "text" as const,
      operator: "iLike" as const,
      value: "Alpha",
      filterId: "title-1",
    };

    act(() => table.addColumnFilter(filter));
    expect(table.getColumnFilterItems()).toEqual([
      expect.objectContaining({ filterId: "title-1", value: "Alpha" }),
    ]);

    act(() => table.updateColumnFilter("title-1", { value: "Beta" }));
    expect(table.getColumnFilterItems()[0]?.value).toBe("Beta");

    act(() => table.removeColumnFilter("title-1"));
    expect(table.getColumnFilterItems()).toEqual([]);
  });

  it("removes cleared filters and keeps operator filters and unknown columns", () => {
    const { result } = renderTaskTable();
    const table = result.current;

    act(() => table.setColumnFilters([{ id: "title", value: undefined }]));
    expect(table.getColumnFilterItems()).toEqual([]);

    act(() => table.setColumnFilters([{ id: "title", value: "" }]));
    expect(table.getColumnFilterItems()).toEqual([
      expect.objectContaining({ id: "title", operator: "iLike", value: "" }),
    ]);

    act(() => table.setColumnFilters([{ id: "exact", value: "" }]));
    expect(table.getColumnFilterItems()).toEqual([]);

    act(() => {
      table.setColumnFilters([
        { id: "title", operator: "iLike", value: "" },
        { id: "missing", value: "" },
      ]);
    });
    expect(table.getColumnFilterItems().map((filter) => filter.id)).toEqual([
      "title",
      "missing",
    ]);
  });

  it("reads and writes the plain filter for a column", () => {
    const { result } = renderTaskTable();
    const table = result.current;
    const title = table.getColumn("title");
    const hours = table.getColumn("hours");
    const createdAt = table.getColumn("createdAt");

    expect(title && getDefaultFilter(title)).toEqual({
      id: "title",
      variant: "text",
      operator: "iLike",
      value: "",
    });

    act(() => title?.setFilterValue("Alpha"));
    expect(title?.getFilterValue()).toBe("Alpha");
    act(() => title?.setFilterValue("Beta"));
    expect(table.getColumnFilterItems()).toHaveLength(1);
    expect(title?.getFilterValue()).toBe("Beta");

    act(() => {
      table.setColumnFilters([
        {
          id: "title",
          operator: "eq",
          variant: "text",
          value: "Alpha",
          filterId: "adv",
        },
      ]);
    });
    expect(title?.getFilterValue()).toBeUndefined();
    act(() => title?.setFilterValue("Beta"));
    expect(table.getColumnFilterItems()).toHaveLength(2);

    act(() => {
      table.setColumnFilters([
        { id: "title", value: "Alpha", filterId: "keep" },
      ]);
    });
    act(() => title?.setFilterValue("Beta"));
    expect(table.getColumnFilterItems()[0]).toMatchObject({
      value: "Beta",
      filterId: "keep",
    });

    act(() => hours?.setFilterValue(["2", ""]));
    expect(hours?.getFilterValue()).toEqual([2, undefined]);

    act(() => createdAt?.setFilterValue(new Date(2026, 9, 3, 9).getTime()));
    expect(createdAt?.getFilterValue()).toBe(new Date(2026, 9, 3).getTime());
  });

  it("resets the join operator to its initial value or to and", () => {
    const { result } = renderTaskTable({ joinOperator: "or" });
    const table = result.current;

    expect(table.getJoinOperator()).toBe("or");
    act(() => table.setJoinOperator("and"));
    expect(table.getJoinOperator()).toBe("and");
    act(() => table.resetJoinOperator());
    expect(table.getJoinOperator()).toBe("or");
    act(() => table.resetJoinOperator(true));
    expect(table.getJoinOperator()).toBe("and");
  });
});

describe("column layout styles", () => {
  it("pins columns with sticky offsets and sizes every column", () => {
    const { result } = renderTaskTable();
    const table = result.current;
    const title = table.getColumn("title");
    const archived = table.getColumn("archived");
    const spaced = table.getColumn("a b");

    act(() => {
      table.setColumnPinning({ start: ["title", "a b"], end: ["archived"] });
    });

    expect(title && getColumnPinningStyle(title)).toMatchObject({
      position: "sticky",
      insetInlineStart: "var(--column-title-offset)",
      opacity: 0.97,
      zIndex: 1,
      width: "var(--column-title-size)",
    });
    expect(archived && getColumnPinningStyle(archived)).toMatchObject({
      insetInlineEnd: "var(--column-archived-offset)",
      insetInlineStart: undefined,
    });
    expect(
      table.getColumn("status") &&
        getColumnPinningStyle(table.getColumn("status")!),
    ).toMatchObject({
      position: "relative",
      opacity: 1,
      zIndex: undefined,
    });
    expect(spaced && getColumnPinningStyle(spaced).width).toBe(
      "var(--column-a_20_b-size)",
    );

    const style = Object.fromEntries(
      Object.entries(getColumnSizingStyle(table)),
    );
    expect(style.minWidth).toBe(`${table.getTotalSize()}px`);
    expect(style["--column-title-size"]).toBe(`${title?.getSize()}px`);
    expect(style["--column-a_20_b-offset"]).toBe(
      `${spaced?.getStart("start")}px`,
    );
    expect(style["--column-archived-offset"]).toBe(
      `${archived?.getAfter("end")}px`,
    );
    expect(style["--column-status-offset"]).toBeUndefined();
  });
});
