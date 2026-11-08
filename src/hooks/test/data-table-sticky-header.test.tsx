import { createColumnHelper } from "@tanstack/react-table";
import { render } from "@testing-library/react";
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
  "DataTable sticky header (%s)",
  (_, DataTable, useDataTable) => {
    function renderTable(stickyHeader?: boolean) {
      function Harness() {
        const { table } = useDataTable<Task>({
          mode: "client",
          data,
          columns,
          getRowId: (row) => row.id,
        });

        return (
          <DataTable
            aria-label="Tasks"
            table={table}
            stickyHeader={stickyHeader}
          />
        );
      }

      return render(
        <NuqsTestingAdapter hasMemory>
          <Harness />
        </NuqsTestingAdapter>,
      );
    }

    it("keeps the header in place by default", () => {
      const { container } = renderTable();

      expect(container.querySelector("thead")?.classList).not.toContain(
        "sticky",
      );
    });

    it("sticks the header inside a scrolling container", () => {
      const { container } = renderTable(true);
      const header = container.querySelector("thead");
      const scroller = header?.closest('[data-slot="data-table"] > div');

      expect(header?.classList).toContain("sticky");
      expect(header?.classList).toContain("top-0");
      expect(scroller?.classList).toContain("overflow-auto");
    });

    it("keeps focused rows clear of the sticky header", () => {
      const scrollerSelector = '[data-slot="data-table"] > div';
      const sticky =
        renderTable(true).container.querySelector(scrollerSelector);
      const plain = renderTable().container.querySelector(scrollerSelector);

      expect(sticky?.classList).toContain("scroll-pt-10");
      expect(plain?.classList).not.toContain("scroll-pt-10");
    });
  },
);
