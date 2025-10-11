"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchState } from "@/types/data-grid";

interface DataGridSearchProps extends SearchState {}

export function DataGridSearch({
  searchOpen,
  searchQuery,
  searchMatches,
  currentMatchIndex,
  onSearchOpenChange,
  onSearch,
  navigateToNextMatch,
  navigateToPrevMatch,
  setSearchQuery,
}: DataGridSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [searchOpen]);

  React.useEffect(() => {
    if (!searchOpen) return;

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onSearchOpenChange(false);
      }
    }

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [searchOpen, onSearchOpenChange]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      event.stopPropagation();

      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          navigateToPrevMatch();
        } else {
          navigateToNextMatch();
        }
      }
    },
    [navigateToNextMatch, navigateToPrevMatch],
  );

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
      onSearch(event.target.value);
    },
    [setSearchQuery, onSearch],
  );

  const onClose = React.useCallback(() => {
    onSearchOpenChange(false);
  }, [onSearchOpenChange]);

  if (!searchOpen) return null;

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
        {searchMatches.length > 0 ? (
          <span className="whitespace-nowrap">
            {currentMatchIndex + 1} of {searchMatches.length}
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
          onClick={navigateToPrevMatch}
          disabled={searchMatches.length === 0}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={navigateToNextMatch}
          disabled={searchMatches.length === 0}
          title="Next match (Enter)"
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          title="Close (Escape)"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
