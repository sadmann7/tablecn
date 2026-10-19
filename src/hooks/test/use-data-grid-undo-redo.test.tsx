import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDataGridUndoRedo } from "@/hooks/use-data-grid-undo-redo";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
  },
}));

interface TestRow {
  id: string;
  status: string;
}

const data: TestRow[] = [{ id: "1", status: "Remote" }];

function renderUndoRedo() {
  const onDataChange = vi.fn();
  const { result } = renderHook(() =>
    useDataGridUndoRedo({
      data,
      onDataChange,
      getRowId: (row) => row.id,
    }),
  );

  act(() => {
    result.current.trackCellsUpdate([
      {
        rowId: "1",
        columnId: "status",
        previousValue: "Active",
        newValue: "Remote",
      },
    ]);
  });

  return { onDataChange };
}

function focusButtonIn(attributes: Record<string, string>) {
  const container = document.createElement("div");
  for (const [name, value] of Object.entries(attributes)) {
    container.setAttribute(name, value);
  }
  const button = document.createElement("button");
  container.append(button);
  document.body.append(container);
  button.focus();
}

function pressUndo() {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }),
    );
  });
}

describe("useDataGridUndoRedo", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("undoes from a toolbar marked as a grid popover", () => {
    const { onDataChange } = renderUndoRedo();
    focusButtonIn({ "data-grid-popover": "", role: "toolbar" });

    pressUndo();

    expect(onDataChange).toHaveBeenCalledWith([{ id: "1", status: "Active" }]);
  });

  it("ignores undo inside other grid popovers", () => {
    const { onDataChange } = renderUndoRedo();
    focusButtonIn({ "data-grid-popover": "", role: "menu" });

    pressUndo();

    expect(onDataChange).not.toHaveBeenCalled();
  });
});
