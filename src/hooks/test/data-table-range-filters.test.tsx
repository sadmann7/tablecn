import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem } from "@/lib/data-table-types";

import { createDataTableConfig } from "@/lib/data-table-config";
import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { DataTableToolbar as AriaDataTableToolbar } from "@/registry/bases/aria/components/data-table/data-table-toolbar";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { DataTableToolbar as BaseDataTableToolbar } from "@/registry/bases/base/components/data-table/data-table-toolbar";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableRangeFilter } from "@/registry/bases/radix/components/data-table/data-table-range-filter";
import { DataTableSliderFilter } from "@/registry/bases/radix/components/data-table/data-table-slider-filter";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/base/ui/direction", () => ({
  useDirection: () => "ltr",
}));
vi.mock("@/registry/bases/aria/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Task {
  id: string;
  hours: number;
}

const data: Task[] = [
  { id: "1", hours: 2 },
  { id: "2", hours: 8 },
  { id: "3", hours: 20 },
];

const config = createDataTableConfig({
  columns: { hours: { variant: "number" } },
});

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("hours", {
    id: "hours",
    meta: {
      label: "Hours",
      variant: "number",
      min: 1,
      max: 24,
      unit: "hr",
    },
    enableColumnFilter: true,
  }),
]);

const columnsWithoutRange = columnHelper.columns([
  columnHelper.accessor("hours", {
    id: "hours",
    meta: { label: "Hours", variant: "number" },
    enableColumnFilter: true,
  }),
]);

describe("DataTableSliderFilter", () => {
  it("applies a valid bound while typing and holds one that crosses", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { table, openFilter } = renderToolbar();
      act(() => table.getColumn("hours")?.setFilterValue([5, 24]));
      const [, to] = openFilter();

      fireEvent.change(to, { target: { value: "1" } });
      expect(table.getColumn("hours")?.getFilterValue()).toEqual([5, 24]);
      expect((to as HTMLInputElement).value).toBe("1");
      expect(to.getAttribute("aria-invalid")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(to.getAttribute("aria-invalid")).toBe("true");

      fireEvent.change(to, { target: { value: "12" } });
      expect(table.getColumn("hours")?.getFilterValue()).toEqual([5, 12]);
      expect(to.getAttribute("aria-invalid")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes both bounds when one side starts at the column range", () => {
    const { table, openFilter } = renderToolbar();
    const [from] = openFilter();

    fireEvent.change(from, { target: { value: "10" } });

    expect(table.getColumn("hours")?.getFilterValue()).toEqual([10, 24]);
  });

  it("clears the filter when a cleared bound leaves the full range", () => {
    const { table, openFilter } = renderToolbar();
    act(() => table.getColumn("hours")?.setFilterValue([5, 24]));
    const [from] = openFilter();

    fireEvent.change(from, { target: { value: "" } });
    fireEvent.focusOut(from);

    expect(table.getColumn("hours")?.getFilterValue()).toBeUndefined();
  });

  it("waits until focus leaves both inputs before swapping", () => {
    const { table, openFilter } = renderToolbar();
    act(() => table.getColumn("hours")?.setFilterValue([5, 10]));
    const [from, to] = openFilter();

    fireEvent.change(from, { target: { value: "15" } });
    fireEvent.focusOut(from, { relatedTarget: to });
    expect((from as HTMLInputElement).value).toBe("15");
    expect(table.getColumn("hours")?.getFilterValue()).toEqual([5, 10]);

    fireEvent.focusOut(to, { relatedTarget: document.body });
    expect(table.getColumn("hours")?.getFilterValue()).toEqual([10, 15]);
  });

  it("clamps and swaps bounds on Enter", () => {
    const { table, openFilter } = renderToolbar();
    act(() => table.getColumn("hours")?.setFilterValue([5, 10]));
    const [from] = openFilter();

    fireEvent.change(from, { target: { value: "30" } });
    fireEvent.keyDown(from, { key: "Enter" });

    expect(table.getColumn("hours")?.getFilterValue()).toEqual([10, 24]);
    expect((from as HTMLInputElement).value).toBe("10");
  });

  it("reads the faceted range again when the popover opens", () => {
    const { openFilter, rerenderData } = renderToolbar(columnsWithoutRange, {
      slider: true,
    });
    const [from, to] = openFilter();
    expect((from as HTMLInputElement).value).toBe("2");
    expect((to as HTMLInputElement).value).toBe("20");

    fireEvent.keyDown(to, { key: "Escape" });
    rerenderData([...data, { id: "4", hours: 90 }]);
    const [, nextTo] = openFilter();

    expect((nextTo as HTMLInputElement).value).toBe("90");
  });
});

describe("DataTableSliderFilter (aria)", () => {
  it("lets the slider reach the column max when the step does not divide the range", () => {
    function Harness() {
      const { table } = useAriaDataTable<Task>({
        config,
        mode: "client",
        data,
        columns,
        getRowId: (row) => row.id,
      });
      return (
        <AriaDataTable aria-label="Tasks" table={table}>
          <AriaDataTableToolbar table={table} />
        </AriaDataTable>
      );
    }

    render(
      <NuqsTestingAdapter hasMemory>
        <Harness />
      </NuqsTestingAdapter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Hours/ }));
    const thumbs = screen.getAllByRole("slider");

    expect(thumbs.map((thumb) => (thumb as HTMLInputElement).value)).toEqual([
      "1",
      "24",
    ]);
  });
});

describe.each([
  {
    base: "radix",
    Table: DataTable,
    Toolbar: DataTableToolbar,
    useTable: useDataTable,
  },
  {
    base: "base",
    Table: BaseDataTable,
    Toolbar: BaseDataTableToolbar,
    useTable: useBaseDataTable,
  },
  {
    base: "aria",
    Table: AriaDataTable,
    Toolbar: AriaDataTableToolbar,
    useTable: useAriaDataTable,
  },
])("number column toolbar ($base)", ({ Table, Toolbar, useTable }) => {
  function Harness({
    toolbarColumns,
    mode,
  }: {
    toolbarColumns: typeof columns;
    mode: "client" | "server";
  }) {
    const { table } = useTable<Task>({
      config,
      data,
      columns: toolbarColumns,
      getRowId: (row) => row.id,
      ...(mode === "server" ? { pageCount: 1 } : { mode: "client" }),
    });
    return (
      <Table aria-label="Tasks" table={table}>
        <Toolbar table={table} />
      </Table>
    );
  }

  function renderHarness(
    toolbarColumns: typeof columns,
    mode: "client" | "server" = "client",
  ) {
    render(
      <NuqsTestingAdapter hasMemory>
        <Harness toolbarColumns={toolbarColumns} mode={mode} />
      </NuqsTestingAdapter>,
    );
  }

  it("uses the faceted range for the slider in client mode", () => {
    renderHarness(columnsWithoutRange);

    expect(screen.getByRole("button", { name: /^Hours/ })).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("renders a number input in server mode without meta.min and meta.max", () => {
    renderHarness(columnsWithoutRange, "server");

    expect(screen.getByRole("spinbutton")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Hours/ })).toBeNull();
  });

  it("renders the slider when meta.min and meta.max are set", () => {
    renderHarness(columns, "server");

    expect(screen.getByRole("button", { name: /^Hours/ })).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});

describe("DataTableSliderFilter in server mode", () => {
  it("warns when the column has no meta.min or meta.max", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      renderToolbar(columnsWithoutRange, { mode: "server", slider: true });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'column "hours" is missing `meta.min` or `meta.max`',
        ),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("stays quiet when meta.min and meta.max are set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      renderToolbar(columns, { mode: "server" });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("DataTableRangeFilter", () => {
  it("applies bounds beyond the column range without clamping", () => {
    const { onFilterUpdate, inputs } = renderRangeFilter(["", ""]);
    const [, max] = inputs;

    fireEvent.change(max, { target: { value: "100" } });
    expect(onFilterUpdate).toHaveBeenLastCalledWith("hours-filter", {
      value: ["", "100"],
    });

    fireEvent.focusOut(max);
    expect(onFilterUpdate).toHaveBeenLastCalledWith("hours-filter", {
      value: ["", "100"],
    });
  });

  it("swaps crossed bounds on Enter", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { onFilterUpdate, inputs } = renderRangeFilter(["", "10"]);
      const [min] = inputs;

      fireEvent.change(min, { target: { value: "15" } });
      expect(onFilterUpdate).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(min.getAttribute("aria-invalid")).toBe("true");

      fireEvent.keyDown(min, { key: "Enter" });
      expect(min.getAttribute("aria-invalid")).toBeNull();
      expect(onFilterUpdate).toHaveBeenCalledWith("hours-filter", {
        value: ["10", "15"],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits until focus leaves both inputs before swapping", () => {
    const { onFilterUpdate, inputs } = renderRangeFilter(["", "10"]);
    const [min, max] = inputs;

    fireEvent.change(min, { target: { value: "15" } });
    fireEvent.focusOut(min, { relatedTarget: max });
    expect(onFilterUpdate).not.toHaveBeenCalled();

    fireEvent.focusOut(max, { relatedTarget: document.body });
    expect(onFilterUpdate).toHaveBeenCalledWith("hours-filter", {
      value: ["10", "15"],
    });
  });

  it("keeps an empty bound open", () => {
    const { onFilterUpdate, inputs } = renderRangeFilter(["5", "10"]);
    const [min] = inputs;

    fireEvent.change(min, { target: { value: "" } });
    fireEvent.focusOut(min);

    expect(onFilterUpdate).toHaveBeenCalledWith("hours-filter", {
      value: ["", "10"],
    });
  });
});

function renderToolbar(
  toolbarColumns = columns,
  {
    mode = "client",
    slider = false,
  }: { mode?: "client" | "server"; slider?: boolean } = {},
) {
  const tableRef: {
    current?: ReturnType<typeof useDataTable<Task>>["table"];
  } = {};

  function Harness({ rows }: { rows: Task[] }) {
    const { table } = useDataTable<Task>(
      mode === "server"
        ? {
            config,
            data: rows,
            columns: toolbarColumns,
            pageCount: 1,
            getRowId: (row) => row.id,
          }
        : {
            mode: "client",
            config,
            data: rows,
            columns: toolbarColumns,
            getRowId: (row) => row.id,
          },
    );
    tableRef.current = table;

    return (
      <DataTable aria-label="Tasks" table={table}>
        {slider ? (
          <SliderOnly table={table} />
        ) : (
          <DataTableToolbar table={table} />
        )}
      </DataTable>
    );
  }

  const view = render(
    <NuqsTestingAdapter hasMemory>
      <Harness rows={data} />
    </NuqsTestingAdapter>,
  );

  const table = tableRef.current;
  if (!table) throw new Error("Table did not render");

  function openFilter() {
    fireEvent.click(screen.getByRole("button", { name: /^Hours/ }));
    const popover = screen.getByRole("dialog", { name: "Hours filter" });
    const inputs = popover.querySelectorAll("input[type=number]");
    const [from, to] = inputs;
    if (!from || !to) throw new Error("Range inputs did not render");
    return [from, to] as const;
  }

  function rerenderData(rows: Task[]) {
    view.rerender(
      <NuqsTestingAdapter hasMemory>
        <Harness rows={rows} />
      </NuqsTestingAdapter>,
    );
  }

  return { table, openFilter, rerenderData };
}

function renderRangeFilter(value: [string, string]) {
  const onFilterUpdate = vi.fn();
  const filter: ColumnFilterItem = {
    id: "hours",
    variant: "number",
    operator: "isBetween",
    value,
    filterId: "hours-filter",
  };

  function Harness() {
    const { table } = useDataTable<Task>({
      config,
      mode: "client",
      data,
      columns,
      getRowId: (row) => row.id,
    });
    const column = table.getColumn("hours");
    if (!column) return null;

    return (
      <DataTableRangeFilter
        filter={filter}
        column={column}
        inputId="hours"
        onFilterUpdate={onFilterUpdate}
      />
    );
  }

  const view = render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
    </NuqsTestingAdapter>,
  );
  const [min, max] = view.container.querySelectorAll("input[type=number]");
  if (!min || !max) throw new Error("Range inputs did not render");

  return { onFilterUpdate, inputs: [min, max] as const };
}

function SliderOnly({
  table,
}: {
  table: ReturnType<typeof useDataTable<Task>>["table"];
}) {
  const column = table.getColumn("hours");
  return column ? (
    <DataTableSliderFilter column={column} title="Hours" />
  ) : null;
}
