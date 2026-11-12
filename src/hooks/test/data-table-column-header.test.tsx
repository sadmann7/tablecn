import { createColumnHelper, useTable } from "@tanstack/react-table";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import { DataTableColumnHeader as AriaDataTableColumnHeader } from "@/registry/bases/aria/components/data-table/data-table-column-header";
import { DataTableColumnHeader as BaseDataTableColumnHeader } from "@/registry/bases/base/components/data-table/data-table-column-header";
import { DataTableColumnHeader as RadixDataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";

interface Task {
  code: string;
  createdAt: string;
}

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("code", { meta: { label: "Task" } }),
  columnHelper.accessor("createdAt", {}),
]);

const data: Task[] = [];

describe.each([
  ["radix", RadixDataTableColumnHeader],
  ["base", BaseDataTableColumnHeader],
  ["aria", AriaDataTableColumnHeader],
])("%s DataTableColumnHeader", (_base, DataTableColumnHeader) => {
  it("labels the header from the column meta, then the column id", () => {
    const { result } = renderHook(() =>
      useTable({ features: dataTableFeatures, columns, data }),
    );
    const [code, createdAt] = result.current.getAllColumns();
    if (!code || !createdAt) throw new Error("Missing column");

    render(
      <>
        <DataTableColumnHeader column={code} />
        <DataTableColumnHeader column={createdAt} />
        <DataTableColumnHeader column={code} label="Code" />
      </>,
    );

    expect(screen.getByText("Task")).toBeDefined();
    expect(screen.getByText("createdAt")).toBeDefined();
    expect(screen.getByText("Code")).toBeDefined();
  });
});
