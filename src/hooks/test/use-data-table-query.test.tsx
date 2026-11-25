import { createColumnHelper } from "@tanstack/react-table";
import { act, renderHook } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataResult } from "@/lib/data-table-types";

import { createDataTableConfig } from "@/lib/data-table-config";
import {
  useDataTable,
  type UseDataTableProps,
} from "@/registry/bases/radix/hooks/use-data-table";

interface Task {
  id: string;
  title: string;
  status: string;
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    meta: { variant: "text" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("status", {
    id: "status",
    meta: { variant: "select" },
    enableColumnFilter: true,
  }),
]);

const config = createDataTableConfig({
  columns: {
    title: { variant: "text" },
    status: { variant: "select" },
  },
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("useDataTable query", () => {
  it("derives the query from the URL state", () => {
    const { result } = renderTable(
      "?page=3&perPage=20&sort=title.desc&joinOperator=or&search=fix&status=todo,done",
      { result: undefined },
    );

    expect(result.current.query).toEqual({
      sorting: [{ id: "title", desc: true }],
      filters: [
        {
          id: "status",
          value: ["todo", "done"],
          variant: "select",
          operator: "inArray",
          filterId: "status-0",
        },
      ],
      joinOperator: "or",
      search: "fix",
      page: { index: 2, size: 20 },
    });
  });

  it("keeps the same query object while the state is equal by value", () => {
    const { result, rerender } = renderTable("?page=2&title=bug", {
      result: undefined,
    });
    const first = result.current.query;

    rerender();
    act(() => {
      result.current.table.setColumnFilters((filters) => [
        ...filters.map((filter) => ({ ...filter })),
      ]);
    });

    expect(result.current.query).toBe(first);
  });

  it("returns a new query when the page changes", async () => {
    vi.useFakeTimers();
    const { result } = renderTable("", { result: getResult(100) });
    const first = result.current.query;

    act(() => result.current.table.setPageIndex(1));
    await act(() => vi.runAllTimersAsync());

    expect(result.current.query).not.toBe(first);
    expect(result.current.query.page).toEqual({ index: 1, size: 10 });
  });

  it("leaves draft filters without a value out of the query", () => {
    const { result } = renderTable("", { result: undefined });

    act(() => {
      result.current.table.setColumnFilters([{ id: "title", value: "" }]);
    });

    expect(result.current.table.state.columnFilters).toHaveLength(1);
    expect(result.current.query.filters).toEqual([]);
  });

  it("can round-trip through the config's URL format", () => {
    const search =
      "?page=3&perPage=20&sort=title.desc&joinOperator=or&search=fix&status=todo,done";
    const { result } = renderTable(search, { result: undefined });
    const serialized = config.serialize(result.current.query);

    const { result: parsed } = renderTable(serialized, { result: undefined });

    expect(parsed.current.query).toEqual(result.current.query);
  });
});

describe("useDataTable result", () => {
  it("sets the manual flags and row count from the result", () => {
    const { result } = renderTable("", { result: getResult(42) });
    const { options } = result.current.table;

    expect(options.manualPagination).toBe(true);
    expect(options.manualSorting).toBe(true);
    expect(options.manualFiltering).toBe(true);
    expect(options.rowCount).toBe(42);
    expect(options.pageCount).toBeUndefined();
    expect(result.current.table.getPageCount()).toBe(5);
  });

  it("shows the result rows without sorting or filtering them again", () => {
    const { result } = renderTable("?sort=title.asc&title=zzz", {
      result: getResult(30, ["b", "a"]),
    });

    expect(
      result.current.table.getRowModel().rows.map((row) => row.original.title),
    ).toEqual(["b", "a"]);
  });

  it("has no rows and no next page before the first result", () => {
    const { result } = renderTable("", { result: undefined });

    expect(result.current.table.getRowModel().rows).toEqual([]);
    expect(result.current.table.getPageCount()).toBe(0);
    expect(result.current.table.getCanNextPage()).toBe(false);
  });

  it("follows a new result", () => {
    let current = getResult(10, ["a"]);
    const { result, rerender } = renderHookWithUrl("", () =>
      useTable({ result: current }),
    );

    current = getResult(25, ["b", "c"]);
    rerender();

    expect(result.current.table.options.rowCount).toBe(25);
    expect(result.current.table.getRowModel().rows).toHaveLength(2);
  });

  it("warns and shows data when both data and result are passed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = [{ id: "1", title: "from data", status: "todo" }];

    const { result } = renderTable("", {
      data,
      pageCount: 1,
      result: getResult(10, ["from result"]),
    } as unknown as Partial<UseDataTableProps<Task>>);

    expect(result.current.table.getRowModel().rows[0]?.original.title).toBe(
      "from data",
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("either `data` or `result`"),
    );
    warn.mockRestore();
  });

  it("keeps the data and pageCount path", () => {
    const data = [
      { id: "1", title: "a", status: "todo" },
      { id: "2", title: "b", status: "done" },
    ];
    const { result } = renderTable("?page=2", {
      data,
      pageCount: 7,
      rowCount: 70,
    });
    const { options } = result.current.table;

    expect(options.manualPagination).toBe(true);
    expect(options.pageCount).toBe(7);
    expect(options.rowCount).toBe(70);
    expect(result.current.table.getRowModel().rows).toHaveLength(2);
    expect(result.current.query.page).toEqual({ index: 1, size: 10 });
  });

  it("keeps the client path", () => {
    const data = Array.from({ length: 15 }, (_, index) => ({
      id: String(index),
      title: index < 3 ? "bug" : "feat",
      status: "todo",
    }));
    const { result } = renderTable("?title=bug", { mode: "client", data });
    const { options } = result.current.table;

    expect(options.manualPagination).toBe(false);
    expect(options.manualFiltering).toBe(false);
    expect(result.current.table.getRowModel().rows).toHaveLength(3);
  });
});

describe("useDataTable page reset", () => {
  it("goes back to the first page when a filter changes", async () => {
    vi.useFakeTimers();
    const { result, getLastSearch } = renderTable("?page=3", {
      result: getResult(100),
    });

    act(() => {
      result.current.table.setColumnFilters([
        { id: "status", value: ["todo"] },
      ]);
    });
    await act(() => vi.runAllTimersAsync());

    expect(getLastSearch()?.has("page")).toBe(false);
    expect(result.current.query.page.index).toBe(0);
  });

  it("goes back to the first page when the search changes", async () => {
    vi.useFakeTimers();
    const { result, getLastSearch } = renderTable("?page=3", {
      result: getResult(100),
    });

    act(() => result.current.table.setGlobalFilter("fix"));
    await act(() => vi.runAllTimersAsync());

    expect(getLastSearch()?.has("page")).toBe(false);
    expect(result.current.query.page.index).toBe(0);
  });

  it("goes back to the first page when the join operator changes", async () => {
    vi.useFakeTimers();
    const { result, getLastSearch } = renderTable("?page=3", {
      result: getResult(100),
    });

    act(() => result.current.table.setJoinOperator("or"));
    await act(() => vi.runAllTimersAsync());

    expect(getLastSearch()?.has("page")).toBe(false);
    expect(result.current.query.page.index).toBe(0);
  });

  it("keeps the first visible row when the page size changes", async () => {
    vi.useFakeTimers();
    const { result } = renderTable("?page=3", { result: getResult(100) });

    act(() => result.current.table.setPageSize(20));
    await act(() => vi.runAllTimersAsync());

    expect(result.current.query.page).toEqual({ index: 1, size: 20 });
  });

  it("keeps the page when a new result arrives", () => {
    let current = getResult(100, ["a"]);
    const { result, rerender } = renderHookWithUrl("?page=3", () =>
      useTable({ result: current }),
    );

    current = getResult(40, ["b"]);
    rerender();

    expect(result.current.query.page.index).toBe(2);
    expect(result.current.table.state.pagination.pageIndex).toBe(2);
  });
});

function getResult(rowCount: number, titles = ["a"]): DataResult<Task> {
  return {
    rows: titles.map((title, index) => ({
      id: `${title}-${index}`,
      title,
      status: "todo",
    })),
    rowCount,
  };
}

function useTable(props: Partial<UseDataTableProps<Task>>) {
  return useDataTable<Task>({
    config,
    columns,
    getRowId: (row) => row.id,
    ...props,
  } as UseDataTableProps<Task>);
}

function renderTable(search: string, props: Partial<UseDataTableProps<Task>>) {
  return renderHookWithUrl(search, () => useTable(props));
}

function renderHookWithUrl<TResult>(search: string, useResult: () => TResult) {
  const updates: UrlUpdateEvent[] = [];
  window.history.replaceState(null, "", `/${search}`);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NuqsTestingAdapter
        hasMemory
        searchParams={search}
        onUrlUpdate={(event) => {
          updates.push(event);
        }}
      >
        {children}
      </NuqsTestingAdapter>
    );
  }

  const hook = renderHook(useResult, { wrapper: Wrapper });

  function getLastSearch() {
    return updates.at(-1)?.searchParams;
  }

  return { ...hook, updates, getLastSearch };
}
