"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DataGridSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  currentMatchIndex: number;
  totalMatches: number;
  onSearchChange: (query: string) => void;
  onNextMatch: () => void;
  onPrevMatch: () => void;
}

export function DataGridSearch({
  open,
  onOpenChange,
  searchQuery,
  currentMatchIndex,
  totalMatches,
  onSearchChange,
  onNextMatch,
  onPrevMatch,
}: DataGridSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onOpenChange]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      event.stopPropagation();

      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          onPrevMatch();
        } else {
          onNextMatch();
        }
      }
    },
    [onNextMatch, onPrevMatch],
  );

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(event.target.value);
    },
    [onSearchChange],
  );

  if (!open) return null;

  return (
    <div
      role="search"
      data-slot="data-grid-search"
      className="fade-in-0 slide-in-from-top-2 absolute top-4 right-4 z-50 flex animate-in items-center gap-2 rounded-lg border bg-background p-2 shadow-lg"
    >
      <Input
        ref={inputRef}
        type="text"
        placeholder="Find in table..."
        value={searchQuery}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="h-8 w-64"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        {totalMatches > 0 ? (
          <span className="whitespace-nowrap">
            {currentMatchIndex + 1} of {totalMatches}
          </span>
        ) : searchQuery ? (
          <span className="whitespace-nowrap">No results</span>
        ) : (
          <span className="whitespace-nowrap">Type to search</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onPrevMatch}
          disabled={totalMatches === 0}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onNextMatch}
          disabled={totalMatches === 0}
          title="Next match (Enter)"
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onOpenChange(false)}
          title="Close (Escape)"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
