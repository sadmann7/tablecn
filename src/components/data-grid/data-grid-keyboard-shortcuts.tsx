"use client";

import { XIcon } from "lucide-react";
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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";

const SHORTCUT_KEY = "/";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
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
  const [open, setOpen] = React.useState(false);

  const isMac =
    typeof navigator !== "undefined"
      ? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
      : false;

  const modKey = isMac ? "⌘" : "Ctrl";

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
            keys: ["Double Click"],
            description: "Start editing cell",
          },
          {
            keys: ["Delete"],
            description: "Clear selected cells",
          },
          {
            keys: ["Backspace"],
            description: "Clear selected cells",
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl px-0" showCloseButton={false}>
        <DialogClose className="absolute top-6 right-6" asChild>
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
        <Separator className="mx-auto data-[orientation=horizontal]:w-[calc(100%-theme(spacing.12))]" />
        <div className="max-h-[60vh] overflow-y-auto px-6">
          <div className="flex flex-col gap-6">
            {shortcutGroups.map((shortcutGroup) => (
              <div key={shortcutGroup.title} className="flex flex-col gap-2">
                <h3 className="font-semibold text-foreground text-sm">
                  {shortcutGroup.title}
                </h3>
                <div className="divide-y divide-border rounded-md border">
                  {shortcutGroup.shortcuts.map((shortcut, index) => (
                    <ShortcutRow
                      key={index}
                      keys={shortcut.keys}
                      description={shortcut.description}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ keys, description }: ShortcutItem) {
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
