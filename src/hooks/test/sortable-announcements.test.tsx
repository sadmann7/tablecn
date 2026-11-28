import { virtual } from "@guidepup/virtual-screen-reader";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import * as BaseSortable from "@/registry/bases/base/ui/sortable";
import * as RadixSortable from "@/registry/bases/radix/ui/sortable";

const ROW_HEIGHT = 40;

const fruits = [
  { id: "a", name: "Apple" },
  { id: "b", name: "Banana" },
  { id: "c", name: "Cherry" },
];

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return getRect(this);
    },
  );
});

afterEach(async () => {
  await virtual.stop();
  vi.restoreAllMocks();
});

describe.each([
  ["base", BaseSortable],
  ["radix", RadixSortable],
])("Sortable announcements (%s)", (_base, ui) => {
  function Fruits() {
    const [value, setValue] = React.useState(fruits);

    return (
      <ui.Sortable
        value={value}
        onValueChange={setValue}
        getItemValue={(item) => item.id}
        getItemLabel={(item) => item.name}
      >
        <ui.SortableContent>
          {value.map((fruit) => (
            <ui.SortableItem key={fruit.id} value={fruit.id}>
              <ui.SortableItemHandle aria-label={`Reorder ${fruit.name}`} />
            </ui.SortableItem>
          ))}
        </ui.SortableContent>
      </ui.Sortable>
    );
  }

  async function renderFruits() {
    render(<Fruits />);
    await settle();
    await virtual.start({ container: document.body });
    await virtual.clearSpokenPhraseLog();
  }

  test("announces a keyboard drag once per position", async () => {
    await renderFruits();

    const handle = screen.getByLabelText("Reorder Cherry");
    handle.focus();
    await virtual.clearSpokenPhraseLog();
    await pressKey(handle, " ", "Space");
    await pressKey(handle, "ArrowUp");
    await pressKey(handle, "ArrowUp");
    await pressKey(handle, " ", "Space");

    expect(await getAnnouncements()).toEqual([
      "assertive: Grabbed Cherry, position 3 of 3. Use the up and down arrow keys to move it, Space or Enter to drop it, or Escape to cancel.",
      "assertive: Cherry, position 2 of 3.",
      "assertive: Cherry, position 1 of 3.",
      "assertive: Dropped Cherry at position 1 of 3.",
    ]);
    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Reorder Cherry", "Reorder Apple", "Reorder Banana"]);
  });

  test("announces a cancelled keyboard drag", async () => {
    await renderFruits();

    const handle = screen.getByLabelText("Reorder Apple");
    handle.focus();
    await virtual.clearSpokenPhraseLog();
    await pressKey(handle, " ", "Space");
    await pressKey(handle, "ArrowDown");
    await pressKey(handle, "Escape");

    expect(await getAnnouncements()).toEqual([
      "assertive: Grabbed Apple, position 1 of 3. Use the up and down arrow keys to move it, Space or Enter to drop it, or Escape to cancel.",
      "assertive: Apple, position 2 of 3.",
      "assertive: Cancelled. Apple is back at position 1 of 3.",
    ]);
  });

  test("announces a mouse drag without the keyboard hint", async () => {
    await renderFruits();

    const handle = screen.getByLabelText("Reorder Banana");
    const start = { clientX: 100, clientY: ROW_HEIGHT * 1.5 };
    fireEvent.mouseDown(handle, { ...start, button: 0 });
    await settle();
    for (let step = 1; step <= 8; step++) {
      fireEvent.mouseMove(document, {
        clientX: start.clientX,
        clientY: start.clientY - (ROW_HEIGHT * step) / 8,
      });
      await settle();
    }
    fireEvent.mouseUp(document, {
      clientX: start.clientX,
      clientY: start.clientY - ROW_HEIGHT,
    });
    await settle();

    expect(await getAnnouncements()).toEqual([
      "assertive: Grabbed Banana, position 2 of 3.",
      "assertive: Banana, position 1 of 3.",
      "assertive: Dropped Banana at position 1 of 3.",
    ]);
  });
});

function getRect(element: Element) {
  const content = element.closest("[data-slot=sortable-content]");
  const item = element.closest("[data-slot=sortable-item]");
  if (item?.parentElement) {
    const index = [...item.parentElement.children].indexOf(item);
    return DOMRect.fromRect({
      y: index * ROW_HEIGHT,
      width: 200,
      height: ROW_HEIGHT,
    });
  }
  if (content) {
    return DOMRect.fromRect({
      width: 200,
      height: content.children.length * ROW_HEIGHT,
    });
  }
  return DOMRect.fromRect();
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

async function pressKey(element: Element, key: string, code = key) {
  fireEvent.keyDown(element, { key, code });
  await settle();
}

async function getAnnouncements() {
  const log = await virtual.spokenPhraseLog();
  return log.filter((phrase) => phrase.startsWith("assertive: "));
}
