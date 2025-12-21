"use client";

import { useDirection } from "@radix-ui/react-direction";
import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

const SHORTCUT_KEY = "/";

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

interface DataGridKeyboardShortcutsProps {
  enableSearch?: boolean;
}

export const DataGridKeyboardShortcuts = React.memo(
  DataGridKeyboardShortcutsImpl,
  (prev, next) => {
    return prev.enableSearch === next.enableSearch;
  },
);

function DataGridKeyboardShortcutsImpl({
  enableSearch = false,
}: DataGridKeyboardShortcutsProps) {
  const dir = useDirection();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isMac =
    typeof navigator !== "undefined"
      ? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
      : false;

  const modKey = isMac ? "⌘" : "Ctrl";

  const onOpenChange = React.useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setInput("");
    }
  }, []);

  const onOpenAutoFocus = React.useCallback((event: Event) => {
    event.preventDefault();
    inputRef.current?.focus();
  }, []);

  const onInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInput(event.target.value);
    },
    [],
  );

  const shortcutGroups: ShortcutGroup[] = React.useMemo(
    () => [
      {
        title: "Navigation",
        shortcuts: [
          {
            keys: ["↑", "↓", "←", "→"],
            description: "Navigate between cells",
          },
          {
            keys: ["Tab"],
            description: "Move to next cell",
          },
          {
            keys: ["Shift", "Tab"],
            description: "Move to previous cell",
          },
          {
            keys: ["Home"],
            description: "Move to first column",
          },
          {
            keys: ["End"],
            description: "Move to last column",
          },
          {
            keys: [modKey, "↑"],
            description: "Move to first row (same column)",
          },
          {
            keys: [modKey, "↓"],
            description: "Move to last row (same column)",
          },
          {
            keys: [modKey, "←"],
            description: "Move to first column (same row)",
          },
          {
            keys: [modKey, "→"],
            description: "Move to last column (same row)",
          },
          {
            keys: [modKey, "Home"],
            description: "Move to first cell",
          },
          {
            keys: [modKey, "End"],
            description: "Move to last cell",
          },
          {
            keys: ["PgUp"],
            description: "Move up one page",
          },
          {
            keys: ["PgDn"],
            description: "Move down one page",
          },
          {
            keys: ["⌥", "↑"],
            description: "Scroll up one page",
          },
          {
            keys: ["⌥", "↓"],
            description: "Scroll down one page",
          },
          {
            keys: ["⌥", "PgUp"],
            description: "Scroll left one page of columns",
          },
          {
            keys: ["⌥", "PgDn"],
            description: "Scroll right one page of columns",
          },
        ],
      },
      {
        title: "Selection",
        shortcuts: [
          {
            keys: ["Shift", "↑↓←→"],
            description: "Extend selection",
          },
          {
            keys: [modKey, "Shift", "↑"],
            description: "Select to top of table",
          },
          {
            keys: [modKey, "Shift", "↓"],
            description: "Select to bottom of table",
          },
          {
            keys: [modKey, "Shift", "←"],
            description: "Select to first column",
          },
          {
            keys: [modKey, "Shift", "→"],
            description: "Select to last column",
          },
          {
            keys: [modKey, "A"],
            description: "Select all cells",
          },
          {
            keys: [modKey, "Click"],
            description: "Toggle cell selection",
          },
          {
            keys: ["Shift", "Click"],
            description: "Select range",
          },
          {
            keys: ["Esc"],
            description: "Clear selection",
          },
        ],
      },
      {
        title: "Editing",
        shortcuts: [
          {
            keys: ["Enter"],
            description: "Start editing cell",
          },
          {
            keys: ["F2"],
            description: "Start editing cell",
          },
          {
            keys: ["Double Click"],
            description: "Start editing cell",
          },
          {
            keys: ["Shift", "Enter"],
            description: "Insert row below",
          },
          {
            keys: [modKey, "C"],
            description: "Copy selected cells",
          },
          {
            keys: [modKey, "X"],
            description: "Cut selected cells",
          },
          {
            keys: [modKey, "V"],
            description: "Paste cells",
          },
          {
            keys: ["Delete"],
            description: "Clear selected cells",
          },
          {
            keys: ["Backspace"],
            description: "Clear selected cells",
          },
          {
            keys: [modKey, "Backspace"],
            description: "Delete selected rows",
          },
        ],
      },
      ...(enableSearch
        ? [
            {
              title: "Search",
              shortcuts: [
                {
                  keys: [modKey, "F"],
                  description: "Open search",
                },
                {
                  keys: ["Enter"],
                  description: "Next match",
                },
                {
                  keys: ["Shift", "Enter"],
                  description: "Previous match",
                },
                {
                  keys: ["Esc"],
                  description: "Close search",
                },
              ],
            },
          ]
        : []),
      {
        title: "Filtering",
        shortcuts: [
          {
            keys: [modKey, "Shift", "F"],
            description: "Toggle the filter menu",
          },
          {
            keys: ["Backspace"],
            description: "Remove filter (when focused)",
          },
          {
            keys: ["Delete"],
            description: "Remove filter (when focused)",
          },
        ],
      },
      {
        title: "Sorting",
        shortcuts: [
          {
            keys: [modKey, "Shift", "S"],
            description: "Toggle the sort menu",
          },
          {
            keys: ["Backspace"],
            description: "Remove sort (when focused)",
          },
          {
            keys: ["Delete"],
            description: "Remove sort (when focused)",
          },
        ],
      },
      {
        title: "General",
        shortcuts: [
          {
            keys: [modKey, "/"],
            description: "Show keyboard shortcuts",
          },
        ],
      },
    ],
    [modKey, enableSearch],
  );

  const filteredGroups = React.useMemo(() => {
    if (!input.trim()) return shortcutGroups;

    const query = input.toLowerCase();
    return shortcutGroups
      .map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter(
          (shortcut) =>
            shortcut.description.toLowerCase().includes(query) ||
            shortcut.keys.some((key) => key.toLowerCase().includes(query)),
        ),
      }))
      .filter((group) => group.shortcuts.length > 0);
  }, [shortcutGroups, input]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === SHORTCUT_KEY) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        className="max-w-2xl px-0"
        onOpenAutoFocus={onOpenAutoFocus}
        showCloseButton={false}
      >
        <DialogClose className="absolute end-6 top-6" asChild>
          <Button variant="ghost" size="icon" className="size-6">
            <XIcon />
          </Button>
        </DialogClose>
        <DialogHeader className="px-6">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Use these keyboard shortcuts to navigate and interact with the data
            grid more efficiently.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <div className="relative">
            <SearchIcon className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search shortcuts..."
              className="h-8 ps-8"
              value={input}
              onChange={onInputChange}
            />
          </div>
        </div>
        <Separator className="mx-auto data-[orientation=horizontal]:w-[calc(100%-(--spacing(12)))]" />
        <div className="h-[40vh] overflow-y-auto px-6">
          {filteredGroups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <SearchIcon className="pointer-events-none size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-medium text-lg tracking-tight">
                  No shortcuts found
                </div>
                <p className="text-muted-foreground text-sm">
                  Try searching for a different term.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {filteredGroups.map((shortcutGroup) => (
                <div key={shortcutGroup.title} className="flex flex-col gap-2">
                  <h3 className="font-semibold text-foreground text-sm">
                    {shortcutGroup.title}
                  </h3>
                  <div className="divide-y divide-border rounded-md border">
                    {shortcutGroup.shortcuts.map((shortcut, index) => (
                      <ShortcutCard
                        key={index}
                        keys={shortcut.keys}
                        description={shortcut.description}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutCard({
  keys,
  description,
}: ShortcutGroup["shortcuts"][number]) {
  return (
    <div className="flex items-center gap-4 px-3 py-2">
      <span className="flex-1 text-sm">{description}</span>
      <KbdGroup className="shrink-0">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            {index > 0 && (
              <span className="text-muted-foreground text-xs">+</span>
            )}
            <Kbd>{key}</Kbd>
          </React.Fragment>
        ))}
      </KbdGroup>
    </div>
  );
}
