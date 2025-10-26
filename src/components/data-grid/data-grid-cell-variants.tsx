"use client";

import type { Cell, Table } from "@tanstack/react-table";
import { Check, X } from "lucide-react";
import * as React from "react";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { getLineCount } from "@/lib/data-grid";
import { cn } from "@/lib/utils";

interface CellVariantProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  rowIndex: number;
  columnId: string;
  isEditing: boolean;
  isFocused: boolean;
  isSelected: boolean;
}

export function ShortTextCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  isSelected,
}: CellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const [value, setValue] = React.useState(initialValue);
  const cellRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;

  const onBlur = React.useCallback(() => {
    // Read the current value directly from the DOM to avoid stale state
    const currentValue = cellRef.current?.textContent ?? "";
    if (currentValue !== initialValue) {
      meta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
    }
    meta?.onCellEditingStop?.();
  }, [meta, rowIndex, columnId, initialValue]);

  const onInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const currentValue = event.currentTarget.textContent ?? "";
      setValue(currentValue);
    },
    [],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            meta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
          }
          meta?.onCellEditingStop?.({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            meta?.onDataUpdate?.({ rowIndex, columnId, value: currentValue });
          }
          meta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          cellRef.current?.blur();
        }
      } else if (
        isFocused &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        // Handle typing to pre-fill the value when editing starts
        setValue(event.key);

        queueMicrotask(() => {
          if (cellRef.current && cellRef.current.contentEditable === "true") {
            cellRef.current.textContent = event.key;
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(cellRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        });
      }
    },
    [isEditing, isFocused, initialValue, meta, rowIndex, columnId],
  );

  React.useEffect(() => {
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue;
    }
  }, [initialValue, isEditing]);

  React.useEffect(() => {
    if (isEditing && cellRef.current) {
      cellRef.current.focus();

      if (!cellRef.current.textContent && value) {
        cellRef.current.textContent = value;
      }

      if (cellRef.current.textContent) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(cellRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    // Don't focus if we're in the middle of a scroll operation
    if (
      isFocused &&
      !isEditing &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, value, meta?.searchOpen, meta?.isScrolling]);

  const displayValue = !isEditing ? (value ?? "") : "";

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      <div
        role="textbox"
        data-slot="grid-cell-content"
        contentEditable={isEditing}
        tabIndex={-1}
        ref={cellRef}
        onBlur={onBlur}
        onInput={onInput}
        suppressContentEditableWarning
        className={cn("size-full overflow-hidden outline-none", {
          "whitespace-nowrap [&_*]:inline [&_*]:whitespace-nowrap [&_br]:hidden":
            isEditing,
        })}
      >
        {displayValue}
      </div>
    </DataGridCellWrapper>
  );
}

export function LongTextCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
}: CellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const [value, setValue] = React.useState(initialValue ?? "");
  const [open, setOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;
  const sideOffset = -(containerRef.current?.clientHeight ?? 0);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue ?? "");
  }

  // Debounced auto-save (300ms delay)
  const debouncedSave = useDebouncedCallback((newValue: string) => {
    meta?.onDataUpdate?.({ rowIndex, columnId, value: newValue });
  }, 300);

  const onSave = React.useCallback(() => {
    // Immediately save any pending changes and close the popover
    if (value !== initialValue) {
      meta?.onDataUpdate?.({ rowIndex, columnId, value });
    }
    setOpen(false);
    meta?.onCellEditingStop?.();
  }, [meta, value, initialValue, rowIndex, columnId]);

  const onCancel = React.useCallback(() => {
    // Restore the original value
    setValue(initialValue ?? "");
    meta?.onDataUpdate?.({ rowIndex, columnId, value: initialValue });
    setOpen(false);
    meta?.onCellEditingStop?.();
  }, [meta, initialValue, rowIndex, columnId]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setValue(newValue);
      // Debounced auto-save
      debouncedSave(newValue);
    },
    [debouncedSave],
  );

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        // Immediately save any pending changes when closing
        if (value !== initialValue) {
          meta?.onDataUpdate?.({ rowIndex, columnId, value });
        }
        meta?.onCellEditingStop?.();
      }
    },
    [meta, value, initialValue, rowIndex, columnId],
  );

  const onOpenAutoFocus: NonNullable<
    React.ComponentProps<typeof PopoverContent>["onOpenAutoFocus"]
  > = React.useCallback((event) => {
    event.preventDefault();
    if (textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, []);

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing && !open) {
        if (event.key === "Escape") {
          event.preventDefault();
          meta?.onCellEditingStop?.();
        } else if (event.key === "Tab") {
          event.preventDefault();
          // Save any pending changes
          if (value !== initialValue) {
            meta?.onDataUpdate?.({ rowIndex, columnId, value });
          }
          meta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        }
      }
    },
    [isEditing, open, meta, value, initialValue, rowIndex, columnId],
  );

  const onTextareaKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSave();
      }
      // Stop propagation to prevent grid navigation
      event.stopPropagation();
    },
    [onCancel, onSave],
  );

  const onTextareaBlur = React.useCallback(() => {
    // Immediately save any pending changes on blur
    if (value !== initialValue) {
      meta?.onDataUpdate?.({ rowIndex, columnId, value });
    }
    setOpen(false);
    meta?.onCellEditingStop?.();
  }, [meta, value, initialValue, rowIndex, columnId]);

  React.useEffect(() => {
    if (isEditing && !open) {
      setOpen(true);
    }
    if (
      isFocused &&
      !isEditing &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, open, meta?.searchOpen, meta?.isScrolling]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <DataGridCellWrapper
          ref={containerRef}
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          onKeyDown={onWrapperKeyDown}
        >
          <span data-slot="grid-cell-content">{value}</span>
        </DataGridCellWrapper>
      </PopoverAnchor>
      <PopoverContent
        data-grid-cell-editor=""
        align="start"
        side="bottom"
        sideOffset={sideOffset}
        className="w-[400px] rounded-none p-0"
        onOpenAutoFocus={onOpenAutoFocus}
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={onTextareaKeyDown}
          onBlur={onTextareaBlur}
          className="min-h-[150px] resize-none rounded-none border-0 shadow-none focus-visible:ring-0"
          placeholder="Enter text..."
        />
      </PopoverContent>
    </Popover>
  );
}

export function NumberCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
}: CellVariantProps<TData>) {
  const initialValue = cell.getValue() as number;
  const [value, setValue] = React.useState(String(initialValue ?? ""));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;
  const cellOpts = cell.column.columnDef.meta?.cell;
  const min = cellOpts?.variant === "number" ? cellOpts.min : undefined;
  const max = cellOpts?.variant === "number" ? cellOpts.max : undefined;
  const step = cellOpts?.variant === "number" ? cellOpts.step : undefined;

  const onBlur = React.useCallback(() => {
    const numValue = value === "" ? null : Number(value);
    if (numValue !== initialValue) {
      meta?.onDataUpdate?.({ rowIndex, columnId, value: numValue });
    }
    meta?.onCellEditingStop?.();
  }, [meta, rowIndex, columnId, initialValue, value]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
    },
    [],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          const numValue = value === "" ? null : Number(value);
          if (numValue !== initialValue) {
            meta?.onDataUpdate?.({ rowIndex, columnId, value: numValue });
          }
          meta?.onCellEditingStop?.({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const numValue = value === "" ? null : Number(value);
          if (numValue !== initialValue) {
            meta?.onDataUpdate?.({ rowIndex, columnId, value: numValue });
          }
          meta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(String(initialValue ?? ""));
          inputRef.current?.blur();
        }
      } else if (isFocused) {
        // Handle Backspace to start editing with empty value
        if (event.key === "Backspace") {
          setValue("");
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          // Handle typing to pre-fill the value when editing starts
          setValue(event.key);
        }
      }
    },
    [isEditing, isFocused, initialValue, meta, rowIndex, columnId, value],
  );

  React.useEffect(() => {
    setValue(String(initialValue ?? ""));
  }, [initialValue]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    if (
      isFocused &&
      !isEditing &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, meta?.searchOpen, meta?.isScrolling]);

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onBlur={onBlur}
          onChange={onChange}
          className="w-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span data-slot="grid-cell-content">{value}</span>
      )}
    </DataGridCellWrapper>
  );
}

export function SelectCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
}: CellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const [value, setValue] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = cellOpts?.variant === "select" ? cellOpts.options : [];

  const onValueChange = React.useCallback(
    (newValue: string) => {
      setValue(newValue);
      meta?.onDataUpdate?.({ rowIndex, columnId, value: newValue });
      meta?.onCellEditingStop?.();
    },
    [meta, rowIndex, columnId],
  );

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        meta?.onCellEditingStop?.();
      }
    },
    [meta],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          setOpen(false);
          meta?.onCellEditingStop?.();
        } else if (event.key === "Tab") {
          event.preventDefault();
          setOpen(false);
          meta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        }
      }
    },
    [isEditing, initialValue, meta],
  );

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    if (isEditing && !open) {
      setOpen(true);
    }
    if (
      isFocused &&
      !isEditing &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, open, meta?.searchOpen, meta?.isScrolling]);

  const displayLabel =
    options.find((opt) => opt.value === value)?.label ?? value;

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Select
          value={value}
          onValueChange={onValueChange}
          open={open}
          onOpenChange={onOpenChange}
        >
          <SelectTrigger
            size="sm"
            className="size-full items-start border-none p-0 shadow-none focus-visible:ring-0 dark:bg-transparent [&_svg]:hidden"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            data-grid-cell-editor=""
            // compensate for the wrapper padding
            align="start"
            alignOffset={-8}
            sideOffset={-8}
            className="min-w-[calc(var(--radix-select-trigger-width)+16px)]"
          >
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span data-slot="grid-cell-content">{displayLabel}</span>
      )}
    </DataGridCellWrapper>
  );
}

export function MultiSelectCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
}: CellVariantProps<TData>) {
  const cellValue = React.useMemo(
    () => (cell.getValue() as string[]) ?? [],
    [cell],
  );

  const cellId = `${rowIndex}-${columnId}`;
  const prevCellIdRef = React.useRef(cellId);

  const [selectedValues, setSelectedValues] =
    React.useState<string[]>(cellValue);
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const meta = table.options.meta;
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = cellOpts?.variant === "multi-select" ? cellOpts.options : [];
  const sideOffset = -(containerRef.current?.clientHeight ?? 0);

  if (prevCellIdRef.current !== cellId) {
    prevCellIdRef.current = cellId;
    setSelectedValues(cellValue);
    setOpen(false);
    setSearchValue("");
  }

  const onValueChange = React.useCallback(
    (value: string) => {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];

      setSelectedValues(newValues);
      meta?.onDataUpdate?.({ rowIndex, columnId, value: newValues });
      // Clear search input and focus back on input after selection
      setSearchValue("");
      queueMicrotask(() => inputRef.current?.focus());
    },
    [selectedValues, meta, rowIndex, columnId],
  );

  const removeValue = React.useCallback(
    (valueToRemove: string, event?: React.MouseEvent) => {
      event?.stopPropagation();
      event?.preventDefault();
      const newValues = selectedValues.filter((v) => v !== valueToRemove);
      setSelectedValues(newValues);
      meta?.onDataUpdate?.({ rowIndex, columnId, value: newValues });
      // Focus back on input after removing
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [selectedValues, meta, rowIndex, columnId],
  );

  const clearAll = React.useCallback(() => {
    setSelectedValues([]);
    meta?.onDataUpdate?.({ rowIndex, columnId, value: [] });
    queueMicrotask(() => inputRef.current?.focus());
  }, [meta, rowIndex, columnId]);

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        setSearchValue("");
        meta?.onCellEditingStop?.();
      }
    },
    [meta],
  );

  const onOpenAutoFocus: NonNullable<
    React.ComponentProps<typeof PopoverContent>["onOpenAutoFocus"]
  > = React.useCallback((event) => {
    event.preventDefault();
    inputRef.current?.focus();
  }, []);

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Escape") {
          event.preventDefault();
          setSelectedValues(cellValue);
          setSearchValue("");
          setOpen(false);
          meta?.onCellEditingStop?.();
        } else if (event.key === "Tab") {
          event.preventDefault();
          setSearchValue("");
          setOpen(false);
          meta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        }
      }
    },
    [isEditing, cellValue, meta],
  );

  const onInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle backspace when input is empty - remove last selected item
      if (
        event.key === "Backspace" &&
        searchValue === "" &&
        selectedValues.length > 0
      ) {
        event.preventDefault();
        const lastValue = selectedValues[selectedValues.length - 1];
        if (lastValue) {
          removeValue(lastValue);
        }
      }
      // Prevent escape from propagating to close the popover immediately
      // Let the command handle it first
      if (event.key === "Escape") {
        event.stopPropagation();
      }
    },
    [searchValue, selectedValues, removeValue],
  );

  React.useEffect(() => {
    if (isEditing && !open) {
      setOpen(true);
    }
    if (
      isFocused &&
      !isEditing &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, open, meta?.searchOpen, meta?.isScrolling]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const displayLabels = selectedValues
    .map((val) => options.find((opt) => opt.value === val)?.label ?? val)
    .filter(Boolean);

  const rowHeight = table.options.meta?.rowHeight ?? "short";

  const lineCount = getLineCount(rowHeight);
  const maxVisibleBadgeCount = lineCount * 3;

  const visibleLabels = displayLabels.slice(0, maxVisibleBadgeCount);
  const hiddenBadgeCount = Math.max(
    0,
    displayLabels.length - maxVisibleBadgeCount,
  );

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverAnchor asChild>
            <div className="absolute inset-0" />
          </PopoverAnchor>
          <PopoverContent
            data-grid-cell-editor=""
            align="start"
            sideOffset={sideOffset}
            className="w-[300px] rounded-none p-0"
            onOpenAutoFocus={onOpenAutoFocus}
          >
            <Command className="[&_[data-slot=command-input-wrapper]]:h-auto [&_[data-slot=command-input-wrapper]]:border-none [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=command-input-wrapper]_svg]:hidden">
              <div className="flex min-h-9 flex-wrap items-center gap-1 border-b px-3 py-1.5">
                {selectedValues.map((value) => {
                  const option = options.find((opt) => opt.value === value);
                  const label = option?.label ?? value;

                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="h-5 gap-1 px-1.5 text-xs"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={(event) => removeValue(value, event)}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  );
                })}
                <CommandInput
                  ref={inputRef}
                  value={searchValue}
                  onValueChange={setSearchValue}
                  onKeyDown={onInputKeyDown}
                  placeholder="Search..."
                  className="h-auto flex-1 p-0"
                />
              </div>
              <CommandList className="max-h-full">
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup className="max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden">
                  {options.map((option) => {
                    const isSelected = selectedValues.includes(option.value);

                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => onValueChange(option.value)}
                      >
                        <div
                          className={cn(
                            "flex size-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <Check className="size-3" />
                        </div>
                        <span>{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {selectedValues.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={clearAll}
                        className="justify-center text-muted-foreground"
                      >
                        Clear all
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}
      {displayLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
          {visibleLabels.map((label, index) => (
            <Badge
              key={selectedValues[index]}
              variant="secondary"
              className="h-5 shrink-0 px-1.5 text-xs"
            >
              {label}
            </Badge>
          ))}
          {hiddenBadgeCount > 0 && (
            <Badge
              variant="outline"
              className="h-5 shrink-0 px-1.5 text-muted-foreground text-xs"
            >
              +{hiddenBadgeCount}
            </Badge>
          )}
        </div>
      ) : null}
    </DataGridCellWrapper>
  );
}

export function CheckboxCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isSelected,
}: CellVariantProps<TData>) {
  const initialValue = cell.getValue() as boolean;
  const [value, setValue] = React.useState(Boolean(initialValue));
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;

  const onCheckedChange = React.useCallback(
    (checked: boolean) => {
      setValue(checked);
      meta?.onDataUpdate?.({ rowIndex, columnId, value: checked });
    },
    [meta, rowIndex, columnId],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isFocused && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange(!value);
      }
    },
    [isFocused, value, onCheckedChange],
  );

  React.useEffect(() => {
    setValue(Boolean(initialValue));
  }, [initialValue]);

  React.useEffect(() => {
    if (
      isFocused &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, meta?.searchOpen, meta?.isScrolling]);

  const onWrapperClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isFocused) {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange(!value);
      }
    },
    [isFocused, value, onCheckedChange],
  );

  const onCheckboxClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const onCheckboxMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    [],
  );

  const onCheckboxDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={false}
      isFocused={isFocused}
      isSelected={isSelected}
      onClick={onWrapperClick}
      onKeyDown={onWrapperKeyDown}
      className="flex size-full justify-center"
    >
      <Checkbox
        checked={value}
        onCheckedChange={onCheckedChange}
        onClick={onCheckboxClick}
        onMouseDown={onCheckboxMouseDown}
        onDoubleClick={onCheckboxDoubleClick}
        className="border-primary"
      />
    </DataGridCellWrapper>
  );
}

function formatDateForDisplay(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

export function DateCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
}: CellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const [value, setValue] = React.useState(initialValue ?? "");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue ?? "");
  }

  const selectedDate = value ? new Date(value) : undefined;

  const onDateSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date) return;

      const formattedDate = date.toISOString().split("T")[0] ?? "";
      setValue(formattedDate);
      meta?.onDataUpdate?.({ rowIndex, columnId, value: formattedDate });
      setOpen(false);
      meta?.onCellEditingStop?.();
    },
    [meta, rowIndex, columnId],
  );

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen && isEditing) {
        meta?.onCellEditingStop?.();
      }
    },
    [isEditing, meta],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          setOpen(false);
        } else if (event.key === "Tab") {
          event.preventDefault();
          setOpen(false);
          meta?.onCellEditingStop?.({
            direction: event.shiftKey ? "left" : "right",
          });
        }
      }
    },
    [isEditing, initialValue, meta],
  );

  React.useEffect(() => {
    if (isEditing) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [isEditing]);

  React.useEffect(() => {
    if (
      isFocused &&
      !isEditing &&
      !meta?.searchOpen &&
      !meta?.isScrolling &&
      containerRef.current
    ) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, meta?.searchOpen, meta?.isScrolling]);

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isEditing={isEditing}
      isFocused={isFocused}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor asChild>
          <span data-slot="grid-cell-content">
            {formatDateForDisplay(value)}
          </span>
        </PopoverAnchor>
        {isEditing && (
          <PopoverContent
            data-grid-cell-editor=""
            align="start"
            sideOffset={10}
            className="w-auto p-0"
          >
            <Calendar
              autoFocus
              captionLayout="dropdown"
              mode="single"
              className="rounded-md border shadow-sm"
              defaultMonth={selectedDate ?? new Date()}
              selected={selectedDate}
              onSelect={onDateSelect}
            />
          </PopoverContent>
        )}
      </Popover>
    </DataGridCellWrapper>
  );
}
