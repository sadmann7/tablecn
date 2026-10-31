import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import * as BaseFaceted from "@/registry/bases/base/ui/faceted";
import * as RadixFaceted from "@/registry/bases/radix/ui/faceted";

type FacetedModule = typeof RadixFaceted | typeof BaseFaceted;

describe.each([
  ["radix", RadixFaceted],
  ["base", BaseFaceted],
])("Faceted (%s)", (_name, ui) => {
  it("keeps the indicator in sync when a single value is toggled repeatedly", () => {
    render(<SingleSelect ui={ui} />);

    for (let round = 0; round < 3; round++) {
      toggleActive();
      expect(screen.getByRole("button").textContent).toContain("Active");
      expect(getActiveChecked()).toBe("true");

      toggleActive();
      expect(screen.getByRole("button").textContent).toContain("Pick a status");
      expect(getActiveChecked()).toBe("false");
    }
  });
});

const items = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

function SingleSelect({ ui }: { ui: FacetedModule }) {
  const {
    Faceted,
    FacetedContent,
    FacetedGroup,
    FacetedItem,
    FacetedList,
    FacetedTrigger,
    FacetedValue,
  } = ui;
  const [value, setValue] = React.useState<string | undefined>();

  return (
    <Faceted value={value} onValueChange={setValue} items={items}>
      <FacetedTrigger>
        <FacetedValue placeholder="Pick a status" />
      </FacetedTrigger>
      <FacetedContent>
        <FacetedList>
          <FacetedGroup>
            {items.map((item) => (
              <FacetedItem key={item.value} value={item.value}>
                {item.label}
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

function toggleActive() {
  act(() => {
    fireEvent.click(screen.getByRole("button"));
  });
  act(() => {
    fireEvent.click(screen.getByRole("option", { name: "Active" }));
  });
}

function getActiveChecked() {
  act(() => {
    fireEvent.click(screen.getByRole("button"));
  });
  const checked = screen
    .getByRole("option", { name: "Active" })
    .getAttribute("aria-checked");
  act(() => {
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
  });
  return checked;
}
