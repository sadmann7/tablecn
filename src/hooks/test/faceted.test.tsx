import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import * as AriaFaceted from "@/registry/bases/aria/ui/faceted";
import * as BaseFaceted from "@/registry/bases/base/ui/faceted";
import * as RadixFaceted from "@/registry/bases/radix/ui/faceted";

type FacetedModule =
  | typeof RadixFaceted
  | typeof BaseFaceted
  | typeof AriaFaceted;

type ItemRole = "option" | "menuitemradio";

// React Aria renders a single-select list as a menu of radio items.
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

  it("keeps showing a controlled value the parent rejects", () => {
    const onValueChange = vi.fn();
    render(
      <SingleSelect ui={ui} value="active" onValueChange={onValueChange} />,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });
    act(() => {
      fireEvent.click(screen.getByRole(itemRole, { name: "Inactive" }));
    });

    expect(onValueChange).toHaveBeenCalledWith("inactive");
    expect(screen.getByRole("button").textContent).toContain("Active");
    expect(getActiveChecked(itemRole)).toBe("true");
  });

  it("stays open when the parent keeps a controlled open state", () => {
    const onOpenChange = vi.fn();
    render(<OpenSelect ui={ui} onOpenChange={onOpenChange} />);

    act(() => {
      fireEvent.keyDown(screen.getByRole(itemRole, { name: "Active" }), {
        key: "Escape",
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole(itemRole, { name: "Active" })).toBeTruthy();
  });

  it("follows a new controlled value without calling onValueChange", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SingleSelect ui={ui} value="active" onValueChange={onValueChange} />,
    );

    rerender(
      <SingleSelect ui={ui} value="inactive" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("button").textContent).toContain("Inactive");

    rerender(
      <SingleSelect ui={ui} value={undefined} onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("button").textContent).toContain("Pick a status");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe.each([
  ["radix", RadixFaceted],
  ["base", BaseFaceted],
] as const)("Faceted listbox (%s)", (_name, ui) => {
  it("marks only applied options as selected", () => {
    render(<MultiSelect ui={ui} />);

    const active = screen.getByRole("option", { name: "Active" });
    expect(active.closest("[cmdk-item]")?.getAttribute("data-selected")).toBe(
      "true",
    );
    expect(active.getAttribute("aria-selected")).toBe("false");

    act(() => {
      fireEvent.click(screen.getByRole("option", { name: "Inactive" }));
    });

    const inactive = screen.getByRole("option", { name: "Inactive" });
    expect(inactive.getAttribute("aria-selected")).toBe("true");
    expect(inactive.hasAttribute("aria-checked")).toBe(false);
    expect(
      screen.getByRole("listbox").getAttribute("aria-multiselectable"),
    ).toBe("true");
  });

  it("leaves aria-multiselectable off in single mode", () => {
    render(<SingleSelect ui={ui} />);
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(
      screen.getByRole("listbox").hasAttribute("aria-multiselectable"),
    ).toBe(false);
  });

  it("points aria-activedescendant at the highlighted option", async () => {
    render(<MultiSelect ui={ui} withInput />);

    act(() => {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    });

    const option = screen.getByRole("option", { name: "Inactive" });
    await waitFor(() => {
      expect(
        screen.getByRole("combobox").getAttribute("aria-activedescendant"),
      ).toBe(option.id);
      expect(
        screen.getByRole("listbox").getAttribute("aria-activedescendant"),
      ).toBe(option.id);
    });
  });

  it("names the dialog, input and list after the input", () => {
    render(<MultiSelect ui={ui} withInput />);

    expect(screen.getByRole("dialog", { name: "Search status" })).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Search status" }),
    ).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Search status" })).toBeTruthy();
  });

  it("announces toggled options in a live region", () => {
    render(<MultiSelect ui={ui} />);

    const status = document.querySelector("[aria-live=polite]");
    act(() => {
      fireEvent.click(screen.getByRole("option", { name: "Inactive" }));
    });
    expect(status?.textContent).toBe("Inactive selected");

    act(() => {
      fireEvent.click(screen.getByRole("option", { name: "Inactive" }));
    });
    expect(status?.textContent).toBe("Inactive not selected");
  });
});

const items = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

function SingleSelect({
  ui,
  ...props
}: {
  ui: FacetedModule;
  value?: string;
  onValueChange?: (value: string | undefined) => void;
}) {
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
  const isControlled = "value" in props;

  return (
    <Faceted
      value={isControlled ? props.value : value}
      onValueChange={isControlled ? props.onValueChange : setValue}
      items={items}
    >
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

function OpenSelect({
  ui,
  onOpenChange,
}: {
  ui: FacetedModule;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    Faceted,
    FacetedContent,
    FacetedGroup,
    FacetedItem,
    FacetedList,
    FacetedTrigger,
    FacetedValue,
  } = ui;

  return (
    <Faceted open onOpenChange={onOpenChange} items={items}>
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

function MultiSelect({
  ui,
  withInput = false,
}: {
  ui: typeof RadixFaceted | typeof BaseFaceted;
  withInput?: boolean;
}) {
  const { Faceted, FacetedContent, FacetedInput, FacetedItem, FacetedList } =
    ui;

  return (
    <Faceted items={items} multiple defaultOpen>
      <FacetedContent>
        {withInput ? <FacetedInput placeholder="Search status" /> : null}
        <FacetedList>
          {items.map((item) => (
            <FacetedItem key={item.value} value={item.value}>
              {item.label}
            </FacetedItem>
          ))}
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
  const checked = item.getAttribute(
    itemRole === "option" ? "aria-selected" : "aria-checked",
  );
  act(() => {
    // React Aria leaves focus on body here, so dispatch from the item.
    fireEvent.keyDown(item, { key: "Escape" });
  });
  return checked;
}
