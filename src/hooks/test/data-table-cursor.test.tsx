import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { useDataTable as useRadixDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/aria/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

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

const bases = [
  { name: "radix", DataTable: RadixDataTable, useDataTable: useRadixDataTable },
  { name: "base", DataTable: BaseDataTable, useDataTable: useBaseDataTable },
  { name: "aria", DataTable: AriaDataTable, useDataTable: useAriaDataTable },
] as const;

type Base = (typeof bases)[number];

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe.each(bases)("DataTable cursor pagination ($name)", (ui) => {
  it("renders a Load more row in place of the pager", async () => {
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));

    const button = screen.getByRole("button", { name: "Load more" });
    const loadMoreRow = button.closest("tr");
    expect(loadMoreRow?.querySelectorAll("td")).toHaveLength(1);
    expect(loadMoreRow?.querySelector("td")?.getAttribute("colspan")).toBe("2");
    expect(loadMoreRow?.hasAttribute("aria-rowindex")).toBe(false);
    expect(
      container.querySelector("[data-slot=data-table-pagination]"),
    ).toBeNull();
    expect(requests[0]?.query.cursor).toBeUndefined();
  });

  it("sets aria-rowcount and aria-rowindex", async () => {
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));

    expect(getTable(container).getAttribute("aria-rowcount")).toBe("7");
    expect(
      container.querySelector("thead tr")?.getAttribute("aria-rowindex"),
    ).toBe(ui.name === "aria" ? null : "1");
    expect(getRowIndexes(container)).toEqual(["2", "3"]);
  });

  it("uses -1 for aria-rowcount when the total is unknown", async () => {
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1")));

    expect(getTable(container).getAttribute("aria-rowcount")).toBe("-1");
    expect(screen.getByText("2 loaded")).toBeDefined();
  });

  it("appends each page in order and drops the row on the last page", async () => {
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 5)));

    clickLoadMore();
    expect(requests[1]?.query.cursor).toBe("c1");
    await act(async () => requests[1]?.resolve(getPage(["c", "d"], "c2", 5)));
    clickLoadMore();
    expect(requests[2]?.query.cursor).toBe("c2");
    await act(async () => requests[2]?.resolve(getPage(["e"], null, 5)));

    expect(getTitles(container)).toEqual(["a", "b", "c", "d", "e"]);
    expect(getRowIndexes(container)).toEqual(["2", "3", "4", "5", "6"]);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(getTable(container).getAttribute("aria-rowcount")).toBe("6");
  });

  it("keeps the loaded rows undimmed while loading more", async () => {
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));

    clickLoadMore();

    const button = screen.getByRole("button", { name: "Loading more..." });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("tbody")?.dataset.status).toBeUndefined();
    expect(getTable(container).hasAttribute("aria-busy")).toBe(false);
    expect(container.querySelector("[data-slot=data-table-progress]")).toBe(
      null,
    );

    fireEvent.click(button);
    expect(requests).toHaveLength(2);
  });

  it("moves focus to the first new row and reads the loaded count", async () => {
    vi.useFakeTimers();
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));

    screen.getByRole("button", { name: "Load more" }).focus();
    clickLoadMore();
    expect(getResultCount()).toBe("2 of 6 results loaded");
    await act(async () => requests[1]?.resolve(getPage(["c", "d"], "c2", 6)));

    const rows = getTable(container).querySelectorAll("tbody tr");
    expect(document.activeElement).toBe(rows[2]);
    expect(rows[2]?.getAttribute("aria-rowindex")).toBe("4");
    expect(getResultCount()).toBe("4 of 6 results loaded");
  });

  it("keeps focus on the button and offers Retry when loading more fails", async () => {
    vi.useFakeTimers();
    const { container, requests } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));

    const button = screen.getByRole("button", { name: "Load more" });
    button.focus();
    clickLoadMore();
    await act(async () => requests[1]?.reject(new Error("Network down")));

    expect(screen.getByRole("alert").textContent).toBe("Network down");
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBe(button);
    expect(document.activeElement).toBe(retry);
    expect(getResultCount()).toBe("2 of 6 results loaded");
    expect(getTitles(container)).toEqual(["a", "b"]);

    fireEvent.click(retry);
    expect(requests[2]?.query.cursor).toBe("c1");
    await act(async () => requests[2]?.resolve(getPage(["c"], "c2", 6)));

    expect(getTitles(container)).toEqual(["a", "b", "c"]);
    expect(document.activeElement).toBe(
      getTable(container).querySelectorAll("tbody tr")[2],
    );
  });

  it("starts over from the first page when the query changes", async () => {
    vi.useFakeTimers();
    const { container, requests, getTable: getTanStackTable } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));
    clickLoadMore();
    await act(async () => requests[1]?.resolve(getPage(["c", "d"], "c2", 6)));

    act(() => getTanStackTable()?.setGlobalFilter("x"));
    await act(() => vi.runAllTimersAsync());

    expect(requests[2]?.query.cursor).toBeUndefined();
    expect(requests[2]?.query.search).toBe("x");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();

    await act(async () => requests[2]?.resolve(getPage(["x1", "x2"], "x", 3)));

    expect(getTitles(container)).toEqual(["x1", "x2"]);
    expect(getRowIndexes(container)).toEqual(["2", "3"]);
    expect(getTable(container).getAttribute("aria-rowcount")).toBe("4");
  });

  it("aborts a Load more in flight when the query changes", async () => {
    vi.useFakeTimers();
    const { container, requests, getTable: getTanStackTable } = renderTable(ui);
    await act(async () => requests[0]?.resolve(getPage(["a", "b"], "c1", 6)));
    clickLoadMore();
    const loadMore = requests[1];

    act(() => getTanStackTable()?.setGlobalFilter("x"));
    await act(() => vi.runAllTimersAsync());

    expect(loadMore?.signal.aborted).toBe(true);
    await act(async () => requests[2]?.resolve(getPage(["x1"], "x", 3)));
    await act(async () => loadMore?.resolve(getPage(["late"], "c2", 6)));

    expect(getTitles(container)).toEqual(["x1"]);
    expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
  });
});

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    header: "Title",
    meta: { label: "Title", variant: "text" },
  }),
  columnHelper.accessor("status", { id: "status", header: "Status" }),
]);

const config = createDataTableConfig({
  columns: { title: { variant: "text" }, status: {} },
  defaultPageSize: 2,
});

function renderTable(ui: Base) {
  const { DataTable, useDataTable } = ui;
  const requests: Request[] = [];
  const fetcher: DataFetcher<Task> = (query, { signal }) =>
    new Promise((resolve, reject) => {
      requests.push({ query, signal, resolve, reject });
    });
  const tableRef: {
    current: ReturnType<typeof useDataTable<Task>>["table"] | null;
  } = { current: null };

  function Harness() {
    const { table } = useDataTable<Task>({
      config,
      columns,
      fetcher,
      pagination: "cursor",
      getRowId: (row) => row.id,
    });
    React.useEffect(() => {
      tableRef.current = table;
    });
    return <DataTable aria-label="Tasks" table={table} />;
  }

  const view = render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
    </NuqsTestingAdapter>,
  );
  return { ...view, requests, getTable: () => tableRef.current };
}

function getPage(
  titles: string[],
  nextCursor: string | null,
  rowCount?: number,
): DataResult<Task> {
  return {
    rows: titles.map((title) => ({ id: title, title, status: "todo" })),
    rowCount,
    nextCursor,
  };
}

function clickLoadMore() {
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
}

function getTable(container: HTMLElement) {
  const table = container.querySelector("table");
  if (!table) throw new Error("Table did not render");
  return table;
}

function getTitles(container: HTMLElement) {
  return [...getTable(container).querySelectorAll("tbody tr[aria-rowindex]")]
    .map((row) => row.querySelector("td, th")?.textContent ?? "")
    .filter(Boolean);
}

function getRowIndexes(container: HTMLElement) {
  return [
    ...getTable(container).querySelectorAll("tbody tr[aria-rowindex]"),
  ].map((row) => row.getAttribute("aria-rowindex"));
}

function getResultCount() {
  return (
    document.querySelector('[data-slot="data-table"] > [role="status"]')
      ?.textContent ?? null
  );
}
