"use client";

import type { Cell, Table } from "@tanstack/react-table";
import { Check } from "lucide-react";
import * as React from "react";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CellVariantProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  rowIndex: number;
  columnId: string;
  isFocused: boolean;
  isEditing: boolean;
  isSelected: boolean;
}

export function TextCell<TData>({
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
  const cellRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;
  const cellOpts = cell.column.columnDef.meta?.cell;
  const placeholder =
    cellOpts?.variant === "text" ? cellOpts.placeholder : undefined;

  const onBlur = React.useCallback(() => {
    if (cellRef.current) {
      const currentValue = cellRef.current.textContent ?? "";
      if (currentValue !== initialValue) {
        meta?.updateData?.(rowIndex, columnId, currentValue);
      }
      meta?.stopEditing?.();
    }
  }, [meta, rowIndex, columnId, initialValue]);

  const onInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const currentValue = event.currentTarget.textContent ?? "";
      setValue(currentValue);
    },
    [],
  );

  const onCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          cellRef.current?.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          if (cellRef.current) {
            cellRef.current.textContent = initialValue;
          }
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
    [isEditing, isFocused, initialValue],
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
  const showPlaceholder = !isEditing && !value && placeholder;

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onCellKeyDown={onCellKeyDown}
    >
      <div
        role="textbox"
        contentEditable={isEditing}
        tabIndex={-1}
        ref={cellRef}
        onBlur={onBlur}
        onInput={onInput}
        suppressContentEditableWarning
        className={cn("size-full truncate outline-none", {
          "cursor-text": isEditing,
          "text-muted-foreground": showPlaceholder,
        })}
      >
        {showPlaceholder ? placeholder : displayValue}
      </div>
    </DataGridCellWrapper>
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
  const placeholder =
    cellOpts?.variant === "number" ? cellOpts.placeholder : undefined;

  const onBlur = React.useCallback(() => {
    const numValue = value === "" ? null : Number(value);
    if (numValue !== initialValue) {
      meta?.updateData?.(rowIndex, columnId, numValue);
    }
    meta?.stopEditing?.();
  }, [meta, rowIndex, columnId, initialValue, value]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
    },
    [],
  );

  const onCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          inputRef.current?.blur();
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
    [isEditing, isFocused, initialValue],
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
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onCellKeyDown={onCellKeyDown}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          onChange={onChange}
          onBlur={onBlur}
          className="size-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span
          className={cn({ "text-muted-foreground": !value && placeholder })}
        >
          {value ?? placeholder}
        </span>
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
  const placeholder =
    cellOpts?.variant === "select" ? cellOpts.placeholder : undefined;

  const onValueChange = React.useCallback(
    (newValue: string) => {
      setValue(newValue);
      meta?.updateData?.(rowIndex, columnId, newValue);
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

  const onCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
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
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onCellKeyDown={onCellKeyDown}
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
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent data-cell-editor="">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span
          className={cn({ "text-muted-foreground": !value && placeholder })}
        >
          {displayLabel ?? placeholder}
        </span>
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

  const toggleValue = React.useCallback(() => {
    const newValue = !value;
    setValue(newValue);
    meta?.updateData?.(rowIndex, columnId, newValue);
  }, [value, meta, rowIndex, columnId]);

  const onCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (isFocused && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        event.stopPropagation();
        toggleValue();
      }
    },
    [isFocused, toggleValue],
  );

  React.useEffect(() => {
    setValue(Boolean(initialValue));
  }, [initialValue]);

  React.useEffect(() => {
    if (isFocused && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isFocused]);

  const onWrapperClickHandler = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      if (isFocused) {
        toggleValue();
      } else {
        meta?.onCellClick?.(rowIndex, columnId, event);
      }
    },
    [isFocused, meta, rowIndex, columnId, toggleValue],
  );

  return (
    <DataGridCellWrapper
      ref={containerRef}
      cell={cell}
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={false}
      isSelected={isSelected}
      onCellKeyDown={onCellKeyDown}
    >
      <div
        role="button"
        tabIndex={-1}
        className="flex size-full items-center justify-center"
        onClick={onWrapperClickHandler}
      >
        <div
          className={cn(
            "flex size-4 items-center justify-center rounded-sm border border-primary",
            {
              "bg-primary text-primary-foreground": value,
            },
          )}
        >
          {value && <Check className="size-3" />}
        </div>
      </div>
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
  const cellOpts = cell.column.columnDef.meta?.cell;
  const placeholder =
    cellOpts?.variant === "date" ? cellOpts.placeholder : undefined;

  const onBlur = React.useCallback(() => {
    if (value !== initialValue) {
      meta?.updateData?.(rowIndex, columnId, value);
    }
    meta?.stopEditing?.();
  }, [meta, rowIndex, columnId, initialValue, value]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
    },
    [],
  );

  const onCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          inputRef.current?.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          inputRef.current?.blur();
        }
      }
    },
    [isEditing, initialValue],
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
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onCellKeyDown={onCellKeyDown}
    >
      {isEditing ? (
        <input
          type="date"
          data-cell-editor=""
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          onBlur={onBlur}
          className="size-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span
          className={cn({ "text-muted-foreground": !value && placeholder })}
        >
          {formatDateForDisplay(value) ?? placeholder}
        </span>
      )}
    </DataGridCellWrapper>
  );
}
