import { createColumnHelper } from "@tanstack/react-table";
import { act, renderHook } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
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

interface Request {
  query: DataQuery;
  signal: AbortSignal;
  resolve: (result: DataResult<Task>) => void;
  reject: (error: unknown) => void;
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("useDataTable fetcher", () => {
  it("loads, then shows the rows and row count", async () => {
    const { requests, fetcher } = createFetcher();
    const { result } = renderTable("?page=2", { fetcher });

    expect(result.current.status).toBe("loading");
    expect(result.current.table.options.status).toBe("loading");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.query.page).toEqual({ index: 1, size: 10 });

    await act(async () => requests[0]?.resolve(getResult(42, ["a", "b"])));

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeUndefined();
    expect(getTitles(result.current.table)).toEqual(["a", "b"]);
    expect(result.current.table.options.rowCount).toBe(42);
    expect(result.current.table.options.manualPagination).toBe(true);
    expect(result.current.table.options.manualSorting).toBe(true);
    expect(result.current.table.options.manualFiltering).toBe(true);
  });

  it("keeps the previous rows while a new query is refreshing", async () => {
    vi.useFakeTimers();
    const { requests, fetcher } = createFetcher();
    const { result } = renderTable("", { fetcher });
    await act(async () => requests[0]?.resolve(getResult(30, ["a"])));

    act(() => result.current.table.setPageIndex(1));
    await act(() => vi.runAllTimersAsync());

    expect(result.current.status).toBe("refreshing");
    expect(getTitles(result.current.table)).toEqual(["a"]);
    expect(requests.at(-1)?.query.page.index).toBe(1);

    await act(async () => requests.at(-1)?.resolve(getResult(30, ["b"])));

    expect(result.current.status).toBe("idle");
    expect(getTitles(result.current.table)).toEqual(["b"]);
  });

  it("aborts the request in flight when the query changes", async () => {
    vi.useFakeTimers();
    const { requests, fetcher } = createFetcher();
    const { result } = renderTable("", { fetcher });
    const first = requests[0];

    act(() => result.current.table.setGlobalFilter("fix"));
    act(() =>
      result.current.table.setColumnFilters([{ id: "title", value: "bug" }]),
    );
    await act(() => vi.runAllTimersAsync());

    expect(first?.signal.aborted).toBe(true);
    expect(requests.at(-1)?.signal.aborted).toBe(false);
    expect(requests.at(-1)?.query.filters[0]?.value).toBe("bug");
  });

  it("aborts the request in flight on unmount", () => {
    const { requests, fetcher } = createFetcher();
    const { unmount } = renderTable("", { fetcher });

    unmount();

    expect(requests[0]?.signal.aborted).toBe(true);
  });

  it("never applies a late response for an older query", async () => {
    vi.useFakeTimers();
    const requests: Request[] = [];
    const fetcher: DataFetcher<Task> = (query, { signal }) =>
      new Promise((resolve, reject) => {
        requests.push({ query, signal, resolve, reject });
      });
    const { result } = renderTable("", { fetcher });
    await act(async () => requests[0]?.resolve(getResult(10, ["first"])));

    act(() =>
      result.current.table.setColumnFilters([{ id: "title", value: "b" }]),
    );
    await act(() => vi.runAllTimersAsync());
    act(() =>
      result.current.table.setColumnFilters([{ id: "title", value: "bu" }]),
    );
    await act(() => vi.runAllTimersAsync());

    const [, older, newer] = requests;
    await act(async () => newer?.resolve(getResult(1, ["bu"])));
    await act(async () => older?.resolve(getResult(5, ["b"])));

    expect(result.current.status).toBe("idle");
    expect(getTitles(result.current.table)).toEqual(["bu"]);
    expect(result.current.table.options.rowCount).toBe(1);
  });

  it("ignores a stale response even when the fetcher ignores the signal", async () => {
    vi.useFakeTimers();
    const resolvers: ((result: DataResult<Task>) => void)[] = [];
    const fetcher: DataFetcher<Task> = () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      });
    const { result } = renderTable("", { fetcher });

    act(() => result.current.table.setPageIndex(1));
    await act(() => vi.runAllTimersAsync());
    await act(async () => resolvers[1]?.(getResult(20, ["page 2"])));
    await act(async () => resolvers[0]?.(getResult(20, ["page 1"])));

    expect(getTitles(result.current.table)).toEqual(["page 2"]);
  });

  it("doesn't surface an aborted request as an error", async () => {
    vi.useFakeTimers();
    const { requests, fetcher } = createFetcher({ rejectOnAbort: true });
    const { result } = renderTable("", { fetcher });

    act(() => result.current.table.setPageIndex(1));
    await act(() => vi.runAllTimersAsync());

    expect(requests[0]?.signal.aborted).toBe(true);
    expect(result.current.status).toBe("loading");
    expect(result.current.error).toBeUndefined();

    await act(async () => requests.at(-1)?.resolve(getResult(20, ["b"])));

    expect(result.current.status).toBe("idle");
  });

  it("shows a failed request as an error and drops the rows", async () => {
    const { requests, fetcher } = createFetcher();
    const { result } = renderTable("", { fetcher });
    const failure = new Error("Server unavailable");

    await act(async () => requests[0]?.reject(failure));

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(failure);
    expect(result.current.table.options.error).toBe(failure);
    expect(result.current.table.getRowModel().rows).toEqual([]);
  });

  it("shows an error when the fetcher throws before returning a promise", async () => {
    const failure = new Error("Bad query");
    const fetcher: DataFetcher<Task> = () => {
      throw failure;
    };
    const { result } = renderTable("", { fetcher });

    await act(async () => {});

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(failure);
  });

  it("retries the last query from the table's Retry", async () => {
    const { requests, fetcher } = createFetcher();
    const { result } = renderTable("?page=3", { fetcher });
    await act(async () => requests[0]?.reject(new Error("Timed out")));

    act(() => result.current.table.options.onRetry?.());

    expect(result.current.status).toBe("loading");
    expect(result.current.error).toBeUndefined();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.query).toEqual(requests[0]?.query);

    await act(async () => requests[1]?.resolve(getResult(40, ["c"])));

    expect(result.current.status).toBe("idle");
    expect(getTitles(result.current.table)).toEqual(["c"]);
  });

  it("refetches the same query while keeping the rows", async () => {
    const { requests, fetcher } = createFetcher();
    const { result } = renderTable("", { fetcher });
    await act(async () => requests[0]?.resolve(getResult(10, ["a"])));

    act(() => result.current.refetch());

    expect(result.current.status).toBe("refreshing");
    expect(getTitles(result.current.table)).toEqual(["a"]);
    expect(requests[1]?.query).toBe(requests[0]?.query);

    await act(async () => requests[1]?.resolve(getResult(11, ["a", "new"])));

    expect(result.current.status).toBe("idle");
    expect(getTitles(result.current.table)).toEqual(["a", "new"]);
  });

  it("goes through loading, idle, refreshing, error and loading again", async () => {
    vi.useFakeTimers();
    const { requests, fetcher } = createFetcher();
    const statuses: string[] = [];
    const { result } = renderHookWithUrl("", () => {
      const table = useTable({ fetcher });
      if (statuses.at(-1) !== table.status) statuses.push(table.status);
      return table;
    });

    await act(async () => requests[0]?.resolve(getResult(30, ["a"])));
    act(() => result.current.table.setPageIndex(1));
    await act(() => vi.runAllTimersAsync());
    await act(async () => requests.at(-1)?.reject(new Error("Nope")));
    act(() => result.current.refetch());
    await act(async () => requests.at(-1)?.resolve(getResult(30, ["b"])));

    expect(statuses).toEqual([
      "loading",
      "idle",
      "refreshing",
      "error",
      "loading",
      "idle",
    ]);
  });

  it("uses the latest fetcher without refetching when only its identity changes", async () => {
    const { requests, fetcher } = createFetcher();
    const { result, rerender } = renderHookWithUrl("", () =>
      useTable({ fetcher: (query, context) => fetcher(query, context) }),
    );
    await act(async () => requests[0]?.resolve(getResult(10, ["a"])));

    rerender();
    rerender();

    expect(requests).toHaveLength(1);
    expect(result.current.status).toBe("idle");
  });

  it("commits one result under StrictMode's double effect", async () => {
    const { requests, fetcher } = createFetcher();
    const commits: string[][] = [];
    const { result } = renderHookWithUrl(
      "",
      () => {
        const table = useTable({ fetcher });
        const titlesKey = getTitles(table.table).join();
        React.useEffect(() => {
          commits.push(titlesKey ? titlesKey.split(",") : []);
        }, [titlesKey]);
        return table;
      },
      { isStrict: true },
    );

    expect(requests).toHaveLength(2);
    expect(requests[0]?.signal.aborted).toBe(true);
    expect(requests[1]?.signal.aborted).toBe(false);

    await act(async () => requests[0]?.resolve(getResult(10, ["stale"])));
    await act(async () => requests[1]?.resolve(getResult(10, ["a"])));

    expect(result.current.status).toBe("idle");
    expect(getTitles(result.current.table)).toEqual(["a"]);
    expect(commits.filter((titles) => titles.length > 0)).toEqual([["a"]]);
  });

  it("warns and doesn't fetch when data is passed with a fetcher", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { requests, fetcher } = createFetcher();
    const data = [{ id: "1", title: "from data", status: "todo" }];

    const { result } = renderTable("", {
      data,
      pageCount: 1,
      fetcher,
    } as unknown as Partial<UseDataTableProps<Task>>);

    expect(requests).toHaveLength(0);
    expect(getTitles(result.current.table)).toEqual(["from data"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("either `fetcher`"),
    );
    warn.mockRestore();
  });
});

describe("useDataTable without a fetcher", () => {
  it("passes the status, error and onRetry props through", () => {
    const onRetry = vi.fn();
    const failure = new Error("Down");
    const { result } = renderTable("", {
      result: undefined,
      status: "error",
      error: failure,
      onRetry,
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(failure);
    expect(result.current.table.options.status).toBe("error");

    result.current.refetch();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the data and pageCount path idle", () => {
    const data = [{ id: "1", title: "a", status: "todo" }];
    const { result } = renderTable("", { data, pageCount: 3 });

    expect(result.current.status).toBe("idle");
    expect(result.current.table.options.pageCount).toBe(3);
    expect(() => result.current.refetch()).not.toThrow();
  });

  it("keeps the result path", () => {
    const { result } = renderTable("", {
      result: getResult(25, ["x"]),
      status: "refreshing",
    });

    expect(result.current.status).toBe("refreshing");
    expect(result.current.table.options.rowCount).toBe(25);
    expect(getTitles(result.current.table)).toEqual(["x"]);
  });
});

function createFetcher({ rejectOnAbort = false } = {}) {
  const requests: Request[] = [];
  const fetcher: DataFetcher<Task> = (query, { signal }) =>
    new Promise((resolve, reject) => {
      requests.push({ query, signal, resolve, reject });
      if (!rejectOnAbort) return;
      signal.addEventListener("abort", () => {
        reject(new DOMException("The request was aborted.", "AbortError"));
      });
    });

  return { requests, fetcher };
}

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

function useTable(props: Partial<UseDataTableProps<Task>>) {
  return useDataTable<Task>({
    config,
    columns,
    getRowId: (row) => row.id,
    ...props,
  } as UseDataTableProps<Task>);
}

function renderHookWithUrl<TResult>(
  search: string,
  useResult: () => TResult,
  { isStrict = false } = {},
) {
  window.history.replaceState(null, "", `/${search}`);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NuqsTestingAdapter hasMemory searchParams={search}>
        {children}
      </NuqsTestingAdapter>
    );
  }

  return renderHook(useResult, {
    wrapper: Wrapper,
    reactStrictMode: isStrict,
  });
}

function renderTable(search: string, props: Partial<UseDataTableProps<Task>>) {
  return renderHookWithUrl(search, () => useTable(props));
}

function getResult(rowCount: number, titles: string[]): DataResult<Task> {
  return {
    rows: titles.map((title, index) => ({
      id: `${title}-${index}`,
      title,
      status: "todo",
    })),
    rowCount,
  };
}

function getTitles(table: ReturnType<typeof useTable>["table"]) {
  return table.getRowModel().rows.map((row) => row.original.title);
}
