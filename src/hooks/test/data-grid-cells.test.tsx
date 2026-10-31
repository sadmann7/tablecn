import type { ColumnDef } from "@tanstack/react-table";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FileCellData } from "@/lib/data-grid-types";

import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import {
  useDataGrid,
  type UseDataGridProps,
} from "@/registry/bases/radix/hooks/use-data-grid";
import { TooltipProvider } from "@/registry/bases/radix/ui/tooltip";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: toastError,
  }),
}));

vi.mock("@/registry/bases/radix/ui/direction", () => ({
  useDirection: () => "ltr",
}));

interface Skater {
  id: string;
  name: string;
  website: string | null;
  age: number | null;
  bio: string;
  isPro: boolean;
  stance: string | null;
  tricks: string[];
  joined: string | null;
  media: FileCellData[];
}

const skaters: Skater[] = [
  {
    id: "1",
    name: "Tony Hawk",
    website: "https://tonyhawk.com",
    age: 56,
    bio: "Landed the 900",
    isPro: true,
    stance: "goofy",
    tricks: ["900"],
    joined: "2024-01-15",
    media: [],
  },
  {
    id: "2",
    name: "Rodney Mullen",
    website: null,
    age: 58,
    bio: "Invented the flatground ollie",
    isPro: false,
    stance: "regular",
    tricks: [],
    joined: null,
    media: [],
  },
  {
    id: "3",
    name: "Nyjah Huston",
    website: null,
    age: 30,
    bio: "Street league",
    isPro: true,
    stance: "regular",
    tricks: [],
    joined: null,
    media: [],
  },
];

const columns: ColumnDef<DataGridFeatures, Skater>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    meta: { cell: { variant: "short-text" } },
  },
  {
    id: "website",
    accessorKey: "website",
    header: "Website",
    meta: { cell: { variant: "url" } },
  },
  {
    id: "age",
    accessorKey: "age",
    header: "Age",
    meta: { cell: { variant: "number" } },
  },
  {
    id: "bio",
    accessorKey: "bio",
    header: "Bio",
    meta: { cell: { variant: "long-text" } },
  },
  {
    id: "isPro",
    accessorKey: "isPro",
    header: "Pro",
    meta: { cell: { variant: "checkbox" } },
  },
  {
    id: "stance",
    accessorKey: "stance",
    header: "Stance",
    meta: {
      cell: {
        variant: "select",
        options: [
          { label: "Goofy", value: "goofy" },
          { label: "Regular", value: "regular" },
        ],
      },
    },
  },
  {
    id: "tricks",
    accessorKey: "tricks",
    header: "Tricks",
    meta: {
      cell: {
        variant: "multi-select",
        options: [
          { label: "900", value: "900" },
          { label: "Kickflip", value: "kickflip" },
          { label: "Heelflip", value: "heelflip" },
        ],
      },
    },
  },
  {
    id: "joined",
    accessorKey: "joined",
    header: "Joined",
    meta: { cell: { variant: "date" } },
  },
  {
    id: "media",
    accessorKey: "media",
    header: "Media",
    meta: { cell: { variant: "file", multiple: true } },
  },
];

type GridOptions = Partial<
  Pick<
    UseDataGridProps<Skater>,
    "uploadFiles" | "deleteFiles" | "getRowId" | "onDataChange"
  >
> & {
  data?: Skater[];
  columns?: ColumnDef<DataGridFeatures, Skater>[];
};

describe("DataGrid cells", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 2400,
      bottom: 600,
      width: 2400,
      height: 600,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(2400);
    toastError.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("short text", () => {
    it("starts editing with the typed key", () => {
      const { getCell, focus, table } = renderGrid();

      focus("1", "name");
      press(getCell("1", "name"), "Z");

      expect(table.getEditingCell()).toEqual({
        rowId: "1",
        columnId: "name",
      });
      expect(getEditable(getCell("1", "name")).textContent).toBe("Z");
    });

    it("saves on Enter and moves to the next row", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "name");
      press(getCell("1", "name"), "Enter");
      const editable = getEditable(getCell("1", "name"));
      typeText(editable, "Tony Hawk Jr");
      press(editable, "Enter");

      expect(getValue("1", "name")).toBe("Tony Hawk Jr");
      expect(getCell("1", "name").textContent).toBe("Tony Hawk Jr");
      expect(table.getEditingCell()).toBeNull();
      expect(table.getFocusedCell()?.row.id).toBe("2");
    });

    it("saves on Tab and moves to the next column", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "name");
      press(getCell("1", "name"), "Enter");
      const editable = getEditable(getCell("1", "name"));
      typeText(editable, "Birdman");
      press(editable, "Tab");

      expect(getValue("1", "name")).toBe("Birdman");
      expect(table.getFocusedCell()?.column.id).toBe("website");
    });

    it("cancels on Escape", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "name");
      press(getCell("1", "name"), "Enter");
      const editable = getEditable(getCell("1", "name"));
      typeText(editable, "Typo");
      press(editable, "Escape");

      expect(getValue("1", "name")).toBe("Tony Hawk");
      expect(getCell("1", "name").textContent).toBe("Tony Hawk");
      expect(table.getEditingCell()).toBeNull();
    });

    it("saves on blur", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "name");
      press(getCell("1", "name"), "Enter");
      const editable = getEditable(getCell("1", "name"));
      typeText(editable, "The Birdman");
      act(() => {
        fireEvent.blur(editable);
      });

      expect(getValue("1", "name")).toBe("The Birdman");
      expect(table.getEditingCell()).toBeNull();
    });
  });

  describe("url", () => {
    it("trims the saved value", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("2", "website");
      press(getCell("2", "website"), "Enter");
      const editable = getEditable(getCell("2", "website"));
      typeText(editable, "  https://rodneymullen.com  ");
      press(editable, "Enter");

      expect(getValue("2", "website")).toBe("https://rodneymullen.com");
    });

    it("saves null when cleared", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "website");
      press(getCell("1", "website"), "Enter");
      const editable = getEditable(getCell("1", "website"));
      typeText(editable, "   ");
      press(editable, "Enter");

      expect(getValue("1", "website")).toBeNull();
    });

    it("cancels on Escape", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "website");
      press(getCell("1", "website"), "Enter");
      const editable = getEditable(getCell("1", "website"));
      typeText(editable, "https://typo.com");
      press(editable, "Escape");

      expect(getValue("1", "website")).toBe("https://tonyhawk.com");
      expect(getCell("1", "website").textContent).toBe("https://tonyhawk.com");
    });
  });

  describe("number", () => {
    it("saves a number on Enter", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "age");
      press(getCell("1", "age"), "Enter");
      const input = getInput(getCell("1", "age"));
      fireEvent.change(input, { target: { value: "42" } });
      press(input, "Enter");

      expect(getValue("1", "age")).toBe(42);
      expect(getCell("1", "age").textContent).toBe("42");
    });

    it("saves null when emptied", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "age");
      press(getCell("1", "age"), "Enter");
      const input = getInput(getCell("1", "age"));
      fireEvent.change(input, { target: { value: "" } });
      press(input, "Enter");

      expect(getValue("1", "age")).toBeNull();
    });

    it("cancels on Escape", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "age");
      press(getCell("1", "age"), "Enter");
      const input = getInput(getCell("1", "age"));
      fireEvent.change(input, { target: { value: "7" } });
      press(input, "Escape");

      expect(getValue("1", "age")).toBe(56);
      expect(getCell("1", "age").textContent).toBe("56");
      expect(table.getEditingCell()).toBeNull();
    });
  });

  describe("long text", () => {
    it("saves on Cmd+Enter", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "bio");
      press(getCell("1", "bio"), "Enter");
      const textarea = getTextarea();
      fireEvent.change(textarea, {
        target: { value: "Landed the 900 in 1999" },
      });
      press(textarea, "Enter", { metaKey: true });

      expect(getValue("1", "bio")).toBe("Landed the 900 in 1999");
      expect(table.getEditingCell()).toBeNull();
    });

    it("saves on Tab and moves to the next column", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "bio");
      press(getCell("1", "bio"), "Enter");
      const textarea = getTextarea();
      fireEvent.change(textarea, { target: { value: "Vert legend" } });
      press(textarea, "Tab");

      expect(getValue("1", "bio")).toBe("Vert legend");
      expect(table.getFocusedCell()?.column.id).toBe("isPro");
    });

    it("restores the value from before editing on Escape", () => {
      const { getCell, getValue, focus, table } = renderGrid();

      focus("1", "bio");
      press(getCell("1", "bio"), "Enter");
      const textarea = getTextarea();
      fireEvent.change(textarea, { target: { value: "Typo" } });
      press(textarea, "Escape");

      expect(getValue("1", "bio")).toBe("Landed the 900");
      expect(table.getEditingCell()).toBeNull();
    });

    it("restores the value from when editing started after the auto-save", async () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "bio");
      press(getCell("1", "bio"), "Enter");
      const textarea = getTextarea();
      fireEvent.change(textarea, { target: { value: "Typo" } });
      await wait(400);
      expect(getValue("1", "bio")).toBe("Typo");

      press(getTextarea(), "Escape");

      expect(getValue("1", "bio")).toBe("Landed the 900");
    });

    it("drops a pending auto-save on Escape", async () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "bio");
      press(getCell("1", "bio"), "Enter");
      const textarea = getTextarea();
      fireEvent.change(textarea, { target: { value: "Typo" } });
      press(textarea, "Escape");
      await wait(400);

      expect(getValue("1", "bio")).toBe("Landed the 900");
    });
  });

  describe("checkbox", () => {
    it("toggles on Space", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "isPro");
      press(getCell("1", "isPro"), " ");

      expect(getValue("1", "isPro")).toBe(false);
      expect(
        getCheckbox(getCell("1", "isPro")).getAttribute("aria-checked"),
      ).toBe("false");
    });

    it("toggles on click", () => {
      const { getCell, getValue } = renderGrid();

      act(() => {
        fireEvent.click(getCheckbox(getCell("2", "isPro")));
      });

      expect(getValue("2", "isPro")).toBe(true);
      expect(
        getCheckbox(getCell("2", "isPro")).getAttribute("aria-checked"),
      ).toBe("true");
    });
  });

  describe("select", () => {
    it("saves the chosen option", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "stance");
      press(getCell("1", "stance"), "Enter");
      act(() => {
        fireEvent.click(screen.getByRole("option", { name: "Regular" }));
      });

      expect(getValue("1", "stance")).toBe("regular");
      expect(getCell("1", "stance").textContent).toBe("Regular");
    });

    it("opens on the current option and saves from the keyboard", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "stance");
      press(getCell("1", "stance"), "Enter");
      expect(
        screen
          .getByRole("option", { name: "Goofy" })
          .getAttribute("aria-selected"),
      ).toBe("true");

      press(document.activeElement, "ArrowDown");
      press(document.activeElement, "Enter");

      expect(getValue("1", "stance")).toBe("regular");
      expect(screen.queryByRole("option")).toBeNull();
      expect(document.activeElement).toBe(getCell("1", "stance"));
    });
  });

  describe("multi-select", () => {
    it("adds and removes options", async () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "tricks");
      press(getCell("1", "tricks"), "Enter");
      await act(async () => {
        fireEvent.click(screen.getByRole("option", { name: "Kickflip" }));
      });
      expect(getValue("1", "tricks")).toEqual(["900", "kickflip"]);

      await act(async () => {
        fireEvent.click(screen.getByRole("option", { name: "900" }));
      });
      expect(getValue("1", "tricks")).toEqual(["kickflip"]);
    });
  });

  describe("date", () => {
    it("saves the picked day", () => {
      const { getCell, getValue, focus } = renderGrid();

      focus("1", "joined");
      press(getCell("1", "joined"), "Enter");
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /January 20/ }));
      });

      expect(getValue("1", "joined")).toBe("2024-01-20");
    });
  });

  describe("file", () => {
    function getFileInput() {
      const input =
        document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error("No file input");
      return input;
    }

    function openFiles(grid: ReturnType<typeof renderGrid>, rowId: string) {
      grid.focus(rowId, "media");
      press(grid.getCell(rowId, "media"), "Enter");
    }

    it("opens on Enter", () => {
      const grid = renderGrid();
      openFiles(grid, "1");

      expect(grid.table.getEditingCell()).toEqual({
        rowId: "1",
        columnId: "media",
      });
    });

    it("doesn't open on Enter when read-only", () => {
      const grid = renderGrid({
        columns: columns.map((column) =>
          column.id === "media"
            ? { ...column, enableCellEditing: false }
            : column,
        ),
      });
      openFiles(grid, "1");

      expect(grid.table.getEditingCell()).toBeNull();
    });

    it("keeps a newer error after an older one expires", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const grid = renderGrid({
          columns: columns.map((column) =>
            column.id === "media"
              ? {
                  ...column,
                  meta: { cell: { variant: "file", accept: "image/*" } },
                }
              : column,
          ),
        });
        openFiles(grid, "1");
        const reject = () =>
          act(() => {
            fireEvent.change(getFileInput(), {
              target: {
                files: [
                  new File(["a"], "clip.pdf", { type: "application/pdf" }),
                ],
              },
            });
          });
        const getDropzone = () => screen.getByRole("region");

        reject();
        act(() => {
          vi.advanceTimersByTime(1500);
        });
        reject();
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(getDropzone().getAttribute("aria-invalid")).toBe("true");

        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(getDropzone().getAttribute("aria-invalid")).toBe("false");
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps each same-named upload with its own result", async () => {
      const uploadFiles = vi.fn(async ({ files }: { files: File[] }) =>
        files.map((file, index) => ({
          id: `uploaded-${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: `https://cdn.test/${index}`,
        })),
      );
      const grid = renderGrid({ uploadFiles });
      openFiles(grid, "1");

      await act(async () => {
        fireEvent.change(getFileInput(), {
          target: {
            files: [
              new File(["a"], "clip.pdf", { type: "application/pdf" }),
              new File(["bbbb"], "clip.pdf", { type: "application/pdf" }),
            ],
          },
        });
      });

      expect(grid.getValue("1", "media")).toEqual([
        expect.objectContaining({ id: "uploaded-0", size: 1 }),
        expect.objectContaining({ id: "uploaded-1", size: 4 }),
      ]);
    });

    it("removes a deleted file", async () => {
      const media: FileCellData[] = [
        {
          id: "a",
          name: "a.pdf",
          size: 1,
          type: "application/pdf",
          url: "https://cdn.test/a",
        },
        {
          id: "b",
          name: "b.pdf",
          size: 1,
          type: "application/pdf",
          url: "https://cdn.test/b",
        },
      ];
      const deleteFiles = vi.fn();
      const grid = renderGrid({
        data: skaters.map((skater) =>
          skater.id === "1" ? { ...skater, media } : skater,
        ),
        deleteFiles,
      });
      openFiles(grid, "1");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Remove a.pdf" }));
      });

      expect(deleteFiles).toHaveBeenCalledWith(
        expect.objectContaining({ fileIds: ["a"] }),
      );
      expect(grid.getValue("1", "media")).toEqual([
        expect.objectContaining({ id: "b" }),
      ]);
    });

    it("keeps the value and shows an error when the upload fails", async () => {
      const uploadFiles = vi.fn(async () => {
        throw new Error("Upload failed");
      });
      const grid = renderGrid({ uploadFiles });
      openFiles(grid, "1");

      await act(async () => {
        fireEvent.change(getFileInput(), {
          target: {
            files: [new File(["a"], "clip.pdf", { type: "application/pdf" })],
          },
        });
      });

      expect(grid.getValue("1", "media")).toEqual([]);
      expect(toastError).toHaveBeenCalledWith("Upload failed");
    });

    it("falls back to object URLs without uploadFiles", async () => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:clip");
      const grid = renderGrid();
      openFiles(grid, "1");

      await act(async () => {
        fireEvent.change(getFileInput(), {
          target: {
            files: [new File(["a"], "clip.pdf", { type: "application/pdf" })],
          },
        });
      });

      expect(grid.getValue("1", "media")).toEqual([
        expect.objectContaining({ name: "clip.pdf", url: "blob:clip" }),
      ]);
    });

    it("keeps a deleted file's object URL so undo can restore it", async () => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:clip");
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
      const grid = renderGrid();
      openFiles(grid, "1");

      await act(async () => {
        fireEvent.change(getFileInput(), {
          target: {
            files: [new File(["a"], "clip.pdf", { type: "application/pdf" })],
          },
        });
      });
      // Edits within 300ms merge into one undo step
      await wait(400);
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Remove clip.pdf" }),
        );
      });
      expect(grid.getValue("1", "media")).toEqual([]);

      act(() => {
        grid.table.undo();
      });

      expect(revokeObjectURL).not.toHaveBeenCalled();
      expect(grid.getValue("1", "media")).toEqual([
        expect.objectContaining({ url: "blob:clip" }),
      ]);
    });

    it("revokes only the object URLs it created when unmounted", async () => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:grid");
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
      const media: FileCellData[] = [
        {
          id: "app",
          name: "app.pdf",
          size: 1,
          type: "application/pdf",
          url: "blob:app",
        },
      ];
      const grid = renderGrid({
        data: skaters.map((skater) =>
          skater.id === "1" ? { ...skater, media } : skater,
        ),
      });
      openFiles(grid, "1");

      await act(async () => {
        fireEvent.change(getFileInput(), {
          target: {
            files: [new File(["a"], "clip.pdf", { type: "application/pdf" })],
          },
        });
      });
      grid.unmount();

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:grid");
      expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:app");
    });
  });

  describe("live updates", () => {
    it("shows batched updates before and after the commit", async () => {
      const { getCell, table } = renderGrid();

      act(() => {
        table.updateCells(
          [
            { rowId: "2", columnId: "name", value: "Batch One" },
            { rowId: "2", columnId: "age", value: 31 },
            { rowId: "2", columnId: "stance", value: "goofy" },
          ],
          { batch: true },
        );
      });
      await waitFrames();

      expect(getCell("2", "name").textContent).toBe("Batch One");
      expect(getCell("2", "age").textContent).toBe("31");
      expect(getCell("2", "stance").textContent).toBe("Goofy");

      act(() => {
        table.updateCells(
          [
            { rowId: "2", columnId: "name", value: "Batch Two" },
            { rowId: "2", columnId: "age", value: 32 },
          ],
          { batch: true },
        );
      });
      await waitFrames();

      expect(getCell("2", "name").textContent).toBe("Batch Two");
      expect(getCell("2", "age").textContent).toBe("32");

      await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));

      expect(getCell("2", "name").textContent).toBe("Batch Two");
      expect(table.getCoreRowModel().rowsById["2"]?.original.name).toBe(
        "Batch Two",
      );
    });

    it("shows direct updates", () => {
      const { getCell, table } = renderGrid();

      act(() => {
        table.updateCells({ rowId: "3", columnId: "name", value: "Direct" });
      });

      expect(getCell("3", "name").textContent).toBe("Direct");
    });

    it("shows the new row's value when a cell is reused for another row", () => {
      const { container, rerenderRows } = renderGrid();

      act(() => {
        rerenderRows(skaters.slice(1));
      });

      const firstRowName = container.querySelector(
        '[role="row"][aria-rowindex="2"] [data-column-id="name"]',
      );
      expect(firstRowName?.textContent).toBe("Rodney Mullen");
    });
  });

  describe("select column", () => {
    const selectColumns: ColumnDef<DataGridFeatures, Skater>[] = [
      getDataGridSelectColumn<Skater>({ enableRowMarkers: true }),
      ...columns.slice(0, 1),
    ];

    function getRowCheckbox(container: HTMLElement, rowId: string) {
      const checkbox = container.querySelector<HTMLElement>(
        `[data-row-id="${rowId}"][data-column-id="select"] [role="checkbox"]`,
      );
      if (!checkbox) throw new Error(`No checkbox for ${rowId}`);
      return checkbox;
    }

    it("follows selection changes from the API", () => {
      const { container, table } = renderGrid({ columns: selectColumns });

      act(() => {
        table.getCoreRowModel().rowsById["2"]?.toggleSelected(true);
      });
      expect(getRowCheckbox(container, "2").getAttribute("aria-checked")).toBe(
        "true",
      );

      act(() => {
        table.getCoreRowModel().rowsById["2"]?.toggleSelected(false);
      });
      expect(getRowCheckbox(container, "2").getAttribute("aria-checked")).toBe(
        "false",
      );
    });

    it("selects a row on click", () => {
      const { container, table } = renderGrid({ columns: selectColumns });

      act(() => {
        fireEvent.click(getRowCheckbox(container, "3"));
      });

      expect(table.getCoreRowModel().rowsById["3"]?.getIsSelected()).toBe(true);
      expect(getRowCheckbox(container, "3").getAttribute("aria-checked")).toBe(
        "true",
      );
    });

    it("renumbers row markers after sorting", () => {
      const { container, table } = renderGrid({ columns: selectColumns });

      act(() => {
        table.setSorting([{ id: "name", desc: false }]);
      });

      expect(getRowCheckbox(container, "1").getAttribute("aria-label")).toBe(
        "Select row 3",
      );
      expect(
        getRowCheckbox(container, "1")
          .closest('[role="row"]')
          ?.getAttribute("aria-rowindex"),
      ).toBe("4");
    });
  });
});

function renderGrid({
  data = skaters,
  columns: gridColumns = columns,
  ...options
}: GridOptions = {}) {
  const gridRef: { current?: ReturnType<typeof useDataGrid<Skater>> } = {};

  function Harness({ rows }: { rows: Skater[] }) {
    const dataGrid = useDataGrid({
      data: rows,
      columns: gridColumns,
      getRowId: (row) => row.id,
      ...options,
    });
    gridRef.current = dataGrid;
    return <DataGrid {...dataGrid} />;
  }

  const view = render(<Harness rows={data} />, { wrapper: TooltipProvider });
  const rendered = gridRef.current?.table;
  if (!rendered) throw new Error("Grid did not render");
  const table = rendered;

  function getCell(rowId: string, columnId: string) {
    const cell = view.container.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-id="${rowId}"][data-column-id="${columnId}"]`,
    );
    if (!cell) throw new Error(`No cell ${rowId}/${columnId}`);
    return cell;
  }

  function getValue(rowId: string, columnId: keyof Skater) {
    return table.getCoreRowModel().rowsById[rowId]?.original[columnId];
  }

  function focus(rowId: string, columnId: string) {
    act(() => {
      table.setFocusedCell(rowId, columnId);
    });
  }

  function rerenderRows(rows: Skater[]) {
    view.rerender(<Harness rows={rows} />);
  }

  return { ...view, table, getCell, getValue, focus, rerenderRows };
}

function press(
  target: Element | null | undefined,
  key: string,
  init: KeyboardEventInit = {},
) {
  if (!target) throw new Error(`No target for ${key}`);
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, ...init }),
    );
  });
}

function getEditable(cell: HTMLElement) {
  const editable = cell.querySelector<HTMLElement>(
    '[data-slot="data-grid-cell-content"]',
  );
  if (!editable) throw new Error("No editable content");
  return editable;
}

function typeText(editable: HTMLElement, text: string) {
  act(() => {
    editable.textContent = text;
    editable.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function getInput(cell: HTMLElement) {
  const input = cell.querySelector<HTMLInputElement>("input");
  if (!input) throw new Error("No input");
  return input;
}

function getTextarea() {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
  if (!textarea) throw new Error("No textarea");
  return textarea;
}

async function wait(ms: number) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
}

function getCheckbox(cell: HTMLElement) {
  const checkbox = cell.querySelector<HTMLElement>('[role="checkbox"]');
  if (!checkbox) throw new Error("No checkbox");
  return checkbox;
}

async function waitFrames(count = 2) {
  for (let index = 0; index < count; index++) {
    await act(
      () =>
        new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
    );
  }
}
