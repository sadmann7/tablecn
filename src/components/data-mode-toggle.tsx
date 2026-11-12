"use client";

import { cn } from "cn";
import { parseAsStringEnum } from "nuqs";

export const DEMO_DATA_MODES = [
  { value: "demo", label: "Demo data" },
  { value: "worst", label: "Worst case" },
  { value: "empty", label: "Empty" },
  { value: "one", label: "One" },
] as const;

export type DemoDataMode = (typeof DEMO_DATA_MODES)[number]["value"];

export const demoDataModeParser = parseAsStringEnum<DemoDataMode>(
  DEMO_DATA_MODES.map((mode) => mode.value),
);

interface DataModeToggleProps {
  value: DemoDataMode;
  onValueChange: (value: DemoDataMode) => void;
}

export function DataModeToggle({ value, onValueChange }: DataModeToggleProps) {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-0.5 rounded-full border border-input bg-background p-0.5 font-sans text-xs shadow-sm">
      {DEMO_DATA_MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={mode.value === value}
          className={cn(
            "rounded-full px-3 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            mode.value === value && "bg-muted text-foreground",
          )}
          onClick={() => onValueChange(mode.value)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
