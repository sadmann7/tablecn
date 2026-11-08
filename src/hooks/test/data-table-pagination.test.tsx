import { createColumnHelper } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTable as AriaDataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { useDataTable as useAriaDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { DataTable as BaseDataTable } from "@/registry/bases/base/components/data-table/data-table";
import { useDataTable as useBaseDataTable } from "@/registry/bases/base/hooks/use-data-table";
import { DataTable as RadixDataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { useDataTable as useRadixDataTable } from "@/registry/bases/radix/hooks/use-data-table";

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
  title: string;
}

const data: Task[] = Array.from({ length: 30 }, (_, index) => ({
  id: String(index + 1),
  title: `Task ${index + 1}`,
}));

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", { id: "title" }),
]);

const bases = [
  ["radix", RadixDataTable, useRadixDataTable],
  ["base", BaseDataTable, useBaseDataTable],
  ["aria", AriaDataTable, useAriaDataTable],
] as const;

describe.each(bases)(
  "DataTablePagination (%s)",
  (_, DataTable, useDataTable) => {
    function renderTable(searchParams: string) {
      function Harness() {
        const { table } = useDataTable<Task>({
          mode: "client",
          data,
          columns,
          getRowId: (row) => row.id,
        });

        return <DataTable aria-label="Tasks" table={table} />;
      }

      return render(
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
          <Harness />
        </NuqsTestingAdapter>,
      );
    }

    it("shows a page size that is not one of the options", () => {
      const { container } = renderTable("?perPage=25");
      const value = container.querySelector(
        '[data-slot="data-table-pagination"] [data-slot="select-value"]',
      );

      expect(value?.textContent).toBe("25");
    });

    it("lists a page size that is not one of the options", async () => {
      const { container } = renderTable("?perPage=25");
      const trigger = container.querySelector<HTMLElement>(
        '[data-slot="data-table-pagination"] [data-slot="select-trigger"]',
      );
      if (!trigger) throw new Error("Missing page size select");

      await act(async () => {
        fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
        fireEvent.mouseDown(trigger, { button: 0 });
        fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
        fireEvent.mouseUp(trigger, { button: 0 });
        fireEvent.click(trigger);
      });

      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["10", "20", "25", "30", "40", "50"]);
      expect(
        screen
          .getByRole("option", { name: "25" })
          .getAttribute("aria-selected"),
      ).toBe("true");
    });
  },
);
