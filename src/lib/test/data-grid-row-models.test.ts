import {
  type ColumnDef,
  columnFilteringFeature,
  createCoreRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createDataGridCoreRowModel,
  createDataGridFilteredRowModel,
  createDataGridSortedRowModel,
  patchedRows,
  rowChangeHints,
} from "@/lib/data-grid-row-models";

interface Skater {
  id: string;
  name: string;
  score?: number;
}

const sortFns = {
  alphanumeric: sortFn_alphanumeric,
  basic: sortFn_basic,
  text: sortFn_text,
};

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  coreRowModel: createDataGridCoreRowModel(),
  filteredRowModel: createDataGridFilteredRowModel(),
  sortedRowModel: createDataGridSortedRowModel(),
  sortFns,
  filterFns: { includesString: filterFn_includesString },
});

const columns: ColumnDef<typeof features, Skater>[] = [
  { id: "name", accessorKey: "name", filterFn: "includesString" },
  { id: "score", accessorKey: "score", sortUndefined: "last" },
];

describe("createDataGridCoreRowModel", () => {
  it("builds a row for each data row", () => {
    const data = createSkaters(3);
    const { rows, rowsById } = renderTable(data).table.getCoreRowModel();

    expect(getIds(rows)).toEqual(["r0", "r1", "r2"]);
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2]);
    expect(rowsById.r1?.original).toBe(data[1]);
  });

  it("rebuilds only the rows whose data changed", () => {
    const data = createSkaters(3);
    const grid = renderTable(data);
    const before = grid.table.getCoreRowModel().rows;

    const next = data.slice();
    next[1] = { ...data[1], name: "Rodney Mullen" } as Skater;
    grid.setData(next);
    const after = grid.table.getCoreRowModel().rows;

    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]?.original.name).toBe("Rodney Mullen");
    expect(after[2]).toBe(before[2]);
  });

  it("shifts rows after inserts and removals instead of rebuilding them", () => {
    const data = createSkaters(5);
    const grid = renderTable(data);
    const [r0, , r2, , r4] = grid.table.getCoreRowModel().rows;

    const inserted: Skater = { id: "new", name: "Leticia Bufoni" };
    // Removes r1 and r3, and inserts `new` at index 2
    const next = [data[0], data[2], inserted, data[4]] as Skater[];
    rowChangeHints.set(next, {
      from: data,
      removedIndexes: [1, 3],
      insertedIndexes: [2],
    });
    grid.setData(next);
    const { rows, rowsById } = grid.table.getCoreRowModel();

    expect(getIds(rows)).toEqual(["r0", "r2", "new", "r4"]);
    expect(rows[0]).toBe(r0);
    expect(rows[1]).toBe(r2);
    expect(rows[3]).toBe(r4);
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3]);
    expect(rowsById.r1).toBeUndefined();
    expect(rowsById.r3).toBeUndefined();
    expect(rowsById.new?.original).toBe(inserted);
  });

  it("rebuilds rows instead of shifting them without getRowId", () => {
    const data = createSkaters(3);
    const grid = renderTable(data, { withRowId: false });
    grid.table.getCoreRowModel();

    const next = [data[0], data[2]] as Skater[];
    rowChangeHints.set(next, {
      from: data,
      removedIndexes: [1],
      insertedIndexes: [],
    });
    grid.setData(next);
    const { rows } = grid.table.getCoreRowModel();

    // Index-based IDs follow the new positions
    expect(getIds(rows)).toEqual(["0", "1"]);
    expect(rows[1]?.original).toBe(data[2]);
  });

  it("rebuilds a patched row even when the data hands back its copy", () => {
    const data = createSkaters(2);
    const grid = renderTable(data);
    const before = grid.table.getCoreRowModel().rows;
    const patched = before[0];
    if (!patched) throw new Error("Missing row");

    // Swaps in a copy in place, like `updateCells` does
    const copy = { ...patched.original, name: "Tony Hawk" };
    patched.original = copy;
    patchedRows.add(patched);

    grid.setData([copy, data[1]] as Skater[]);
    const after = grid.table.getCoreRowModel().rows;

    expect(after[0]).not.toBe(patched);
    expect(after[0]?.original).toBe(copy);
    expect(after[1]).toBe(before[1]);
  });
});

describe("createDataGridFilteredRowModel", () => {
  it("hands back the unfiltered rows while there are no filters", () => {
    const { table } = renderTable(createSkaters(3));

    expect(table.getFilteredRowModel()).toBe(table.getPreFilteredRowModel());
  });

  it("leaves rows' filter results alone while there are no filters", () => {
    const data = createSkaters(3);
    const grid = renderTable(data);
    const row = grid.table.getFilteredRowModel().rows[0];
    if (!row) throw new Error("Missing row");
    const filterResults = row.columnFilters;

    grid.setData(data.slice());
    grid.table.getFilteredRowModel();

    expect(row.columnFilters).toBe(filterResults);
  });

  it("filters, then goes back to every row once filters clear", () => {
    const grid = renderTable([
      { id: "a", name: "tony hawk" },
      { id: "b", name: "rodney mullen" },
      { id: "c", name: "nyjah huston" },
    ]);

    act(() => {
      grid.table.setColumnFilters([{ id: "name", value: "h" }]);
    });
    expect(getIds(grid.table.getFilteredRowModel().rows)).toEqual(["a", "c"]);

    act(() => {
      grid.table.setColumnFilters([]);
    });
    expect(getIds(grid.table.getFilteredRowModel().rows)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("createDataGridSortedRowModel", () => {
  it("sorts like TanStack's sorted row model", () => {
    // Mixed case and numbers, so names sort alphanumerically
    const data: Skater[] = [
      { id: "a", name: "Skater10", score: 2 },
      { id: "b", name: "skater2" },
      { id: "c", name: "Skater1", score: 1 },
      { id: "d", name: "skater2", score: 3 },
      { id: "e", name: "skater20", score: 2 },
    ];
    const grid = renderTable(data);
    const stock = renderStockTable(data);
    const sortings: SortingState[] = [
      [{ id: "name", desc: false }],
      [{ id: "name", desc: true }],
      [{ id: "score", desc: false }],
      [{ id: "score", desc: true }],
      [
        { id: "score", desc: false },
        { id: "name", desc: true },
      ],
    ];

    for (const sorting of sortings) {
      expect(getSortedIds(grid, sorting)).toEqual(getSortedIds(stock, sorting));
    }
  });

  it("moves a row patched in place to its new sorted position", () => {
    const data = createSkaters(5);
    const grid = renderTable(data);
    expect(getSortedIds(grid, [{ id: "score", desc: false }])).toEqual([
      "r0",
      "r1",
      "r2",
      "r3",
      "r4",
    ]);

    const row = grid.table.getCoreRowModel().rowsById.r1;
    if (!row) throw new Error("Missing row");
    const copy = { ...row.original, score: 10 };
    row.original = copy;
    patchedRows.add(row);
    const next = data.slice();
    next[1] = copy;
    grid.setData(next);

    expect(getIds(grid.table.getSortedRowModel().rows)).toEqual([
      "r0",
      "r2",
      "r3",
      "r4",
      "r1",
    ]);
  });

  it("keeps the same order as a full sort across random edits", () => {
    const random = createRandom(7);
    let data: Skater[] = createSkaters(200).map((skater) => ({
      ...skater,
      score: Math.floor(random() * 50),
    }));
    const grid = renderTable(data);
    const stock = renderStockTable(data);
    const sorting: SortingState = [
      { id: "score", desc: true },
      { id: "name", desc: false },
    ];
    getSortedIds(grid, sorting);
    getSortedIds(stock, sorting);

    for (let round = 0; round < 100; round++) {
      // Most rounds change a few rows, which the cache moves, and some change many,
      // which sort again from scratch
      const edits = random() < 0.8 ? 1 + Math.floor(random() * 5) : 60;
      data = data.slice();
      for (let i = 0; i < edits; i++) {
        const index = Math.floor(random() * data.length);
        const skater = data[index];
        if (!skater) continue;
        data[index] = {
          ...skater,
          score: random() < 0.1 ? undefined : Math.floor(random() * 50),
        };
      }
      grid.setData(data);
      stock.setData(data);

      expect(getIds(grid.table.getSortedRowModel().rows)).toEqual(
        getIds(stock.table.getSortedRowModel().rows),
      );
    }
  });
});

function getSortedIds(
  {
    table,
  }: ReturnType<typeof renderTable> | ReturnType<typeof renderStockTable>,
  sorting: SortingState,
) {
  act(() => {
    table.setSorting(sorting);
  });
  return getIds(table.getSortedRowModel().rows);
}

const stockFeatures = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

// TanStack's own row models, to check ours against
function renderStockTable(initialData: Skater[]) {
  const { result, rerender } = renderHook(
    ({ data }: { data: Skater[] }) =>
      useTable({
        features: stockFeatures,
        columns: columns as ColumnDef<typeof stockFeatures, Skater>[],
        data,
        getRowId: (row) => row.id,
      }),
    { initialProps: { data: initialData } },
  );
  return {
    get table() {
      return result.current;
    },
    setData: (data: Skater[]) => rerender({ data }),
  };
}

// The same seeded generator the demos use, so runs repeat
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSkaters(count: number): Skater[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    name: `Skater ${index}`,
    score: index,
  }));
}

function renderTable(initialData: Skater[], { withRowId = true } = {}) {
  const { result, rerender } = renderHook(
    ({ data }: { data: Skater[] }) =>
      useTable({
        features,
        columns,
        data,
        getRowId: withRowId ? (row) => row.id : undefined,
      }),
    { initialProps: { data: initialData } },
  );
  return {
    get table() {
      return result.current;
    },
    setData: (data: Skater[]) => rerender({ data }),
  };
}

function getIds(rows: ReadonlyArray<{ id: string }>) {
  return rows.map((row) => row.id);
}
