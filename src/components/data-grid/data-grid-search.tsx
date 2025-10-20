"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchState } from "@/types/data-grid";

interface DataGridSearchProps extends SearchState {}

export const DataGridSearch = React.memo(DataGridSearchImpl, (prev, next) => {
  return (
    prev.searchOpen === next.searchOpen &&
    prev.searchQuery === next.searchQuery &&
    prev.matchIndex === next.matchIndex &&
    prev.searchMatches.length === next.searchMatches.length
  );
});

function DataGridSearchImpl({
  searchOpen,
  searchQuery,
  searchMatches,
  matchIndex,
  searchInputRef,
  onSearchOpenChange,
  onSearch,
  navigateToNextMatch,
  navigateToPrevMatch,
  setSearchQuery,
}: DataGridSearchProps) {
  React.useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchOpen, searchInputRef]);

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
      data-slot="grid-search"
      className="fade-in-0 slide-in-from-top-2 absolute top-4 right-4 z-50 flex animate-in flex-col gap-2 rounded-lg border bg-background p-2 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <Input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Find in table..."
          className="h-8 w-64"
          ref={searchInputRef}
          value={searchQuery}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={navigateToPrevMatch}
            disabled={searchMatches.length === 0}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={navigateToNextMatch}
            disabled={searchMatches.length === 0}
          >
            <ChevronDown />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap text-muted-foreground text-xs">
        {searchMatches.length > 0 ? (
          <span>
            {matchIndex + 1} of {searchMatches.length}
          </span>
        ) : searchQuery ? (
          <span>No results</span>
        ) : (
          <span>Type to search</span>
        )}
      </div>
    </div>
  );
}
