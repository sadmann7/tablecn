import { createColumnHelper } from "@tanstack/react-table";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataStatus } from "@/lib/data-table-types";

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

const bases = [
  { name: "radix", DataTable: RadixDataTable, useDataTable: useRadixDataTable },
  { name: "base", DataTable: BaseDataTable, useDataTable: useBaseDataTable },
  { name: "aria", DataTable: AriaDataTable, useDataTable: useAriaDataTable },
] as const;

type Base = (typeof bases)[number];

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    id: "title",
    header: "Title",
    meta: { label: "Title", variant: "text" },
    enableColumnFilter: true,
  }),
  columnHelper.accessor("status", { id: "status", header: "Status" }),
  columnHelper.accessor("id", { id: "id", header: "Id" }),
]);

const config = createDataTableConfig({
  columns: { title: { variant: "text" }, status: {}, id: {} },
});

const tasks: Task[] = Array.from({ length: 25 }, (_, index) => ({
  id: String(index + 1),
  title: `Task ${index + 1}`,
  status: index % 2 ? "done" : "todo",
}));

interface HarnessProps {
  status?: DataStatus;
  error?: unknown;
  onRetry?: () => void;
  data?: Task[];
}

describe.each(bases)("DataTable status ($name)", (ui) => {
  it("renders rows without aria-busy when idle", () => {
    const { container } = renderTable(ui);

    expect(getTable(container).hasAttribute("aria-busy")).toBe(false);
    expect(getBodyRows(container)).toHaveLength(10);
    expect(
      container.querySelector("[data-slot=data-table-progress]"),
    ).toBeNull();
  });

  it("renders skeleton rows capped at ten while loading", () => {
    const { container } = renderTable(ui, { status: "loading" }, "?perPage=20");

    const table = getTable(container);
    expect(table.getAttribute("aria-busy")).toBe("true");

    const rows = getBodyRows(container);
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.querySelectorAll("td")).toHaveLength(3);
      expect(row.querySelectorAll("[data-slot=skeleton]")).toHaveLength(3);
    }
    expect(screen.queryByText("Task 1")).toBeNull();
    expect(screen.getByText("Rows per page")).toBeDefined();
  });

  it("matches the page size when it is under the cap", () => {
    const { container } = renderTable(ui, { status: "loading" }, "?perPage=5");

    expect(getBodyRows(container)).toHaveLength(5);
  });

  it("keeps the rows dimmed with a progress bar while refreshing", () => {
    const { container } = renderTable(ui, { status: "refreshing" });

    const table = getTable(container);
    expect(table.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Task 1")).toBeDefined();
    expect(getBodyRows(container)).toHaveLength(10);
    expect(table.querySelector("tbody")?.getAttribute("data-status")).toBe(
      "refreshing",
    );

    const progress = container.querySelector("[data-slot=data-table-progress]");
    expect(progress?.getAttribute("aria-hidden")).toBe("true");
    expect(progress?.innerHTML).toContain("motion-reduce:animate-none");
  });

  it("shows the error in one row spanning every column", () => {
    const onRetry = vi.fn();
    const { container } = renderTable(ui, {
      status: "error",
      error: new Error("Network down"),
      onRetry,
    });

    const rows = getBodyRows(container);
    expect(rows).toHaveLength(1);
    const cell = rows[0]?.querySelector("td");
    expect(cell?.getAttribute("colspan")).toBe("3");
    expect(within(cell as HTMLElement).getByText("Network down")).toBeDefined();
    expect(getTable(container).hasAttribute("aria-busy")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generic error message without a retry", () => {
    renderTable(ui, { status: "error", error: {} });

    expect(screen.getByText("Failed to load results.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows no results without a clear button when nothing is filtered", () => {
    renderTable(ui, { data: [] });

    expect(screen.getByText("No results.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("clears the filters and search from the empty state", async () => {
    const { container } = renderTable(ui, {}, "?title=nothing&search=zzz");

    expect(screen.getByText("No results.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => expect(getBodyRows(container)).toHaveLength(10));
    expect(screen.getByText("Task 1")).toBeDefined();
  });

  it("reads the result count once loading finishes", () => {
    const { rerender } = renderTable(ui, { status: "loading" });
    expect(getResultCount()).toBe("");

    rerender({ status: "idle", data: tasks.slice(0, 7) });
    expect(getResultCount()).toBe("7 results");
  });

  it("keeps the result count while refreshing", () => {
    const { rerender } = renderTable(ui, { status: "refreshing" });
    expect(getResultCount()).toBe("25 results");

    rerender({ status: "idle" });
    expect(getResultCount()).toBe("25 results");
  });

  it("alerts a failure and clears the result count", () => {
    const { rerender } = renderTable(ui, { status: "idle" });
    expect(screen.queryByRole("alert")).toBeNull();

    rerender({ status: "error", error: "Network down" });
    expect(screen.getByRole("alert").textContent).toBe("Network down");
    expect(getResultCount()).toBe("");
  });

  it("disables the page buttons and hides the page count while loading or failed", () => {
    const { rerender } = renderTable(ui, { status: "loading" });
    const nextButton = screen.getByRole("button", {
      name: "Go to next page",
    });
    expect(nextButton).toHaveProperty("disabled", true);
    expect(screen.getByText(/^Page \d/).textContent).toBe("Page 1");

    rerender({ status: "error", error: "Network down" });
    expect(nextButton).toHaveProperty("disabled", true);
    expect(screen.getByText(/^Page \d/).textContent).toBe("Page 1");

    rerender({ status: "refreshing" });
    expect(nextButton).toHaveProperty("disabled", false);
    expect(screen.getByText(/^Page \d/).textContent).toBe("Page 1 of 3");

    rerender({ status: "idle" });
    expect(nextButton).toHaveProperty("disabled", false);
  });
});

describe("useDataTable status", () => {
  it("defaults the table status to idle", () => {
    const statusRef: { current?: DataStatus } = {};

    function Harness() {
      const { table } = useRadixDataTable<Task>({
        config,
        mode: "client",
        data: tasks,
        columns,
      });
      statusRef.current = table.options.status;
      return null;
    }

    render(
      <NuqsTestingAdapter>
        <Harness />
      </NuqsTestingAdapter>,
    );

    expect(statusRef.current).toBe("idle");
  });
});

function renderTable(ui: Base, props: HarnessProps = {}, search = "") {
  const { DataTable, useDataTable } = ui;

  function Harness({ data = tasks, ...options }: HarnessProps) {
    const { table } = useDataTable<Task>({
      config,
      mode: "client",
      data,
      columns,
      getRowId: (row) => row.id,
      ...options,
    });

    return <DataTable aria-label="Tasks" table={table} />;
  }

  function Root(harnessProps: HarnessProps) {
    return (
      <NuqsTestingAdapter hasMemory searchParams={search}>
        <Harness {...harnessProps} />
      </NuqsTestingAdapter>
    );
  }

  const view = render(<Root {...props} />);
  return {
    ...view,
    rerender: (next: HarnessProps) => view.rerender(<Root {...next} />),
  };
}

function getTable(container: HTMLElement) {
  const table = container.querySelector("table");
  if (!table) throw new Error("Table did not render");
  return table;
}

function getBodyRows(container: HTMLElement) {
  return getTable(container).querySelectorAll("tbody tr");
}

function getResultCount() {
  return (
    document.querySelector('[data-slot="data-table"] > [role="status"]')
      ?.textContent ?? null
  );
}
