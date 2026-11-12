import { createColumnHelper } from "@tanstack/react-table";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { createDataTableConfig } from "@/lib/data-table-config";
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

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("useDataTable", () => {
  it("reads filters from the URL in URL order", () => {
    const { result } = renderDataTable("?status=todo,done&title=bug");

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["status", ["todo", "done"]],
      ["title", "bug"],
    ]);
  });

  it("writes new filters to the URL in the order they were added", async () => {
    const { result, getLastSearch } = renderDataTable("");

    act(() =>
      result.current.table.setColumnFilters([
        { id: "status", value: ["todo"] },
        { id: "title", value: "bug" },
      ]),
    );

    await waitFor(() =>
      expect([...(getLastSearch()?.keys() ?? [])]).toEqual(["status", "title"]),
    );
  });

  it("writes reordered filters to the URL", async () => {
    const { result, getLastSearch } = renderDataTable(
      "?status=todo,done&title=bug",
    );

    act(() =>
      result.current.table.setColumnFilters((filters) => [
        ...filters.filter((filter) => filter.id === "title"),
        ...filters.filter((filter) => filter.id !== "title"),
      ]),
    );

    await waitFor(() =>
      expect([...(getLastSearch()?.keys() ?? [])]).toEqual(["title", "status"]),
    );
    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
      ["status", ["todo", "done"]],
    ]);
  });

  it("reads filters in URL order under an id", () => {
    const { result } = renderDataTable("?t.status=todo&page=2&t.title=bug", {
      config: createDataTableConfig({ id: "t", columns: tableColumns }),
    });

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["status", ["todo"]],
      ["title", "bug"],
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
    expect(getLastSearch()?.has("page")).toBe(false);
    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
      ["status", []],
    ]);
  });

  it("only reads sorting for sortable columns", () => {
    const { result } = renderDataTable("?sort=code.asc", {
      config: createDataTableConfig({
        columns: tableColumns,
        defaultSorting: [{ id: "title", desc: true }],
      }),
    });

    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
  });

  it("keeps every filter and sorting change made in one event", async () => {
    const { result } = renderDataTable("");

    act(() => {
      result.current.table.setColumnFilters((prev) => [
        ...prev,
        { id: "title", value: "bug" },
      ]);
      result.current.table.setColumnFilters((prev) => [
        ...prev,
        { id: "status", value: ["done"] },
      ]);
      result.current.table.setSorting((prev) => [
        ...prev,
        { id: "title", desc: false },
      ]);
      result.current.table.setSorting((prev) => [
        ...prev,
        { id: "status", desc: true },
      ]);
    });

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
      ["status", ["done"]],
    ]);
    await waitFor(() =>
      expect(result.current.table.state.sorting).toEqual([
        { id: "title", desc: false },
        { id: "status", desc: true },
      ]),
    );
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

  it("resets the page with the filter and writes both in one URL update", async () => {
    vi.useFakeTimers();
    const tasks: Task[] = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      code: `T-${index}`,
      title: index < 5 ? "bug" : "feat",
      status: "todo",
    }));
    const { result, updates, getLastSearch } = renderDataTable("?page=3", {
      mode: "client",
      data: tasks,
    });

    act(() => {
      result.current.table.setColumnFilters([{ id: "title", value: "bug" }]);
    });
    expect(result.current.table.state.pagination.pageIndex).toBe(0);
    expect(result.current.table.getRowModel().rows).toHaveLength(5);

    await act(() => vi.runAllTimersAsync());

    expect(updates).toHaveLength(1);
    expect(getLastSearch()?.toString()).toBe("title=bug");
    expect(result.current.table.state.pagination.pageIndex).toBe(0);
  });

  it("goes back to page 1 with a sorting or join change, in one URL update", async () => {
    vi.useFakeTimers();
    const { result, updates, getLastSearch } = renderDataTable("?page=3");

    act(() => result.current.table.setSorting([{ id: "title", desc: true }]));
    await act(() => vi.runAllTimersAsync());

    expect(updates).toHaveLength(1);
    expect(getLastSearch()?.toString()).toBe("sort=title.desc");

    act(() => result.current.table.setPageIndex(2));
    await act(() => vi.runAllTimersAsync());
    act(() => result.current.table.setJoinOperator("or"));
    await act(() => vi.runAllTimersAsync());

    expect(updates).toHaveLength(3);
    expect(getLastSearch()?.toString()).toBe("sort=title.desc&joinOperator=or");
  });

  it("writes nothing for a sorting or filter change with the same result", async () => {
    vi.useFakeTimers();
    const { result, updates } = renderDataTable("?page=3&title=bug");

    act(() =>
      result.current.table.setSorting(result.current.table.state.sorting),
    );
    act(() =>
      result.current.table.setColumnFilters((filters) => [
        ...filters,
        { id: "status", value: [] },
      ]),
    );
    await act(() => vi.runAllTimersAsync());

    expect(updates).toHaveLength(0);
    expect(result.current.table.state.pagination.pageIndex).toBe(2);
  });

  it("keeps the page when columns are re-created with the same content", async () => {
    const tasks: Task[] = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      code: `T-${index}`,
      title: "bug",
      status: "todo",
    }));
    const { result, rerender, updates } = renderHookWithUrl(
      "?page=2&title=bug",
      () =>
        useTestDataTable({
          mode: "client",
          data: tasks,
          columns: [...columns],
        }),
    );

    result.current.table.getRowModel();
    rerender();
    result.current.table.getRowModel();
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)));

    expect(result.current.table.state.pagination.pageIndex).toBe(1);
    expect(updates).toHaveLength(0);
  });

  it("rejects handlers and seeds the hook owns", () => {
    renderDataTable("", {
      // @ts-expect-error the hook owns the sorting state
      onSortingChange: () => {},
    });
    renderDataTable("", {
      config: createDataTableConfig({ columns: tableColumns }),
      initialState: {
        // @ts-expect-error filters come from the URL when a config is set
        columnFilters: [{ id: "title", value: "seed" }],
      },
    });
  });

  it("reads filters and sorting from the columns when a client table has no config", () => {
    const { result } = renderDataTable("?title=bug&code=x&sort=title.desc", {
      mode: "client",
      config: undefined,
      pageCount: undefined,
    });

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
    ]);
    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
    expect(result.current.table.getColumn("code")?.getCanSort()).toBe(false);
  });

  it("keeps a client table's derived config when columns are recreated inline", () => {
    const { result, rerender } = renderHookWithUrl("?title=bug", () =>
      useTestDataTable({
        mode: "client",
        config: undefined,
        pageCount: undefined,
        columns: [...columns],
      }),
    );
    const filters = result.current.table.state.columnFilters;

    rerender();

    expect(result.current.table.state.columnFilters).toBe(filters);
  });

  it("takes config options inline on a client table", async () => {
    const { result, rerender, getLastSearch } = renderHookWithUrl(
      "?t.title=bug&title=other",
      () =>
        useTestDataTable({
          mode: "client",
          pageCount: undefined,
          config: {
            id: "t",
            defaultSorting: [{ id: "title", desc: true }],
            defaultPageSize: 25,
          },
        }),
    );
    const filters = result.current.table.state.columnFilters;

    expect(getFilterSummary(filters)).toEqual([["title", "bug"]]);
    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
    expect(result.current.table.state.pagination.pageSize).toBe(25);

    rerender();

    expect(result.current.table.state.columnFilters).toBe(filters);

    act(() => result.current.table.setPageIndex(1));

    await waitFor(() => expect(getLastSearch()?.get("t.page")).toBe("2"));
  });

  it("takes config options inline on a server table", () => {
    const { result } = renderDataTable("?title=bug&sort=title.asc&page=2", {
      config: { defaultPageSize: 25 },
      pageCount: 3,
    });
    const { table } = result.current;

    expect(getFilterSummary(table.state.columnFilters)).toEqual([
      ["title", "bug"],
    ]);
    expect(table.state.sorting).toEqual([{ id: "title", desc: false }]);
    expect(table.state.pagination).toEqual({ pageIndex: 1, pageSize: 25 });
    expect(table.options.manualFiltering).toBe(true);
  });

  it("ignores columns on an inline config and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderDataTable("?status=todo&code=x", {
      mode: "client",
      pageCount: undefined,
      config: {
        // @ts-expect-error columns only come through createDataTableConfig
        columns: {
          status: { enableSorting: false },
          code: { variant: "text" },
        },
      },
    });
    const { table } = result.current;

    expect(table.getColumn("status")?.getCanSort()).toBe(true);
    expect(table.getColumn("code")?.getCanFilter()).toBe(false);
    expect(getFilterSummary(table.state.columnFilters)).toEqual([
      ["status", ["todo"]],
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("an inline config ignores `columns`"),
    );
    warn.mockRestore();
  });

  it("keeps the same filters when only the page changes", async () => {
    const { result, getLastSearch } = renderDataTable("?title=bug");
    const filters = result.current.table.state.columnFilters;

    act(() => result.current.table.setPageIndex(2));

    await waitFor(() => expect(getLastSearch()?.get("page")).toBe("3"));
    expect(result.current.table.state.columnFilters).toBe(filters);
  });

  it("keeps the same filters when columns are recreated inline", () => {
    const { result, rerender } = renderHookWithUrl("?title=bug", () =>
      useTestDataTable({ mode: "client", data, columns: [...columns] }),
    );
    const filters = result.current.table.state.columnFilters;

    rerender();

    expect(result.current.table.state.columnFilters).toBe(filters);
  });

  it("debounces filter writes only when they reach the server", async () => {
    const { result, getLastSearch } = renderDataTable("", {
      shallow: false,
      debounceMs: 10_000,
    });

    act(() =>
      result.current.table.setColumnFilters([{ id: "title", value: "bug" }]),
    );

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
    ]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getLastSearch()).toBeUndefined();
  });

  it("writes a cleared filter right away", async () => {
    const { result, getLastSearch } = renderDataTable("?title=bug", {
      shallow: false,
      debounceMs: 10_000,
    });

    act(() => result.current.table.setColumnFilters([]));

    await waitFor(() => expect(getLastSearch()?.has("title")).toBe(false));
  });

  it("warns about config keys with no matching column", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderDataTable("", {
      config: createDataTableConfig({
        columns: { ...tableColumns, titel: { variant: "text" } },
      }),
    });
    renderDataTable("");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"titel"');
    warn.mockRestore();
  });

  it("writes only the pagination keys that changed", async () => {
    const { result, getLastSearch } = renderDataTable("");

    act(() => {
      result.current.table.nextPage();
    });

    await waitFor(() => expect(getLastSearch()?.get("page")).toBe("2"));
    expect(getLastSearch()?.has("perPage")).toBe(false);
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

  it("uses the config's page size when the URL does not set one", () => {
    const { result } = renderDataTable("", {
      config: createDataTableConfig({
        columns: tableColumns,
        defaultPageSize: 25,
      }),
    });

    expect(result.current.table.state.pagination.pageSize).toBe(25);
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
          variant: "select",
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

  it("filters rows by the global filter in client mode", () => {
    const tasks: Task[] = [
      { id: "1", code: "T-1", title: "login bug", status: "todo" },
      { id: "2", code: "T-2", title: "new feature", status: "done" },
    ];
    const { result } = renderDataTable("", {
      mode: "client",
      data: tasks,
      globalFilterFn: (row, columnId, value) =>
        String(row.getValue(columnId)).includes(String(value)),
    });

    act(() => {
      result.current.table.setGlobalFilter("bug");
    });

    expect(
      result.current.table
        .getFilteredRowModel()
        .rows.map((row) => row.original.title),
    ).toEqual(["login bug"]);
  });

  it("reads the global filter from the URL", () => {
    const { result } = renderDataTable("?search=bug");

    expect(result.current.table.state.globalFilter).toBe("bug");
  });

  it("updates the global filter right away and writes it to the URL after the debounce", async () => {
    const { result, getLastSearch } = renderDataTable("?page=3");

    act(() => result.current.table.setGlobalFilter("bug"));

    expect(result.current.table.state.globalFilter).toBe("bug");
    await waitFor(() => expect(getLastSearch()?.get("search")).toBe("bug"));
    expect(getLastSearch()?.has("page")).toBe(false);
    expect(result.current.table.state.globalFilter).toBe("bug");
  });

  it("removes the global filter from the URL when it is cleared", async () => {
    const { result, getLastSearch } = renderDataTable("?search=bug");

    act(() => result.current.table.setGlobalFilter(""));

    expect(result.current.table.state.globalFilter).toBe("");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getLastSearch()?.has("search") ?? false).toBe(false);
  });

  it("filters a nested accessor column through the URL", async () => {
    interface Owned {
      id: string;
      owner: { name: string };
    }
    const ownedConfig = createDataTableConfig({
      columns: { owner_name: { variant: "text" } },
    });
    const ownedHelper = createColumnHelper<DataTableFeatures, Owned>();
    const ownedData: Owned[] = [
      { id: "1", owner: { name: "ann" } },
      { id: "2", owner: { name: "bo" } },
    ];
    const ownedColumns = ownedHelper.columns([
      ownedHelper.accessor("owner.name", { header: "Owner" }),
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { result, getLastSearch } = renderHookWithUrl("?owner_name=ann", () =>
      useDataTable<Owned>({
        config: ownedConfig,
        data: ownedData,
        columns: ownedColumns,
        mode: "client",
        getRowId: (row) => row.id,
      }),
    );

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["owner_name", "ann"],
    ]);
    expect(
      result.current.table.getRowModel().rows.map((row) => row.id),
    ).toEqual(["1"]);

    act(() => {
      result.current.table.setColumnFilters([
        { id: "owner_name", value: "bo" },
      ]);
    });

    await waitFor(() => expect(getLastSearch()?.get("owner_name")).toBe("bo"));
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("no matching column"),
    );
    warn.mockRestore();
  });

  it("namespaces every URL key with the id, including column filters", async () => {
    const { result, getLastSearch } = renderDataTable(
      "?t.page=2&t.sort=title.asc&t.title=bug&t.search=x&title=other&page=9",
      { config: createDataTableConfig({ id: "t", columns: tableColumns }) },
    );

    expect(result.current.table.state.pagination.pageIndex).toBe(1);
    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: false },
    ]);
    expect(result.current.table.state.globalFilter).toBe("x");
    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
    ]);

    act(() => {
      result.current.table.setColumnFilters([
        { id: "status", value: ["todo"] },
      ]);
    });

    await waitFor(() => expect(getLastSearch()?.get("t.status")).toBe("todo"));
    expect(getLastSearch()?.has("t.page")).toBe(false);
    expect(getLastSearch()?.has("status")).toBe(false);
    expect(getLastSearch()?.get("title")).toBe("other");
  });

  it("keeps two tables with different ids on one page apart", async () => {
    const { result, getLastSearch } = renderDataTables(
      "?a.page=2&b.title=bug",
      { config: createDataTableConfig({ id: "a", columns: tableColumns }) },
      { config: createDataTableConfig({ id: "b", columns: tableColumns }) },
    );

    expect(result.current.first.table.state.pagination.pageIndex).toBe(1);
    expect(result.current.second.table.state.pagination.pageIndex).toBe(0);
    expect(
      getFilterSummary(result.current.first.table.state.columnFilters),
    ).toEqual([]);
    expect(
      getFilterSummary(result.current.second.table.state.columnFilters),
    ).toEqual([["title", "bug"]]);

    act(() => result.current.second.table.setPageIndex(4));

    await waitFor(() => expect(getLastSearch()?.get("b.page")).toBe("5"));
    expect(getLastSearch()?.get("a.page")).toBe("2");
    expect(result.current.first.table.state.pagination.pageIndex).toBe(1);
  });

  it("reuses one config under different ids", async () => {
    const config = createDataTableConfig({ columns: tableColumns });
    const { result, getLastSearch } = renderDataTables(
      "?open.title=bug&closed.page=3",
      { config: createDataTableConfig({ ...config, id: "open" }) },
      { config: createDataTableConfig({ ...config, id: "closed" }) },
    );

    expect(
      getFilterSummary(result.current.first.table.state.columnFilters),
    ).toEqual([["title", "bug"]]);
    expect(result.current.first.table.state.pagination.pageIndex).toBe(0);
    expect(
      getFilterSummary(result.current.second.table.state.columnFilters),
    ).toEqual([]);
    expect(result.current.second.table.state.pagination.pageIndex).toBe(2);

    act(() =>
      result.current.second.table.setColumnFilters([
        { id: "title", value: "old" },
      ]),
    );

    await waitFor(() =>
      expect(getLastSearch()?.get("closed.title")).toBe("old"),
    );
    expect(getLastSearch()?.get("open.title")).toBe("bug");
    expect(
      getFilterSummary(result.current.first.table.state.columnFilters),
    ).toEqual([["title", "bug"]]);
  });

  it("reads and writes columns nested in a group", async () => {
    const groupedColumns = columnHelper.columns([
      columnHelper.group({
        id: "details",
        header: "Details",
        columns: columnHelper.columns([
          columnHelper.accessor("title", {
            id: "title",
            meta: { variant: "text" },
            enableColumnFilter: true,
          }),
          columnHelper.accessor("status", { id: "status" }),
        ]),
      }),
    ]);
    const { result, getLastSearch } = renderDataTable(
      "?title=bug&sort=status.desc",
      { columns: groupedColumns },
    );

    expect(getFilterSummary(result.current.table.state.columnFilters)).toEqual([
      ["title", "bug"],
    ]);
    expect(result.current.table.state.sorting).toEqual([
      { id: "status", desc: true },
    ]);

    act(() =>
      result.current.table.setColumnFilters([{ id: "title", value: "fix" }]),
    );

    await waitFor(() => expect(getLastSearch()?.get("title")).toBe("fix"));
  });

  it("treats a filterable column without a variant as text", () => {
    const plainColumns = columnHelper.columns([
      columnHelper.accessor("title", { id: "title", enableColumnFilter: true }),
    ]);
    const { result } = renderDataTable("?title=bug", { columns: plainColumns });
    const { table } = result.current;

    expect(table.getColumn("title")?.columnDef.meta?.variant).toBe("text");
    expect(getFilterSummary(table.state.columnFilters)).toEqual([
      ["title", "bug"],
    ]);
  });

  it("applies the config to the columns", async () => {
    const config = createDataTableConfig({
      columns: {
        code: { variant: "text" },
        title: { enableSorting: false },
      },
    });
    const { result, getLastSearch } = renderDataTable("?code=T-1&status=todo", {
      config,
    });
    const { table } = result.current;

    expect(table.getColumn("code")?.getCanFilter()).toBe(true);
    expect(table.getColumn("code")?.getCanSort()).toBe(true);
    expect(table.getColumn("code")?.columnDef.meta?.variant).toBe("text");
    expect(table.getColumn("title")?.getCanFilter()).toBe(false);
    expect(table.getColumn("title")?.getCanSort()).toBe(false);
    expect(table.getColumn("status")?.getCanFilter()).toBe(false);
    expect(table.getColumn("status")?.getCanSort()).toBe(false);
    expect(getFilterSummary(table.state.columnFilters)).toEqual([
      ["code", "T-1"],
    ]);

    act(() => table.setSorting([{ id: "code", desc: true }]));

    await waitFor(() => expect(getLastSearch()?.get("sort")).toBe("code.desc"));
  });

  it("uses the config's defaults over initialState", () => {
    const config = createDataTableConfig({
      columns: tableColumns,
      defaultSorting: [{ id: "title", desc: true }],
      defaultPageSize: 25,
    });
    const { result } = renderDataTable("", {
      config,
      initialState: {
        // @ts-expect-error the config owns the default sorting
        sorting: [{ id: "status", desc: false }],
        pagination: { pageIndex: 0, pageSize: 50 },
      },
    });

    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
    expect(result.current.table.state.pagination.pageSize).toBe(25);

    act(() => result.current.table.resetSorting());

    expect(result.current.table.state.sorting).toEqual([
      { id: "title", desc: true },
    ]);
  });

  it("takes the join operator, global filter and page sizes from the config", () => {
    const config = createDataTableConfig({
      columns: tableColumns,
      defaultJoinOperator: "or",
      enableGlobalFilter: false,
      pageSizeOptions: [5, 15],
    });
    const { result } = renderDataTable("?search=bug", { config });
    const { table } = result.current;

    expect(table.getJoinOperator()).toBe("or");
    expect(table.state.globalFilter).toBe("");
    expect(table.options.pageSizeOptions).toEqual([5, 15]);

    act(() => table.resetJoinOperator());

    expect(result.current.table.getJoinOperator()).toBe("or");
  });

  it("ignores the URL global filter when global filtering is off", () => {
    const { result } = renderDataTable("?search=bug", {
      config: configWithoutSearch,
    });

    expect(result.current.table.state.globalFilter).toBe("");
  });

  it("never writes the global filter when global filtering is off", async () => {
    const { result, getLastSearch } = renderDataTable("?page=3", {
      config: configWithoutSearch,
    });

    act(() => result.current.table.setGlobalFilter("feature"));

    expect(result.current.table.state.globalFilter).toBe("");
    expect(result.current.table.state.pagination.pageIndex).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getLastSearch()).toBeUndefined();
  });

  it("leaves global filtering to the server in server mode", () => {
    const tasks: Task[] = [
      { id: "1", code: "T-1", title: "login bug", status: "todo" },
      { id: "2", code: "T-2", title: "new feature", status: "done" },
    ];
    const { result } = renderDataTable("?search=bug", {
      data: tasks,
    });

    expect(result.current.table.state.globalFilter).toBe("bug");
    expect(result.current.table.getRowModel().rows).toHaveLength(2);
  });

  it("reads sorting and filters for columns defined by accessorKey alone", async () => {
    const tasks: Task[] = [
      { id: "1", code: "T-1", title: "bug b", status: "todo" },
      { id: "2", code: "T-2", title: "bug a", status: "done" },
      { id: "3", code: "T-3", title: "feat", status: "todo" },
    ];
    const keyColumns = columnHelper.columns([
      columnHelper.accessor("title", {
        meta: { variant: "text" },
        enableColumnFilter: true,
      }),
    ]);

    const { result } = renderDataTable("?sort=title.asc&title=bug", {
      mode: "client",
      data: tasks,
      columns: keyColumns,
    });

    await waitFor(() =>
      expect(
        result.current.table.getRowModel().rows.map((row) => row.original.id),
      ).toEqual(["2", "1"]),
    );
  });
});

function renderDataTable(
  search: string,
  props: Partial<UseDataTableProps<Task>> = {},
) {
  return renderHookWithUrl(search, () => useTestDataTable(props));
}

function renderDataTables(
  search: string,
  first: Partial<UseDataTableProps<Task>>,
  second: Partial<UseDataTableProps<Task>>,
) {
  return renderHookWithUrl(search, () => ({
    first: useTestDataTable(first),
    second: useTestDataTable(second),
  }));
}

const tableColumns = {
  code: { enableSorting: false },
  title: { variant: "text" },
  status: { variant: "select" },
} as const;

const config = createDataTableConfig({ columns: tableColumns });

const configWithoutSearch = createDataTableConfig({
  columns: tableColumns,
  enableGlobalFilter: false,
});

const columns = columnHelper.columns([
  columnHelper.accessor("code", { id: "code", enableSorting: false }),
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
  columnHelper.display({ id: "actions" }),
]);

const data: Task[] = [];

function useTestDataTable(props: Partial<UseDataTableProps<Task>>) {
  return useDataTable<Task>({
    config,
    data,
    columns,
    pageCount: 10,
    debounceMs: 10,
    ...props,
  } as UseDataTableProps<Task>);
}

function renderHookWithUrl<TResult>(search: string, useResult: () => TResult) {
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

  const hook = renderHook(useResult, { wrapper: Wrapper });

  function navigate(nextSearch: string) {
    currentSearch = nextSearch;
    window.history.replaceState(null, "", `/${nextSearch}`);
    hook.rerender();
  }

  function getLastSearch() {
    return updates.at(-1)?.searchParams;
  }

  return { ...hook, updates, navigate, getLastSearch };
}

function getFilterSummary(filters: { id: string; value: unknown }[]) {
  return filters.map((filter) => [filter.id, filter.value]);
}
