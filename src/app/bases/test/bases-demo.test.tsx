import { render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/registry/bases/radix/ui/tooltip";

import { AriaBasesDemo } from "../components/aria-bases-demo";
import { BaseBasesDemo } from "../components/base-bases-demo";
import { BaseBasesGrid } from "../components/base-bases-grid";
import { RadixBasesDemo } from "../components/radix-bases-demo";
import { RadixBasesGrid } from "../components/radix-bases-grid";

const demos = [
  ["radix", RadixBasesDemo, "table"],
  ["base", BaseBasesDemo, "table"],
  // React Aria renders the table as an interactive grid
  ["aria", AriaBasesDemo, "grid"],
] as const;

describe.each(demos)("%s bases demo", (_, Demo, tableRole) => {
  it.each([["plain"], ["advanced"], ["command"]])(
    "renders the first page of tasks with the %s toolbar",
    (filterMode) => {
      render(
        <NuqsTestingAdapter searchParams={{ filterMode, dir: "rtl" }}>
          <Demo />
        </NuqsTestingAdapter>,
      );

      const table = screen.getByRole(tableRole, { name: "Tasks" });
      // Header row plus the default page of 10
      expect(within(table).getAllByRole("row")).toHaveLength(11);
      expect(screen.getByRole("button", { name: /sort/i })).toBeTruthy();
    },
  );
});

describe.each([
  ["radix", RadixBasesGrid],
  ["base", BaseBasesGrid],
] as const)("%s bases grid", (_, Grid) => {
  it("renders the grid with its toolbar", () => {
    render(
      // The app provides this for Radix tooltips in the grid's column headers
      <TooltipProvider>
        <NuqsTestingAdapter searchParams={{ view: "grid", dir: "rtl" }}>
          <Grid />
        </NuqsTestingAdapter>
      </TooltipProvider>,
    );

    expect(screen.getByRole("grid")).toBeTruthy();
    expect(screen.getByRole("button", { name: /sort/i })).toBeTruthy();
  });
});
