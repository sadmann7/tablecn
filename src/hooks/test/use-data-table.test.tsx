import { createColumnHelper } from "@tanstack/react-table";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  useDataTable,
  type UseDataTableProps,
} from "@/registry/bases/radix/hooks/use-data-table";

interface Task {
  id: string;
  code: string;
  title: string;
  status: string;
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("code", { id: "code", enableSorting: false }),
  columnHelper.accessor("title", {
    id: "title",
    meta: { variant: "text" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("status", {
    id: "status",
    meta: { variant: "multiSelect" },
    enableColumnFilter: true,
  }),
  columnHelper.display({ id: "actions" }),
]);

const data: Task[] = [];

function renderDataTable(
  search: string,
  props: Partial<UseDataTableProps<Task>> = {},
) {
  const updates: UrlUpdateEvent[] = [];
  let currentSearch = search;
  window.history.replaceState(null, "", `/${search}`);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NuqsTestingAdapter
        hasMemory
        searchParams={currentSearch}
        onUrlUpdate={(event) => {
          updates.push(event);
        }}
      >
        {children}
      </NuqsTestingAdapter>
    );
  }

  const hook = renderHook(
    () =>
      useDataTable<Task>({
        data,
        columns,
        pageCount: 10,
        debounceMs: 10,
        ...props,
      } as UseDataTableProps<Task>),
    { wrapper: Wrapper },
  );

  function navigate(nextSearch: string) {
    currentSearch = nextSearch;
    window.history.replaceState(null, "", `/${nextSearch}`);
    hook.rerender();
  }

  function getLastSearch() {
    return updates.at(-1)?.searchParams;
  }

  return { ...hook, navigate, getLastSearch };
}

function getFilterSummary(filters: { id: string; value: unknown }[]) {
  return filters.map((filter) => [filter.id, filter.value]);
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useDataTable", () => {
  it("reads filters from the URL in URL order", async () => {
    const { result } = renderDataTable("?status=todo,done&title=bug");

    await waitFor(() =>
      expect(
        getFilterSummary(result.current.table.state.columnFilters),
      ).toEqual([
        ["status", ["todo", "done"]],
        ["title", "bug"],
      ]),
    );
  });

  it("starts from initialState filters when the URL has none", () => {
    const { result } = renderDataTable("", {
      initialState: { columnFilters: [{ id: "title", value: "seed" }] },
    });

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "seed"],
    ]);
  });

  it("updates filters right away and writes them to the URL after the debounce", async () => {
    const { result, getLastSearch } = renderDataTable("?page=3");

    act(() => {
      result.current.table.setColumnFilters([
        { id: "title", value: "bug" },
        { id: "status", value: [] },
      ]);
    });

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
      ["status", []],
    ]);

    await waitFor(() => expect(getLastSearch()?.get("title")).toBe("bug"));
    expect(getLastSearch()?.has("status")).toBe(false);
    expect(getLastSearch()?.get("page")).toBe("1");
    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
      ["status", []],
    ]);
  });

  it("lets an outside URL change replace the filters being edited", async () => {
    // A wide debounce window keeps slow runners from writing the draft before
    // the outside URL change lands.
    const { result, navigate, getLastSearch } = renderDataTable("?title=bug", {
      debounceMs: 300,
    });

    act(() => {
      result.current.table.setColumnFilters([
        { id: "title", value: "zzz" },
        { id: "status", value: [] },
      ]);
    });
    await waitFor(() =>
      expect(result.current.table.state.columnFilters).toHaveLength(2),
    );

    act(() => navigate("?status=done"));

    await waitFor(() =>
      expect(
        getFilterSummary(result.current.table.state.columnFilters),
      ).toEqual([["status", ["done"]]]),
    );

    // Wait until the debounced URL write has run.
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));

    expect(getLastSearch()?.get("title")).not.toBe("zzz");
    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["status", ["done"]],
    ]);
  });

  it("only reads sorting for sortable columns", () => {
    const { result } = renderDataTable("?sort=code.asc", {
      initialState: { sorting: [{ id: "title", desc: true }] },
    });

    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
  });

  it("writes pagination and sorting changes to the URL", async () => {
    const { result, getLastSearch } = renderDataTable("");

    act(() => {
      result.current.table.setSorting([{ id: "title", desc: false }]);
    });
    await waitFor(() => expect(getLastSearch()?.get("sort")).toBe("title.asc"));

    act(() => {
      result.current.table.setPageIndex(2);
    });
    await waitFor(() => expect(getLastSearch()?.get("page")).toBe("3"));
    expect(result.current.table.state.pagination.pageIndex).toBe(2);

    act(() => {
      result.current.table.setPageSize(25);
      result.current.table.setJoinOperator("or");
    });
    await waitFor(() => expect(getLastSearch()?.get("perPage")).toBe("25"));
    expect(getLastSearch()?.get("joinOperator")).toBe("or");
  });

  it("reads page, page size, sorting, and the join from the URL", () => {
    const { result } = renderDataTable(
      "?page=3&perPage=25&sort=title.desc&joinOperator=or",
    );

    expect(result.current.table.state.pagination).toEqual({
      pageIndex: 2,
      pageSize: 25,
    });
    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
    expect(result.current.table.getJoinOperator()).toBe("or");
  });

  it("uses the initial page size when the URL does not set one", () => {
    const { result } = renderDataTable("", {
      initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
    });

    expect(result.current.table.state.pagination.pageSize).toBe(25);
  });

  it("reads and writes the configured query keys", async () => {
    const { result, getLastSearch } = renderDataTable(
      "?p=2&s=title.asc&join=or",
      {
        queryKeys: {
          page: "p",
          perPage: "size",
          sort: "s",
          joinOperator: "join",
        },
      },
    );

    expect(result.current.table.state.pagination.pageIndex).toBe(1);
    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: false },
    ]);
    expect(result.current.table.getJoinOperator()).toBe("or");

    act(() => result.current.table.setPageIndex(3));
    await waitFor(() => expect(getLastSearch()?.get("p")).toBe("4"));
    expect(getLastSearch()?.has("page")).toBe(false);
  });

  it("writes every filter on a column, including one with no value", async () => {
    const { result, getLastSearch } = renderDataTable("");

    act(() => {
      result.current.table.setColumnFilters([
        {
          id: "title",
          value: "bug",
          operator: "iLike",
          variant: "text",
          filterId: "title-0",
        },
        {
          id: "title",
          value: "feat",
          operator: "iLike",
          variant: "text",
          filterId: "title-1",
        },
        {
          id: "status",
          value: "",
          operator: "isEmpty",
          variant: "multiSelect",
          filterId: "status-0",
        },
      ]);
    });

    await waitFor(() =>
      expect(getLastSearch()?.getAll("title")).toEqual(["bug", "feat"]),
    );
    expect(getLastSearch()?.get("status")).toBe("is.empty");
  });

  it("leaves a column that cannot be filtered out of the URL", async () => {
    const { result, getLastSearch } = renderDataTable("");

    act(() => {
      result.current.table.setColumnFilters([
        { id: "code", value: "T-1" },
        { id: "title", value: "bug" },
      ]);
    });

    await waitFor(() => expect(getLastSearch()?.get("title")).toBe("bug"));
    expect(getLastSearch()?.has("code")).toBe(false);
  });

  it("filters rows in client mode and leaves them to the server otherwise", async () => {
    const tasks: Task[] = [
      { id: "1", code: "T-1", title: "bug", status: "todo" },
      { id: "2", code: "T-2", title: "feat", status: "done" },
    ];

    const server = renderDataTable("?title=bug", { data: tasks });
    await waitFor(() =>
      expect(server.result.current.table.state.columnFilters).toHaveLength(1),
    );
    expect(server.result.current.table.getRowModel().rows).toHaveLength(2);

    const client = renderDataTable("?title=bug", {
      mode: "client",
      data: tasks,
    });
    await waitFor(() =>
      expect(
        client.result.current.table
          .getFilteredRowModel()
          .rows.map((row) => row.original.title),
      ).toEqual(["bug"]),
    );
  });
});
