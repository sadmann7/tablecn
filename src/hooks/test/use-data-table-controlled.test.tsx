import { createColumnHelper } from "@tanstack/react-table";
import { act, render, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  DataFetcher,
  DataQuery,
  DataResult,
} from "@/lib/data-table-types";

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

const config = createDataTableConfig({
  columns: {
    title: { variant: "text" },
    status: { variant: "select" },
  },
});

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

const rows: Task[] = [
  { id: "1", title: "a", status: "todo" },
  { id: "2", title: "b", status: "done" },
];

type TestTable = ReturnType<typeof useTable>["table"];

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("useDataTable controlled query", () => {
  it("reads the state from the query without a nuqs adapter", () => {
    const query: DataQuery = {
      sorting: [{ id: "title", desc: true }],
      filters: [
        {
          id: "status",
          value: ["todo"],
          variant: "select",
          operator: "inArray",
          filterId: "status-0",
        },
      ],
      joinOperator: "or",
      search: "fix",
      page: { index: 2, size: 20 },
    };
    const { result } = renderHook(() =>
      useTable({ data: rows, pageCount: 5, query }),
    );

    const { state } = result.current.table;
    expect(state.sorting).toEqual(query.sorting);
    expect(state.columnFilters).toEqual(query.filters);
    expect(state.joinOperator).toBe("or");
    expect(state.globalFilter).toBe("fix");
    expect(state.pagination).toEqual({ pageIndex: 2, pageSize: 20 });
    expect(result.current.query).toEqual(query);
  });

  it("writes changes through onQueryChange and leaves the URL alone", () => {
    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useTable({
        data: rows,
        pageCount: 5,
        query: config.defaultQuery,
        onQueryChange,
      }),
    );

    act(() => result.current.table.setPageIndex(3));

    expect(onQueryChange).toHaveBeenLastCalledWith({
      ...config.defaultQuery,
      page: { index: 3, size: 10 },
    });
    expect(window.location.search).toBe("");
  });

  it("stays on the query it was given until the app passes a new one", () => {
    const onQueryChange = vi.fn();
    const { result } = renderHook(() =>
      useTable({
        data: rows,
        pageCount: 5,
        query: config.defaultQuery,
        onQueryChange,
      }),
    );

    act(() => result.current.table.setSorting([{ id: "title", desc: false }]));

    expect(onQueryChange).toHaveBeenCalledOnce();
    expect(result.current.table.state.sorting).toEqual([]);
  });

  it.each([
    [
      "sorting",
      (table: TestTable) => table.setSorting([{ id: "title", desc: true }]),
    ],
    [
      "filters",
      (table: TestTable) =>
        table.setColumnFilters([{ id: "title", value: "bug" }]),
    ],
    ["search", (table: TestTable) => table.setGlobalFilter("fix")],
    ["join operator", (table: TestTable) => table.setJoinOperator("or")],
  ])("resets the page when the %s changes", (_, change) => {
    const { result, onQueryChange } = renderControlled({
      ...config.defaultQuery,
      page: { index: 4, size: 10 },
    });

    act(() => change(result.current.table));

    expect(onQueryChange).toHaveBeenCalledOnce();
    expect(onQueryChange.mock.lastCall?.[0].page).toEqual({
      index: 0,
      size: 10,
    });
  });

  it("keeps the first visible row when only the page size changes", () => {
    const { result, onQueryChange } = renderControlled({
      ...config.defaultQuery,
      page: { index: 4, size: 10 },
    });

    act(() => result.current.table.setPageSize(20));

    expect(onQueryChange.mock.lastCall?.[0].page).toEqual({
      index: 2,
      size: 20,
    });
  });

  it("moves a page past the last page to the last page", () => {
    const { result, onQueryChange } = renderControlled({
      ...config.defaultQuery,
      page: { index: 10, size: 10 },
    });

    expect(result.current.table.state.pagination.pageIndex).toBe(4);
    expect(onQueryChange).toHaveBeenCalledOnce();
    expect(onQueryChange.mock.lastCall?.[0].page).toEqual({
      index: 4,
      size: 10,
    });
  });

  it("writes filters in the same shape the URL reads them", () => {
    const { result, onQueryChange } = renderControlled(config.defaultQuery);

    act(() =>
      result.current.table.setColumnFilters([
        { id: "status", value: ["todo", "done"] },
        { id: "title", value: "bug" },
      ]),
    );

    expect(onQueryChange.mock.lastCall?.[0].filters).toEqual([
      {
        id: "status",
        value: ["todo", "done"],
        variant: "select",
        operator: "inArray",
        filterId: "status-0",
      },
      {
        id: "title",
        value: "bug",
        variant: "text",
        operator: "iLike",
        filterId: "title-0",
      },
    ]);
  });

  it("keeps an empty filter as a draft without writing it", () => {
    const { result, onQueryChange } = renderControlled(config.defaultQuery);

    act(() =>
      result.current.table.setColumnFilters([
        {
          id: "title",
          value: "",
          variant: "text",
          operator: "iLike",
          filterId: "draft",
        },
      ]),
    );

    expect(onQueryChange).not.toHaveBeenCalled();
    expect(result.current.table.state.columnFilters).toHaveLength(1);
  });

  it("merges several changes made in one event", () => {
    const { result, onQueryChange } = renderControlled(config.defaultQuery);

    act(() => {
      result.current.table.setGlobalFilter("fix");
      result.current.table.setSorting([{ id: "title", desc: true }]);
    });

    expect(onQueryChange.mock.lastCall?.[0]).toMatchObject({
      search: "fix",
      sorting: [{ id: "title", desc: true }],
    });
  });

  it("keeps two tables on one page independent", () => {
    const tables: TestTable[] = [];

    function Tables() {
      const [first, setFirst] = React.useState(config.defaultQuery);
      const [second, setSecond] = React.useState(config.defaultQuery);
      tables[0] = useTable({
        data: rows,
        pageCount: 5,
        query: first,
        onQueryChange: setFirst,
      }).table;
      tables[1] = useTable({
        data: rows,
        pageCount: 5,
        query: second,
        onQueryChange: setSecond,
      }).table;
      return null;
    }

    render(<Tables />);
    act(() => tables[0]?.setPageIndex(2));
    act(() => tables[1]?.setSorting([{ id: "title", desc: true }]));

    expect(tables[0]?.state.pagination.pageIndex).toBe(2);
    expect(tables[0]?.state.sorting).toEqual([]);
    expect(tables[1]?.state.pagination.pageIndex).toBe(0);
    expect(tables[1]?.state.sorting).toEqual([{ id: "title", desc: true }]);
    expect(window.location.search).toBe("");
  });

  it("feeds the controlled query to the fetcher", async () => {
    const queries: DataQuery[] = [];
    const resolvers: ((result: DataResult<Task>) => void)[] = [];
    const fetcher: DataFetcher<Task> = (query) =>
      new Promise((resolve) => {
        queries.push(query);
        resolvers.push(resolve);
      });

    const { result } = renderHook(() => {
      const [query, setQuery] = React.useState(config.defaultQuery);
      return useTable({ fetcher, query, onQueryChange: setQuery });
    });
    await act(async () => resolvers[0]?.({ rows, rowCount: 2 }));
    act(() => result.current.table.setGlobalFilter("b"));

    expect(queries.map((query) => query.search)).toEqual(["", "b"]);
    expect(result.current.status).toBe("refreshing");
  });

  it("reads the page from the query with a result", () => {
    const { result } = renderHook(() => {
      const [query, setQuery] = React.useState(config.defaultQuery);
      return useTable({
        result: { rows, rowCount: 42 },
        query,
        onQueryChange: setQuery,
      });
    });

    act(() => result.current.table.nextPage());

    expect(result.current.query.page.index).toBe(1);
    expect(result.current.table.getPageCount()).toBe(5);
  });
});

function renderControlled(query: DataQuery) {
  const onQueryChange = vi.fn<(query: DataQuery) => void>();
  const rendered = renderHook(() =>
    useTable({ data: rows, pageCount: 5, query, onQueryChange }),
  );
  return { ...rendered, onQueryChange };
}

function useTable(props: Partial<UseDataTableProps<Task>>) {
  return useDataTable<Task>({
    config,
    columns,
    getRowId: (row) => row.id,
    ...props,
  } as UseDataTableProps<Task>);
}
