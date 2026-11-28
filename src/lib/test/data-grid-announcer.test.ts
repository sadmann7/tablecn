import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  announce,
  defaultDataGridMessages,
  destroyAnnouncer,
  getHistoryMessage,
  getRowSelectionMessage,
} from "@/lib/data-grid-announcer";

describe("announce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    destroyAnnouncer();
    vi.useRealTimers();
  });

  it("adds no live regions until something is announced", () => {
    expect(document.querySelector("[data-live-announcer]")).toBeNull();
  });

  it("creates one visually hidden polite and one assertive region", () => {
    announce("Sorted by Name, ascending");
    announce("Saved");

    const roots = document.querySelectorAll('[data-live-announcer=""]');
    expect(roots).toHaveLength(1);
    expect((roots[0] as HTMLElement).style.position).toBe("absolute");
    expect(getRegion("polite")?.getAttribute("aria-live")).toBe("polite");
    expect(getRegion("assertive")?.getAttribute("aria-live")).toBe("assertive");
  });

  it("reads only the last message of a burst", () => {
    announce("1 row selected");
    vi.advanceTimersByTime(50);
    announce("2 rows selected");
    vi.advanceTimersByTime(50);
    announce("3 rows selected");
    expect(getRegion("polite")?.textContent).toBe("");

    vi.advanceTimersByTime(150);
    expect(getRegion("polite")?.textContent).toBe("3 rows selected");
  });

  it("clears messages after a few seconds", () => {
    announce("12 results");
    vi.advanceTimersByTime(150);
    expect(getRegion("polite")?.textContent).toBe("12 results");

    vi.advanceTimersByTime(5000);
    expect(getRegion("polite")?.textContent).toBe("");
  });

  it("keeps assertive messages apart from polite ones", () => {
    announce("12 results");
    announce("Paste failed", { assertiveness: "assertive" });
    vi.advanceTimersByTime(150);

    expect(getRegion("polite")?.textContent).toBe("12 results");
    expect(getRegion("assertive")?.textContent).toBe("Paste failed");
  });

  it("drops pending messages when destroyed", () => {
    announce("Sorting cleared");
    destroyAnnouncer();
    vi.advanceTimersByTime(150);

    expect(document.querySelector("[data-live-announcer]")).toBeNull();
  });

  it("ignores empty messages", () => {
    announce("");
    expect(document.querySelector("[data-live-announcer]")).toBeNull();
  });
});

describe("sort messages", () => {
  it("names the column and direction", () => {
    expect(
      defaultDataGridMessages.sorted([{ label: "Name", desc: false }]),
    ).toBe("Sorted by Name, ascending");
    expect(defaultDataGridMessages.sorted([{ label: "Age", desc: true }])).toBe(
      "Sorted by Age, descending",
    );
  });

  it("lists every sorted column in order", () => {
    expect(
      defaultDataGridMessages.sorted([
        { label: "Name", desc: false },
        { label: "Age", desc: true },
      ]),
    ).toBe("Sorted by Name, ascending, then by Age, descending");
  });

  it("says when sorting is cleared", () => {
    expect(defaultDataGridMessages.sorted([])).toBe("Sorting cleared");
  });
});

describe("paste messages", () => {
  it("counts the pasted cells", () => {
    expect(
      defaultDataGridMessages.cellsPasted({
        cellCount: 1,
        addedRowCount: 0,
        skippedCount: 0,
      }),
    ).toBe("1 cell pasted");
  });

  it("adds the skipped cells and added rows", () => {
    expect(
      defaultDataGridMessages.cellsPasted({
        cellCount: 10,
        addedRowCount: 2,
        skippedCount: 1,
      }),
    ).toBe("10 cells pasted, 1 skipped, 2 rows added");
  });
});

describe("getRowSelectionMessage", () => {
  const base = {
    selectedCount: 1,
    isAllSelected: false,
    changedCount: 1,
    changedRowNumber: 3,
    isChangedRowSelected: true,
  };

  it("names a single selected or deselected row", () => {
    expect(getRowSelectionMessage(defaultDataGridMessages, base)).toBe(
      "Row 3 selected",
    );
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        selectedCount: 0,
        isChangedRowSelected: false,
      }),
    ).toBe("Row 3 deselected");
  });

  it("gives the count when several rows change", () => {
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        selectedCount: 5,
        changedCount: 4,
      }),
    ).toBe("5 rows selected");
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        selectedCount: 0,
        changedCount: 5,
        isChangedRowSelected: false,
      }),
    ).toBe("No rows selected");
  });

  it("falls back to the count when the row is not shown", () => {
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        changedRowNumber: null,
      }),
    ).toBe("1 row selected");
  });

  it("says when the last row completes the selection", () => {
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        selectedCount: 3,
        isAllSelected: true,
      }),
    ).toBe("All rows selected");
  });

  it("says when every row is selected", () => {
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        selectedCount: 3,
        changedCount: 3,
        isAllSelected: true,
      }),
    ).toBe("All rows selected");
  });

  it("stays quiet when nothing changed", () => {
    expect(
      getRowSelectionMessage(defaultDataGridMessages, {
        ...base,
        changedCount: 0,
      }),
    ).toBeNull();
  });

  it("uses overridden messages", () => {
    expect(
      getRowSelectionMessage(
        {
          ...defaultDataGridMessages,
          rowSelected: (rowNumber) => `Fila ${rowNumber} seleccionada`,
        },
        base,
      ),
    ).toBe("Fila 3 seleccionada");
  });
});

describe("getHistoryMessage", () => {
  const base = {
    cellCount: 0,
    columnLabel: null,
    addedRowCount: 0,
    removedRowCount: 0,
  };

  it("names the column of a single undone or redone cell", () => {
    const change = { ...base, cellCount: 1, columnLabel: "Name" };
    expect(getHistoryMessage(defaultDataGridMessages, "undo", change)).toBe(
      "Undo: Name updated",
    );
    expect(getHistoryMessage(defaultDataGridMessages, "redo", change)).toBe(
      "Redo: Name updated",
    );
  });

  it("counts cells and rows together", () => {
    expect(
      getHistoryMessage(defaultDataGridMessages, "redo", {
        ...base,
        cellCount: 3,
        addedRowCount: 2,
      }),
    ).toBe("Redo: 3 cells updated, 2 rows added");
    expect(
      getHistoryMessage(defaultDataGridMessages, "undo", {
        ...base,
        removedRowCount: 1,
      }),
    ).toBe("Undo: 1 row deleted");
  });

  it("stays quiet when nothing changed or the messages are silenced", () => {
    expect(getHistoryMessage(defaultDataGridMessages, "undo", base)).toBeNull();
    expect(
      getHistoryMessage(
        { ...defaultDataGridMessages, rowsAdded: () => "" },
        "undo",
        { ...base, addedRowCount: 1 },
      ),
    ).toBeNull();
  });
});

function getRegion(assertiveness: "polite" | "assertive") {
  return document.querySelector(`[data-live-announcer="${assertiveness}"]`);
}
