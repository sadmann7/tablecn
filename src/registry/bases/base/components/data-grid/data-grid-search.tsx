"use client";

import { type RowData, Subscribe, type Table } from "@tanstack/react-table";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { Button } from "@/registry/bases/base/ui/button";
import { Input } from "@/registry/bases/base/ui/input";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

function onTriggerPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  // Prevent the trigger from stealing focus away from the input
  if (
    event.button === 0 &&
    event.ctrlKey === false &&
    event.pointerType === "mouse" &&
    !(event.target instanceof HTMLInputElement)
  ) {
    event.preventDefault();
  }
}

interface DataGridSearchProps<TData extends RowData> {
  table: Table<DataGridFeatures, TData>;
}

export function DataGridSearch<TData extends RowData>({
  table,
}: DataGridSearchProps<TData>) {
  return (
    <Subscribe
      source={table.store}
      selector={(state) => ({
        searchOpen: state.searchOpen,
        searchQuery: state.searchQuery,
        matchIndex: state.searchMatchIndex,
        matchCount: table.getSearchMatches().length,
      })}
    >
      {(searchState) => <DataGridSearchView table={table} {...searchState} />}
    </Subscribe>
  );
}

interface DataGridSearchViewProps<
  TData extends RowData,
> extends DataGridSearchProps<TData> {
  searchOpen: boolean;
  searchQuery: string;
  matchIndex: number;
  matchCount: number;
}

const DataGridSearchView = React.memo(DataGridSearchImpl, (prev, next) => {
  if (prev.table !== next.table) return false;
  if (prev.searchOpen !== next.searchOpen) return false;

  if (!next.searchOpen) return true;

  // Exclude searchQuery because the input is uncontrolled, and hasQuery state handles the status text
  return (
    prev.matchIndex === next.matchIndex && prev.matchCount === next.matchCount
  );
}) as typeof DataGridSearchImpl;

function DataGridSearchImpl<TData extends RowData>({
  table,
  searchOpen,
  searchQuery,
  matchIndex,
  matchCount,
}: DataGridSearchViewProps<TData>) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isComposingRef = React.useRef(false);
  const [hasQuery, setHasQuery] = React.useState(searchQuery.length > 0);

  React.useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return;
    }

    isComposingRef.current = false;
    setHasQuery(false);
  }, [searchOpen]);

  React.useEffect(() => {
    if (!searchOpen) return;

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        table.closeSearch();
      }
    }

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [searchOpen, table]);

  const debouncedSearch = useDebouncedCallback((query: string) => {
    table.setSearchQuery(query);
  }, 150);

  function onCompositionStart() {
    isComposingRef.current = true;
  }

  function onCompositionEnd(event: React.CompositionEvent<HTMLInputElement>) {
    isComposingRef.current = false;
    const value = event.currentTarget.value;
    setHasQuery(value.length > 0);
    debouncedSearch(value);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    event.stopPropagation();

    if (event.key === "Enter") {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      if (event.shiftKey) {
        table.goToPrevSearchMatch();
      } else {
        table.goToNextSearchMatch();
      }
    }
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isComposingRef.current) return;
    const value = event.target.value;
    setHasQuery(value.length > 0);
    debouncedSearch(value);
  }

  function onClose() {
    table.closeSearch();
  }

  function onPrevMatch() {
    table.goToPrevSearchMatch();
  }

  function onNextMatch() {
    table.goToNextSearchMatch();
  }

  if (!searchOpen) return null;

  return (
    <div
      role="search"
      data-slot="data-grid-search"
      className="absolute inset-e-4 top-4 z-50 flex animate-in flex-col gap-2 rounded-lg border bg-background p-2 shadow-lg fade-in-0 slide-in-from-top-2"
    >
      <div className="flex items-center gap-2">
        <Input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Find in table..."
          className="w-64"
          ref={inputRef}
          defaultValue={searchQuery}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
        />
        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous match"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onPrevMatch}
            onPointerDown={onTriggerPointerDown}
            disabled={matchCount === 0}
          >
            <IconPlaceholder
              lucide="ChevronUp"
              tabler="IconChevronUp"
              hugeicons="ArrowUp01Icon"
              phosphor="CaretUpIcon"
              remixicon="RiArrowUpSLine"
            />
          </Button>
          <Button
            aria-label="Next match"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onNextMatch}
            onPointerDown={onTriggerPointerDown}
            disabled={matchCount === 0}
          >
            <IconPlaceholder
              lucide="ChevronDown"
              tabler="IconChevronDown"
              hugeicons="ArrowDown01Icon"
              phosphor="CaretDownIcon"
              remixicon="RiArrowDownSLine"
            />
          </Button>
          <Button
            aria-label="Close search"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
          >
            <IconPlaceholder
              lucide="X"
              tabler="IconX"
              hugeicons="Cancel01Icon"
              phosphor="XIcon"
              remixicon="RiCloseLine"
            />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
        {matchCount > 0 ? (
          <span>
            {matchIndex + 1} of {matchCount}
          </span>
        ) : hasQuery ? (
          <span>No results</span>
        ) : (
          <span>Type to search</span>
        )}
      </div>
    </div>
  );
}
