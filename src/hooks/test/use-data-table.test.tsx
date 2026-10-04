import { createColumnHelper } from "@tanstack/react-table";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  let currentSearch = search;
  window.history.replaceState(null, "", `/${search}`);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NuqsTestingAdapter
        hasMemory
        searchParams={currentSearch}
        onUrlUpdate={onUrlUpdate}
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
    return onUrlUpdate.mock.lastCall?.[0].searchParams;
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
    const { result, navigate } = renderDataTable("?title=bug");

    act(() => {
      result.current.table.setColumnFilters([
        { id: "title", value: "bug" },
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
  });
});
