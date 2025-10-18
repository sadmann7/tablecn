"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";
import { DataGridCellWrapper } from "@/components/data-grid/data-grid-cell-wrapper";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import { cn } from "@/lib/utils";

interface CellState {
  value: unknown;
  open: boolean;
}

interface CellStore {
  subscribe: (callback: () => void) => () => void;
  getState: () => CellState;
  setState: <K extends keyof CellState>(key: K, value: CellState[K]) => void;
  notify: () => void;
}

function createCellStore(
  listenersRef: React.RefObject<Set<() => void>>,
  stateRef: React.RefObject<CellState>,
): CellStore {
  const store: CellStore = {
    subscribe: (callback) => {
      listenersRef.current.add(callback);
      return () => listenersRef.current.delete(callback);
    },
    getState: () => stateRef.current,
    setState: (key, value) => {
      if (Object.is(stateRef.current[key], value)) return;
      stateRef.current[key] = value;
      store.notify();
    },
    notify: () => {
      for (const cb of listenersRef.current) {
        cb();
      }
    },
  };

  return store;
}

function useCellStore<T = CellState>(
  store: CellStore,
  selector?: (state: CellState) => T,
): T {
  const getSnapshot = React.useCallback(
    () => (selector ? selector(store.getState()) : store.getState()) as T,
    [store, selector],
  );

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface DataGridCellVariantProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  rowIndex: number;
  columnId: string;
  isFocused: boolean;
  isEditing: boolean;
  isSelected: boolean;
}

export function ShortTextCell<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
}: DataGridCellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const listenersRef = useLazyRef(() => new Set<() => void>());
  const stateRef = useLazyRef<CellState>(() => ({
    value: initialValue,
    open: false,
  }));

  const store = React.useMemo(
    () => createCellStore(listenersRef, stateRef),
    [listenersRef, stateRef],
  );

  const value = useCellStore(store, (state) => state.value);

  const cellRef = React.useRef<HTMLDivElement>(null);
  const meta = table.options.meta;

  const onBlur = React.useCallback(() => {
    const currentValue = cellRef.current?.textContent ?? "";
    if (currentValue !== initialValue) {
      meta?.updateData?.({ rowIndex, columnId, value: currentValue });
    }
    meta?.stopEditing?.();
  }, [meta, rowIndex, columnId, initialValue]);

  const onInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const currentValue = event.currentTarget.textContent ?? "";
      store.setState("value", currentValue);
    },
    [store],
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
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            meta?.updateData?.({ rowIndex, columnId, value: currentValue });
          }
          cellRef.current?.blur();
        }
      } else if (
        isFocused &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        store.setState("value", event.key);

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
    [isEditing, isFocused, initialValue, meta, rowIndex, columnId, store],
  );

  React.useEffect(() => {
    store.setState("value", initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue;
    }
  }, [initialValue, isEditing, store]);

  React.useEffect(() => {
    if (isEditing && cellRef.current) {
      cellRef.current.focus();

      if (!cellRef.current.textContent && value) {
        cellRef.current.textContent = value as string;
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
  }, [isEditing, value]);

  const displayValue = !isEditing ? ((value as string) ?? "") : "";

  return (
    <DataGridCellWrapper
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={isEditing}
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
        className={cn("size-full truncate outline-none", {
          "cursor-text": isEditing,
        })}
      >
        {displayValue}
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
}: DataGridCellVariantProps<TData>) {
  const initialValue = cell.getValue() as number;
  const listenersRef = useLazyRef(() => new Set<() => void>());
  const stateRef = useLazyRef<CellState>(() => ({
    value: String(initialValue ?? ""),
    open: false,
  }));

  const store = React.useMemo(
    () => createCellStore(listenersRef, stateRef),
    [listenersRef, stateRef],
  );

  const value = useCellStore(store, (state) => state.value);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const meta = table.options.meta;
  const cellOpts = cell.column.columnDef.meta?.cell;
  const min = cellOpts?.variant === "number" ? cellOpts.min : undefined;
  const max = cellOpts?.variant === "number" ? cellOpts.max : undefined;
  const step = cellOpts?.variant === "number" ? cellOpts.step : undefined;

  const onBlur = React.useCallback(() => {
    const valueStr = value as string;
    const numValue = valueStr === "" ? null : Number(valueStr);
    if (numValue !== initialValue) {
      meta?.updateData?.({ rowIndex, columnId, value: numValue });
    }
    meta?.stopEditing?.();
  }, [meta, rowIndex, columnId, initialValue, value]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      store.setState("value", event.target.value);
    },
    [store],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          const valueStr = value as string;
          const numValue = valueStr === "" ? null : Number(valueStr);
          if (numValue !== initialValue) {
            meta?.updateData?.({ rowIndex, columnId, value: numValue });
          }
          meta?.stopEditing?.({ moveToNextRow: true });
        } else if (event.key === "Escape") {
          event.preventDefault();
          const valueStr = value as string;
          const numValue = valueStr === "" ? null : Number(valueStr);
          if (numValue !== initialValue) {
            meta?.updateData?.({ rowIndex, columnId, value: numValue });
          }
          inputRef.current?.blur();
        }
      } else if (isFocused) {
        if (event.key === "Backspace") {
          store.setState("value", "");
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          store.setState("value", event.key);
        }
      }
    },
    [
      isEditing,
      isFocused,
      initialValue,
      meta,
      rowIndex,
      columnId,
      value,
      store,
    ],
  );

  React.useEffect(() => {
    store.setState("value", String(initialValue ?? ""));
  }, [initialValue, store]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <DataGridCellWrapper
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={value as string}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          onBlur={onBlur}
          className="size-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span>{value as string}</span>
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
}: DataGridCellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const listenersRef = useLazyRef(() => new Set<() => void>());
  const stateRef = useLazyRef<CellState>(() => ({
    value: initialValue,
    open: false,
  }));

  const store = React.useMemo(
    () => createCellStore(listenersRef, stateRef),
    [listenersRef, stateRef],
  );

  const value = useCellStore(store, (state) => state.value);
  const open = useCellStore(store, (state) => state.open);

  const meta = table.options.meta;
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = cellOpts?.variant === "select" ? cellOpts.options : [];

  const onValueChange = React.useCallback(
    (newValue: string) => {
      store.setState("value", newValue);
      meta?.updateData?.({ rowIndex, columnId, value: newValue });
      meta?.stopEditing?.();
    },
    [meta, rowIndex, columnId, store],
  );

  const onOpenChange = React.useCallback(
    (isOpen: boolean) => {
      store.setState("open", isOpen);
      if (!isOpen) {
        meta?.stopEditing?.();
      }
    },
    [meta, store],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing && event.key === "Escape") {
        event.preventDefault();
        store.setState("open", false);
        meta?.stopEditing?.();
      }
    },
    [isEditing, meta, store],
  );

  React.useEffect(() => {
    store.setState("value", initialValue);
  }, [initialValue, store]);

  React.useEffect(() => {
    if (isEditing && !open) {
      store.setState("open", true);
    }
  }, [isEditing, open, store]);

  const displayLabel =
    options.find((opt) => opt.value === value)?.label ?? (value as string);

  return (
    <DataGridCellWrapper
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Select
          value={value as string}
          onValueChange={onValueChange}
          open={open as boolean}
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
}: DataGridCellVariantProps<TData>) {
  const initialValue = cell.getValue() as boolean;
  const listenersRef = useLazyRef(() => new Set<() => void>());
  const stateRef = useLazyRef<CellState>(() => ({
    value: Boolean(initialValue),
    open: false,
  }));

  const store = React.useMemo(
    () => createCellStore(listenersRef, stateRef),
    [listenersRef, stateRef],
  );

  const value = useCellStore(store, (state) => state.value);

  const meta = table.options.meta;

  const onCheckedChange = React.useCallback(
    (checked: boolean) => {
      store.setState("value", checked);
      meta?.updateData?.({ rowIndex, columnId, value: checked });
    },
    [meta, rowIndex, columnId, store],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isFocused && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange(!(value as boolean));
      }
    },
    [isFocused, value, onCheckedChange],
  );

  React.useEffect(() => {
    store.setState("value", Boolean(initialValue));
  }, [initialValue, store]);

  const onWrapperClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isFocused) {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange(!(value as boolean));
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
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={false}
      isSelected={isSelected}
      onClick={onWrapperClick}
      onKeyDown={onWrapperKeyDown}
      className="flex size-full items-center justify-center"
    >
      <Checkbox
        checked={value as boolean}
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
}: DataGridCellVariantProps<TData>) {
  const initialValue = cell.getValue() as string;
  const listenersRef = useLazyRef(() => new Set<() => void>());
  const stateRef = useLazyRef<CellState>(() => ({
    value: initialValue ?? "",
    open: false,
  }));

  const store = React.useMemo(
    () => createCellStore(listenersRef, stateRef),
    [listenersRef, stateRef],
  );

  const value = useCellStore(store, (state) => state.value);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const meta = table.options.meta;

  const onBlur = React.useCallback(() => {
    const valueStr = value as string;
    if (valueStr !== initialValue) {
      meta?.updateData?.({ rowIndex, columnId, value: valueStr });
    }
    meta?.stopEditing?.();
  }, [meta, rowIndex, columnId, initialValue, value]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      store.setState("value", event.target.value);
    },
    [store],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          const valueStr = value as string;
          if (valueStr !== initialValue) {
            meta?.updateData?.({ rowIndex, columnId, value: valueStr });
          }
          meta?.stopEditing?.({ moveToNextRow: true });
        } else if (event.key === "Escape") {
          event.preventDefault();
          const valueStr = value as string;
          if (valueStr !== initialValue) {
            meta?.updateData?.({ rowIndex, columnId, value: valueStr });
          }
          inputRef.current?.blur();
        }
      }
    },
    [isEditing, initialValue, meta, rowIndex, columnId, value],
  );

  React.useEffect(() => {
    store.setState("value", initialValue ?? "");
  }, [initialValue, store]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  return (
    <DataGridCellWrapper
      table={table}
      rowIndex={rowIndex}
      columnId={columnId}
      isFocused={isFocused}
      isEditing={isEditing}
      isSelected={isSelected}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <input
          type="date"
          data-grid-cell-editor=""
          ref={inputRef}
          value={value as string}
          onChange={onChange}
          onBlur={onBlur}
          className="size-full border-none bg-transparent p-0 outline-none"
        />
      ) : (
        <span>{formatDateForDisplay(value as string)}</span>
      )}
    </DataGridCellWrapper>
  );
}
