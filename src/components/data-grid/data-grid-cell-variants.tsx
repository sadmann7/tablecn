"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Checkbox } from "@/components/ui/checkbox";
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
      meta?.updateData?.({ rowIndex, columnId, value: currentValue });
    }
    meta?.stopEditing?.();
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
            meta?.updateData?.({ rowIndex, columnId, value: currentValue });
          }
          meta?.stopEditing?.({ moveToNextRow: true });
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
    if (isFocused && !isEditing && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, value]);

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
        contentEditable={isEditing}
        tabIndex={-1}
        ref={cellRef}
        onBlur={onBlur}
        onInput={onInput}
        suppressContentEditableWarning
        className={cn(
          "size-full overflow-hidden whitespace-nowrap outline-none [&_*]:inline [&_*]:whitespace-nowrap [&_br]:hidden",
        )}
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

  // Debounced auto-save (300ms delay)
  const debouncedSave = useDebouncedCallback((newValue: string) => {
    meta?.updateData?.({ rowIndex, columnId, value: newValue });
  }, 300);

  const onSave = React.useCallback(() => {
    // Immediately save any pending changes and close the popover
    if (value !== initialValue) {
      meta?.updateData?.({ rowIndex, columnId, value });
    }
    setOpen(false);
    meta?.stopEditing?.();
  }, [meta, value, initialValue, rowIndex, columnId]);

  const onCancel = React.useCallback(() => {
    // Restore the original value
    setValue(initialValue ?? "");
    meta?.updateData?.({ rowIndex, columnId, value: initialValue });
    setOpen(false);
    meta?.stopEditing?.();
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
          meta?.updateData?.({ rowIndex, columnId, value });
        }
        meta?.stopEditing?.();
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
      if (isEditing && !open && event.key === "Escape") {
        event.preventDefault();
        meta?.stopEditing?.();
      }
    },
    [isEditing, open, meta],
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
      meta?.updateData?.({ rowIndex, columnId, value });
    }
    setOpen(false);
    meta?.stopEditing?.();
  }, [meta, value, initialValue, rowIndex, columnId]);

  React.useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  React.useEffect(() => {
    if (isEditing && !open) {
      setOpen(true);
    }
    if (isFocused && !isEditing && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, open]);

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
          {value}
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
        <div className="flex flex-col">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onKeyDown={onTextareaKeyDown}
            onBlur={onTextareaBlur}
            className="min-h-[150px] resize-none rounded-none border-0 shadow-none focus-visible:ring-0"
            placeholder="Enter text..."
          />
          <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-3 py-2">
            <div className="text-muted-foreground text-xs">
              Ctrl/Cmd+Enter to save • Esc to cancel
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md px-3 py-1 font-medium text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
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
      meta?.updateData?.({ rowIndex, columnId, value: numValue });
    }
    meta?.stopEditing?.();
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
            meta?.updateData?.({ rowIndex, columnId, value: numValue });
          }
          meta?.stopEditing?.({ moveToNextRow: true });
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
    if (isFocused && !isEditing && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing]);

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
          onChange={onChange}
          onBlur={onBlur}
          className="size-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span>{value}</span>
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
      meta?.updateData?.({ rowIndex, columnId, value: newValue });
      meta?.stopEditing?.();
    },
    [meta, rowIndex, columnId],
  );

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        meta?.stopEditing?.();
      }
    },
    [meta],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing && event.key === "Escape") {
        event.preventDefault();
        setValue(initialValue);
        setOpen(false);
        meta?.stopEditing?.();
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
    if (isFocused && !isEditing && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing, open]);

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
          <SelectContent data-grid-cell-editor="">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span>{displayLabel}</span>
      )}
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
      meta?.updateData?.({ rowIndex, columnId, value: checked });
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
    if (isFocused && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused]);

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
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;

  const onBlur = React.useCallback(() => {
    if (value !== initialValue) {
      meta?.updateData?.({ rowIndex, columnId, value });
    }
    meta?.stopEditing?.();
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
          if (value !== initialValue) {
            meta?.updateData?.({ rowIndex, columnId, value });
          }
          meta?.stopEditing?.({ moveToNextRow: true });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          inputRef.current?.blur();
        }
      }
    },
    [isEditing, initialValue, meta, rowIndex, columnId, value],
  );

  React.useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
    if (isFocused && !isEditing && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused, isEditing]);

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
          type="date"
          data-grid-cell-editor=""
          ref={inputRef}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className="size-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span>{formatDateForDisplay(value)}</span>
      )}
    </DataGridCellWrapper>
  );
}
