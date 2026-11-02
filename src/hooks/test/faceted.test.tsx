import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import * as AriaFaceted from "@/registry/bases/aria/ui/faceted";
import * as BaseFaceted from "@/registry/bases/base/ui/faceted";
import * as RadixFaceted from "@/registry/bases/radix/ui/faceted";

type FacetedModule =
  | typeof RadixFaceted
  | typeof BaseFaceted
  | typeof AriaFaceted;

type ItemRole = "option" | "menuitemradio";

// React Aria renders a single-select list as a menu of radio items
describe.each([
  ["radix", RadixFaceted, "option"],
  ["base", BaseFaceted, "option"],
  ["aria", AriaFaceted, "menuitemradio"],
] as const)("Faceted (%s)", (_name, ui, itemRole) => {
  it("keeps the indicator in sync when a single value is toggled repeatedly", () => {
    render(<SingleSelect ui={ui} />);

    for (let round = 0; round < 3; round++) {
      toggleActive(itemRole);
      expect(screen.getByRole("button").textContent).toContain("Active");
      expect(getActiveChecked(itemRole)).toBe("true");

      toggleActive(itemRole);
      expect(screen.getByRole("button").textContent).toContain("Pick a status");
      expect(getActiveChecked(itemRole)).toBe("false");
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

function toggleActive(itemRole: ItemRole) {
  act(() => {
    fireEvent.click(screen.getByRole("button"));
  });
  act(() => {
    fireEvent.click(screen.getByRole(itemRole, { name: "Active" }));
  });
}

function getActiveChecked(itemRole: ItemRole) {
  act(() => {
    fireEvent.click(screen.getByRole("button"));
  });
  const item = screen.getByRole(itemRole, { name: "Active" });
  const checked = item.getAttribute("aria-checked");
  act(() => {
    // React Aria leaves focus on body here, so dispatch from the item
    fireEvent.keyDown(item, { key: "Escape" });
  });
  return checked;
}
