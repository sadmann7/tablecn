import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem } from "@/lib/data-table-types";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableRangeFilter } from "@/registry/bases/radix/components/data-table/data-table-range-filter";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

vi.mock("@/registry/bases/radix/ui/direction", () => ({
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

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("hours", {
    id: "hours",
    meta: {
      label: "Hours",
      variant: "number",
      filter: "range",
      range: [1, 24],
      unit: "hr",
    },
    enableColumnFilter: true,
  }),
]);

describe("DataTableSliderFilter", () => {
  it("applies a valid bound while typing and holds one that crosses", () => {
    const { table, openFilter } = renderToolbar();
    act(() => table.getColumn("hours")?.setFilterValue([5, 24]));
    const [, to] = openFilter();

    fireEvent.change(to, { target: { value: "1" } });
    expect(table.getColumn("hours")?.getFilterValue()).toEqual([5, 24]);
    expect((to as HTMLInputElement).value).toBe("1");

    fireEvent.change(to, { target: { value: "12" } });
    expect(table.getColumn("hours")?.getFilterValue()).toEqual([5, 12]);
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
    fireEvent.blur(from);

    expect(table.getColumn("hours")?.getFilterValue()).toBeUndefined();
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
});

describe("DataTableRangeFilter", () => {
  it("applies a valid bound while typing and clamps an invalid one on blur", () => {
    const { onFilterUpdate, inputs } = renderRangeFilter(["", ""]);
    const [, max] = inputs;

    fireEvent.change(max, { target: { value: "10" } });
    expect(onFilterUpdate).toHaveBeenLastCalledWith("hours-filter", {
      value: ["", "10"],
    });

    fireEvent.change(max, { target: { value: "100" } });
    expect(onFilterUpdate).toHaveBeenCalledTimes(1);

    fireEvent.blur(max);
    expect(onFilterUpdate).toHaveBeenLastCalledWith("hours-filter", {
      value: ["", "24"],
    });
  });

  it("swaps crossed bounds on Enter", () => {
    const { onFilterUpdate, inputs } = renderRangeFilter(["", "10"]);
    const [min] = inputs;

    fireEvent.change(min, { target: { value: "15" } });
    expect(onFilterUpdate).not.toHaveBeenCalled();

    fireEvent.keyDown(min, { key: "Enter" });
    expect(onFilterUpdate).toHaveBeenCalledWith("hours-filter", {
      value: ["10", "15"],
    });
  });

  it("keeps an empty bound open", () => {
    const { onFilterUpdate, inputs } = renderRangeFilter(["5", "10"]);
    const [min] = inputs;

    fireEvent.change(min, { target: { value: "" } });
    fireEvent.blur(min);

    expect(onFilterUpdate).toHaveBeenCalledWith("hours-filter", {
      value: ["", "10"],
    });
  });
});

function renderToolbar() {
  const tableRef: {
    current?: ReturnType<typeof useDataTable<Task>>["table"];
  } = {};

  function Harness() {
    const { table } = useDataTable<Task>({
      mode: "client",
      data,
      columns,
      getRowId: (row) => row.id,
    });
    tableRef.current = table;

    return (
      <DataTable aria-label="Tasks" table={table}>
        <DataTableToolbar table={table} />
      </DataTable>
    );
  }

  render(
    <NuqsTestingAdapter hasMemory>
      <Harness />
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

  return { table, openFilter };
}

function renderRangeFilter(value: [string, string]) {
  const onFilterUpdate = vi.fn();
  const filter: ColumnFilterItem = {
    id: "hours",
    variant: "range",
    operator: "isBetween",
    value,
    filterId: "hours-filter",
  };

  function Harness() {
    const { table } = useDataTable<Task>({
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
