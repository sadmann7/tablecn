"use client";

import type { RowData } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";
import { toast } from "sonner";

import type { DataGridCellProps, FileCellData } from "@/lib/data-grid-types";

import { useBadgeOverflow } from "@/hooks/use-badge-overflow";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  formatDateForDisplay,
  formatDateToString,
  formatFileSize,
  getBooleanCellValue,
  getCellKey,
  getDateCellValue,
  getFileIcon,
  getFilesCellValue,
  getLineCount,
  getNumberCellValue,
  getOptionCellValue,
  getOptionsCellValue,
  getTextCellValue,
  getUrlHref,
  insertTextAtSelection,
  parseLocalDate,
  replaceEditableText,
} from "@/lib/data-grid-utils";
import { DataGridCellWrapper } from "@/registry/bases/base/components/data-grid/data-grid-cell-wrapper";
import { Badge } from "@/registry/bases/base/ui/badge";
import { Button } from "@/registry/bases/base/ui/button";
import { Checkbox } from "@/registry/bases/base/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/registry/bases/base/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Skeleton } from "@/registry/bases/base/ui/skeleton";
import { Textarea } from "@/registry/bases/base/ui/textarea";
import { Calendar } from "@/registry/bases/radix/ui/calendar";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

export function ShortTextCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, isFocused, readOnly } = props;
  const initialValue = getTextCellValue(cell.getValue());
  const [value, setValue] = React.useState(initialValue);
  const cellRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevIsEditingRef = React.useRef(false);
  const pendingCharRef = React.useRef<string | null>(null);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue;
    }
  }

  const onBlur = React.useCallback(() => {
    // Read the current value directly from the DOM to avoid stale state
    const currentValue = cellRef.current?.textContent ?? "";
    if (!readOnly && currentValue !== initialValue) {
      cell.setValue(currentValue);
    }
    cell.table.stopEditing();
  }, [cell, initialValue, readOnly]);

  const onInput = React.useCallback(
    (event: React.InputEvent<HTMLDivElement>) => {
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
            cell.setValue(currentValue);
          }
          cell.table.stopEditing({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent ?? "";
          if (currentValue !== initialValue) {
            cell.setValue(currentValue);
          }
          cell.table.stopEditing({
            direction: event.shiftKey ? "shift+tab" : "tab",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          cellRef.current?.blur();
        }
      } else if (
        isFocused &&
        !readOnly &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        pendingCharRef.current = event.key;
      }
    },
    [cell, isEditing, isFocused, initialValue, readOnly],
  );

  React.useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;

    if (isEditing && !wasEditing && cellRef.current) {
      cellRef.current.focus();

      if (!cellRef.current.textContent && value) {
        cellRef.current.textContent = value;
      }

      const pendingChar = pendingCharRef.current;
      pendingCharRef.current = null;
      if (pendingChar) {
        replaceEditableText(cellRef.current, pendingChar);
      } else if (cellRef.current.textContent) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(cellRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isEditing, value]);

  const displayValue = !isEditing ? (value ?? "") : "";

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
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
          "whitespace-nowrap **:inline **:whitespace-nowrap [&_br]:hidden":
            isEditing,
        })}
      >
        {displayValue}
      </div>
    </DataGridCellWrapper>
  );
}

export function LongTextCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, isFocused, readOnly } = props;
  const initialValue = getTextCellValue(cell.getValue());
  const [value, setValue] = React.useState(initialValue);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pendingCharRef = React.useRef<string | null>(null);
  const sideOffset = -(containerRef.current?.clientHeight ?? 0);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
  }

  const debouncedSave = useDebouncedCallback((newValue: string) => {
    if (!readOnly) {
      cell.setValue(newValue);
    }
  }, 300);

  const onSave = React.useCallback(() => {
    if (!readOnly && value !== initialValue) {
      cell.setValue(value);
    }
    cell.table.stopEditing();
  }, [cell, value, initialValue, readOnly]);

  const onCancel = React.useCallback(() => {
    setValue(initialValue);
    if (!readOnly) {
      cell.setValue(initialValue);
    }
    cell.table.stopEditing();
  }, [cell, initialValue, readOnly]);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && !readOnly) {
        cell.startEditing();
      } else {
        if (!readOnly && value !== initialValue) {
          cell.setValue(value);
        }
        cell.table.stopEditing();
      }
    },
    [cell, value, initialValue, readOnly],
  );

  const onInitialFocus = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return false;

    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);

    // Insert the typed character after focus settles
    if (pendingCharRef.current) {
      const char = pendingCharRef.current;
      pendingCharRef.current = null;
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea && document.activeElement === textarea) {
          insertTextAtSelection(textarea, char);
          textarea.scrollTop = textarea.scrollHeight;
        }
      });
    } else {
      textarea.scrollTop = textarea.scrollHeight;
    }

    return false;
  }, []);

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        isFocused &&
        !isEditing &&
        !readOnly &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        pendingCharRef.current = event.key;
      }
    },
    [isFocused, isEditing, readOnly],
  );

  const onBlur = React.useCallback(() => {
    if (!readOnly && value !== initialValue) {
      cell.setValue(value);
    }
    cell.table.stopEditing();
  }, [cell, value, initialValue, readOnly]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setValue(newValue);
      debouncedSave(newValue);
    },
    [debouncedSave],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSave();
      } else if (event.key === "Tab") {
        event.preventDefault();
        if (value !== initialValue) {
          cell.setValue(value);
        }
        cell.table.stopEditing({
          direction: event.shiftKey ? "shift+tab" : "tab",
        });
        return;
      }
      // Stop propagation to prevent grid navigation
      event.stopPropagation();
    },
    [cell, onSave, onCancel, value, initialValue],
  );

  return (
    <Popover open={isEditing} onOpenChange={onOpenChange}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <DataGridCellWrapper<TData>
            {...props}
            ref={containerRef}
            onKeyDown={onWrapperKeyDown}
          />
        }
      >
        <span data-slot="grid-cell-content">{value}</span>
      </PopoverTrigger>
      <PopoverContent
        data-grid-cell-editor=""
        align="start"
        side="bottom"
        sideOffset={sideOffset}
        className="w-100 rounded-none p-0"
        initialFocus={onInitialFocus}
      >
        <Textarea
          placeholder="Enter text..."
          className="max-h-75 min-h-37.5 resize-none overflow-y-auto rounded-none border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
          ref={textareaRef}
          value={value}
          onBlur={onBlur}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
      </PopoverContent>
    </Popover>
  );
}

export function NumberCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, isFocused, readOnly } = props;
  const initialValue = getNumberCellValue(cell.getValue());
  const [value, setValue] = React.useState(String(initialValue ?? ""));
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const cellOpts = cell.column.columnDef.meta?.cell;
  const numberCellOpts = cellOpts?.variant === "number" ? cellOpts : null;
  const min = numberCellOpts?.min;
  const max = numberCellOpts?.max;
  const step = numberCellOpts?.step;

  const prevIsEditingRef = React.useRef(false);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(String(initialValue ?? ""));
  }

  const onBlur = React.useCallback(() => {
    const numValue = value === "" ? null : Number(value);
    if (!readOnly && numValue !== initialValue) {
      cell.setValue(numValue);
    }
    cell.table.stopEditing();
  }, [cell, initialValue, value, readOnly]);

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
            cell.setValue(numValue);
          }
          cell.table.stopEditing({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const numValue = value === "" ? null : Number(value);
          if (numValue !== initialValue) {
            cell.setValue(numValue);
          }
          cell.table.stopEditing({
            direction: event.shiftKey ? "shift+tab" : "tab",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(String(initialValue ?? ""));
          inputRef.current?.blur();
        }
      } else if (isFocused) {
        if (event.key === "Backspace") {
          setValue("");
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setValue(event.key);
        }
      }
    },
    [cell, isEditing, isFocused, initialValue, value],
  );

  React.useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;

    if (isEditing && !wasEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <input
          type="number"
          ref={inputRef}
          value={value}
          min={min}
          max={max}
          step={step}
          className="w-full [appearance:textfield] border-none bg-transparent p-0 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onBlur={onBlur}
          onChange={onChange}
        />
      ) : (
        <span data-slot="grid-cell-content">{value}</span>
      )}
    </DataGridCellWrapper>
  );
}

export function UrlCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, isFocused, readOnly } = props;
  const initialValue = getTextCellValue(cell.getValue());
  const [value, setValue] = React.useState(initialValue);
  const cellRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevIsEditingRef = React.useRef(false);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue;
    }
  }

  const onBlur = React.useCallback(() => {
    const currentValue = cellRef.current?.textContent?.trim() ?? "";

    if (!readOnly && currentValue !== initialValue) {
      cell.setValue(currentValue || null);
    }
    cell.table.stopEditing();
  }, [cell, initialValue, readOnly]);

  const onInput = React.useCallback(
    (event: React.InputEvent<HTMLDivElement>) => {
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
          const currentValue = cellRef.current?.textContent?.trim() ?? "";
          if (!readOnly && currentValue !== initialValue) {
            cell.setValue(currentValue || null);
          }
          cell.table.stopEditing({ moveToNextRow: true });
        } else if (event.key === "Tab") {
          event.preventDefault();
          const currentValue = cellRef.current?.textContent?.trim() ?? "";
          if (!readOnly && currentValue !== initialValue) {
            cell.setValue(currentValue || null);
          }
          cell.table.stopEditing({
            direction: event.shiftKey ? "shift+tab" : "tab",
          });
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          cellRef.current?.blur();
        }
      } else if (
        isFocused &&
        event.key === "Enter" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        if (!value) return;
        const href = getUrlHref(value);
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        } else {
          toastDangerousUrl();
        }
      } else if (
        isFocused &&
        !readOnly &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
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
    [cell, isEditing, isFocused, initialValue, value, readOnly],
  );

  const onLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (isEditing) {
        event.preventDefault();
        return;
      }

      // Check if URL was rejected due to dangerous protocol
      const href = getUrlHref(value);
      if (!href) {
        event.preventDefault();
        toastDangerousUrl();
        return;
      }

      // Stop propagation to prevent grid from interfering with link navigation
      event.stopPropagation();
    },
    [isEditing, value],
  );

  React.useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;

    if (isEditing && !wasEditing && cellRef.current) {
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
  }, [isEditing, value]);

  const displayValue = !isEditing ? (value ?? "") : "";
  const urlHref = displayValue ? getUrlHref(displayValue) : "";
  const isDangerousUrl = displayValue && !urlHref;

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onWrapperKeyDown}
    >
      {!isEditing && displayValue ? (
        <div
          data-slot="grid-cell-content"
          className="size-full overflow-hidden"
        >
          <a
            tabIndex={-1}
            data-focused={isFocused && !isDangerousUrl ? "" : undefined}
            data-invalid={isDangerousUrl ? "" : undefined}
            href={urlHref}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary/60 data-focused:text-foreground data-focused:decoration-foreground/50 data-focused:hover:decoration-foreground/70 data-invalid:cursor-not-allowed data-invalid:text-destructive data-invalid:decoration-destructive/50 data-invalid:hover:decoration-destructive/70"
            onClick={onLinkClick}
          >
            {displayValue}
          </a>
        </div>
      ) : (
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
            "whitespace-nowrap **:inline **:whitespace-nowrap [&_br]:hidden":
              isEditing,
          })}
        >
          {displayValue}
        </div>
      )}
    </DataGridCellWrapper>
  );
}

export function CheckboxCell<TData extends RowData>(
  props: Omit<DataGridCellProps<TData>, "isEditing">,
) {
  const { cell, isFocused, readOnly } = props;
  const initialValue = getBooleanCellValue(cell.getValue());
  const [value, setValue] = React.useState(initialValue);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
  }

  const onCheckedChange = React.useCallback(
    (checked: boolean) => {
      if (readOnly) return;
      setValue(checked);
      cell.setValue(checked);
    },
    [cell, readOnly],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        isFocused &&
        !readOnly &&
        (event.key === " " || event.key === "Enter")
      ) {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange(!value);
      }
    },
    [isFocused, value, onCheckedChange, readOnly],
  );

  const onWrapperClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (isFocused && !readOnly) {
        event.preventDefault();
        event.stopPropagation();
        onCheckedChange(!value);
      }
    },
    [isFocused, value, onCheckedChange, readOnly],
  );

  const onCheckboxClick = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const onCheckboxMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
    },
    [],
  );

  const onCheckboxDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      isEditing={false}
      className="flex size-full justify-center"
      onClick={onWrapperClick}
      onKeyDown={onWrapperKeyDown}
    >
      <Checkbox
        tabIndex={-1}
        checked={value}
        onCheckedChange={onCheckedChange}
        disabled={readOnly}
        className="border-primary"
        onClick={onCheckboxClick}
        onMouseDown={onCheckboxMouseDown}
        onDoubleClick={onCheckboxDoubleClick}
      />
    </DataGridCellWrapper>
  );
}

export function SelectCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, readOnly } = props;
  const initialValue = getOptionCellValue(cell.getValue());

  const [value, setValue] = React.useState(initialValue);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = React.useMemo(
    () => (cellOpts?.variant === "select" ? cellOpts.options : []),
    [cellOpts],
  );
  const optionByValue = React.useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
  }

  const onValueChange = React.useCallback(
    (newValue: string | null) => {
      if (newValue == null || readOnly) return;
      setValue(newValue);
      cell.setValue(newValue);
      cell.table.stopEditing();
    },
    [cell, readOnly],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && !readOnly) {
        cell.startEditing();
      } else {
        cell.table.stopEditing();
      }
    },
    [cell, readOnly],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing && event.key === "Escape") {
        event.preventDefault();
        setValue(initialValue);
        cell.table.stopEditing();
      } else if (isEditing && event.key === "Tab") {
        event.preventDefault();
        cell.table.stopEditing({
          direction: event.shiftKey ? "shift+tab" : "tab",
        });
      }
    },
    [cell, isEditing, initialValue],
  );

  const displayLabel = value
    ? (optionByValue.get(value)?.label ?? value)
    : null;

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Select
          value={value}
          onValueChange={onValueChange}
          open={isEditing}
          onOpenChange={onOpenChange}
        >
          <SelectTrigger className="size-full items-start border-none p-0 shadow-none focus-visible:ring-0 dark:bg-transparent [&_svg]:hidden">
            {displayLabel ? (
              <Badge
                variant="secondary"
                className="px-1.5 py-px whitespace-pre-wrap"
              >
                <SelectValue />
              </Badge>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent
            data-grid-cell-editor=""
            // compensate for the wrapper padding
            align="start"
            alignOffset={-8}
            sideOffset={-8}
            className="min-w-[calc(var(--anchor-width)+16px)]"
          >
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : displayLabel ? (
        <Badge
          data-slot="grid-cell-content"
          variant="secondary"
          className="px-1.5 py-px whitespace-pre-wrap"
        >
          {displayLabel}
        </Badge>
      ) : null}
    </DataGridCellWrapper>
  );
}

export function MultiSelectCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, rowHeight, isEditing, readOnly } = props;
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const cellValue = React.useMemo(() => {
    return getOptionsCellValue(cell.getValue());
  }, [cell]);

  const cellKey = getCellKey(rowId, columnId);
  const prevCellKeyRef = React.useRef(cellKey);

  const [selectedValues, setSelectedValues] =
    React.useState<string[]>(cellValue);
  const [searchValue, setSearchValue] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = React.useMemo(
    () => (cellOpts?.variant === "multi-select" ? cellOpts.options : []),
    [cellOpts],
  );
  const optionByValue = React.useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );
  const sideOffset = -(containerRef.current?.clientHeight ?? 0);

  const prevCellValueRef = React.useRef(cellValue);
  if (cellValue !== prevCellValueRef.current) {
    prevCellValueRef.current = cellValue;
    setSelectedValues(cellValue);
  }

  if (prevCellKeyRef.current !== cellKey) {
    prevCellKeyRef.current = cellKey;
    setSearchValue("");
  }

  const onValueChange = React.useCallback(
    (value: string) => {
      if (readOnly) return;
      let newValues: string[] = [];
      setSelectedValues((curr) => {
        newValues = curr.includes(value)
          ? curr.filter((v) => v !== value)
          : [...curr, value];
        return newValues;
      });
      queueMicrotask(() => {
        cell.setValue(newValues);
        inputRef.current?.focus();
      });
      setSearchValue("");
    },
    [cell, readOnly],
  );

  const removeValue = React.useCallback(
    (valueToRemove: string, event?: React.MouseEvent) => {
      if (readOnly) return;
      event?.stopPropagation();
      event?.preventDefault();
      let newValues: string[] = [];
      setSelectedValues((curr) => {
        newValues = curr.filter((v) => v !== valueToRemove);
        return newValues;
      });
      queueMicrotask(() => {
        cell.setValue(newValues);
        inputRef.current?.focus();
      });
    },
    [cell, readOnly],
  );

  const clearAll = React.useCallback(() => {
    if (readOnly) return;
    setSelectedValues([]);
    cell.setValue([]);
    queueMicrotask(() => inputRef.current?.focus());
  }, [cell, readOnly]);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && !readOnly) {
        cell.startEditing();
      } else {
        setSearchValue("");
        cell.table.stopEditing();
      }
    },
    [cell, readOnly],
  );

  const onInitialFocus = React.useCallback(() => {
    inputRef.current?.focus();
    return false;
  }, []);

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing && event.key === "Escape") {
        event.preventDefault();
        setSelectedValues(cellValue);
        setSearchValue("");
        cell.table.stopEditing();
      } else if (isEditing && event.key === "Tab") {
        event.preventDefault();
        setSearchValue("");
        cell.table.stopEditing({
          direction: event.shiftKey ? "shift+tab" : "tab",
        });
      }
    },
    [cell, isEditing, cellValue],
  );

  const onInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && searchValue === "") {
        event.preventDefault();
        let newValues: string[] | null = null;
        setSelectedValues((curr) => {
          if (curr.length === 0) return curr;
          newValues = curr.slice(0, -1);
          return newValues;
        });
        queueMicrotask(() => {
          if (newValues !== null) {
            cell.setValue(newValues);
          }
          inputRef.current?.focus();
        });
      }
      if (event.key === "Escape") {
        event.stopPropagation();
      }
    },
    [searchValue, cell],
  );

  const displayLabels = selectedValues
    .map((val) => optionByValue.get(val)?.label ?? val)
    .filter(Boolean);

  const selectedValuesSet = React.useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );

  const lineCount = getLineCount(rowHeight);

  const { visibleItems: visibleLabels, hiddenCount: hiddenBadgeCount } =
    useBadgeOverflow({
      items: displayLabels,
      getLabel: (label) => label,
      containerRef,
      lineCount,
    });

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Popover open={isEditing} onOpenChange={onOpenChange}>
          <PopoverTrigger
            nativeButton={false}
            render={<div className="pointer-events-none absolute inset-0" />}
          />
          <PopoverContent
            data-grid-cell-editor=""
            align="start"
            sideOffset={sideOffset}
            className="w-75 rounded-none p-0"
            initialFocus={onInitialFocus}
          >
            <Command className="**:data-[slot=command-input-wrapper]:min-w-16 **:data-[slot=command-input-wrapper]:flex-1 **:data-[slot=command-input-wrapper]:p-0 **:data-[slot=input-group]:h-auto! **:data-[slot=input-group]:rounded-none! **:data-[slot=input-group]:border-none **:data-[slot=input-group]:bg-transparent **:data-[slot=input-group-addon]:hidden **:data-[slot=input-group]:dark:bg-transparent">
              <div className="flex min-h-9 flex-wrap items-center gap-1 border-b px-3 py-1.5">
                {selectedValues.map((value) => {
                  const label = optionByValue.get(value)?.label ?? value;

                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="gap-1 px-1.5 py-px"
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
                        <IconPlaceholder
                          lucide="X"
                          tabler="IconX"
                          hugeicons="Cancel01Icon"
                          phosphor="XIcon"
                          remixicon="RiCloseLine"
                          className="size-3"
                        />
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
                  className="p-0! placeholder:text-muted-foreground"
                />
              </div>
              <CommandList className="max-h-full">
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
                  {options.map((option) => {
                    const isSelected = selectedValuesSet.has(option.value);

                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => onValueChange(option.value)}
                        data-checked={isSelected}
                      >
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
              className="px-1.5 py-px"
            >
              {label}
            </Badge>
          ))}
          {hiddenBadgeCount > 0 && (
            <Badge
              variant="outline"
              className="px-1.5 py-px text-muted-foreground"
            >
              +{hiddenBadgeCount}
            </Badge>
          )}
        </div>
      ) : null}
    </DataGridCellWrapper>
  );
}

export function DateCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, readOnly } = props;
  const initialValue = getDateCellValue(cell.getValue());
  const [value, setValue] = React.useState(initialValue);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const prevInitialValueRef = React.useRef(initialValue);
  if (initialValue !== prevInitialValueRef.current) {
    prevInitialValueRef.current = initialValue;
    setValue(initialValue);
  }

  // Parse date as local time to avoid timezone shifts
  const selectedDate = value ? (parseLocalDate(value) ?? undefined) : undefined;

  const onDateSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date || readOnly) return;

      // Format using local date components to avoid timezone issues
      const formattedDate = formatDateToString(date);
      setValue(formattedDate);
      cell.setValue(formattedDate);
      cell.table.stopEditing();
    },
    [cell, readOnly],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && !readOnly) {
        cell.startEditing();
      } else {
        cell.table.stopEditing();
      }
    },
    [cell, readOnly],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing && event.key === "Escape") {
        event.preventDefault();
        setValue(initialValue);
        cell.table.stopEditing();
      } else if (isEditing && event.key === "Tab") {
        event.preventDefault();
        cell.table.stopEditing({
          direction: event.shiftKey ? "shift+tab" : "tab",
        });
      }
    },
    [cell, isEditing, initialValue],
  );

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onWrapperKeyDown}
    >
      <Popover open={isEditing} onOpenChange={onOpenChange}>
        <PopoverTrigger
          nativeButton={false}
          render={<span data-slot="grid-cell-content" />}
        >
          {formatDateForDisplay(value)}
        </PopoverTrigger>
        {isEditing && (
          <PopoverContent
            data-grid-cell-editor=""
            align="start"
            alignOffset={-8}
            className="w-auto p-0"
          >
            <Calendar
              autoFocus
              captionLayout="dropdown"
              mode="single"
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

export function FileCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, rowHeight, isEditing, isFocused, readOnly } = props;
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const cellValue = React.useMemo(
    () => getFilesCellValue(cell.getValue()),
    [cell],
  );

  const cellKey = getCellKey(rowId, columnId);
  const prevCellKeyRef = React.useRef(cellKey);

  const labelId = React.useId();
  const descriptionId = React.useId();

  const [files, setFiles] = React.useState<FileCellData[]>(cellValue);
  const [uploadingFiles, setUploadingFiles] = React.useState<Set<string>>(
    new Set(),
  );
  const [deletingFiles, setDeletingFiles] = React.useState<Set<string>>(
    new Set(),
  );
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isUploading = uploadingFiles.size > 0;
  const isDeleting = deletingFiles.size > 0;
  const isPending = isUploading || isDeleting;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropzoneRef = React.useRef<HTMLDivElement>(null);
  const cellOpts = cell.column.columnDef.meta?.cell;
  const sideOffset = -(containerRef.current?.clientHeight ?? 0);

  const fileCellOpts = cellOpts?.variant === "file" ? cellOpts : null;
  const maxFileSize = fileCellOpts?.maxFileSize ?? 10 * 1024 * 1024;
  const maxFiles = fileCellOpts?.maxFiles ?? 10;
  const accept = fileCellOpts?.accept;
  const multiple = fileCellOpts?.multiple ?? false;

  const acceptedTypes = React.useMemo(
    () => (accept ? accept.split(",").map((t) => t.trim()) : null),
    [accept],
  );

  const prevCellValueRef = React.useRef(cellValue);
  if (cellValue !== prevCellValueRef.current) {
    prevCellValueRef.current = cellValue;
    for (const file of files) {
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }
    }
    setFiles(cellValue);
    setError(null);
  }

  if (prevCellKeyRef.current !== cellKey) {
    prevCellKeyRef.current = cellKey;
    setError(null);
  }

  const validateFile = React.useCallback(
    (file: File): string | null => {
      if (maxFileSize && file.size > maxFileSize) {
        return `File size exceeds ${formatFileSize(maxFileSize)}`;
      }
      if (acceptedTypes) {
        const fileExtension = `.${file.name.split(".").pop()}`;
        const isAccepted = acceptedTypes.some((type) => {
          if (type.endsWith("/*")) {
            const baseType = type.slice(0, -2);
            return file.type.startsWith(`${baseType}/`);
          }
          if (type.startsWith(".")) {
            return fileExtension.toLowerCase() === type.toLowerCase();
          }
          return file.type === type;
        });
        if (!isAccepted) {
          return "File type not accepted";
        }
      }
      return null;
    },
    [maxFileSize, acceptedTypes],
  );

  const addFiles = React.useCallback(
    async (newFiles: File[], skipUpload = false) => {
      if (readOnly || isPending) return;
      setError(null);

      if (maxFiles && files.length + newFiles.length > maxFiles) {
        const errorMessage = `Maximum ${maxFiles} files allowed`;
        setError(errorMessage);
        toast(errorMessage);
        setTimeout(() => {
          setError(null);
        }, 2000);
        return;
      }

      const rejectedFiles: Array<{ name: string; reason: string }> = [];
      const filesToValidate: File[] = [];

      for (const file of newFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          rejectedFiles.push({ name: file.name, reason: validationError });
          continue;
        }
        filesToValidate.push(file);
      }

      if (rejectedFiles.length > 0) {
        const firstError = rejectedFiles[0];
        if (firstError) {
          setError(firstError.reason);

          const truncatedName =
            firstError.name.length > 20
              ? `${firstError.name.slice(0, 20)}...`
              : firstError.name;

          if (rejectedFiles.length === 1) {
            toast(firstError.reason, {
              description: `"${truncatedName}" has been rejected`,
            });
          } else {
            toast(firstError.reason, {
              description: `"${truncatedName}" and ${rejectedFiles.length - 1} more rejected`,
            });
          }

          setTimeout(() => {
            setError(null);
          }, 2000);
        }
      }

      if (filesToValidate.length > 0) {
        if (!skipUpload) {
          const tempFiles = filesToValidate.map((f) => ({
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            type: f.type,
            url: undefined,
          }));
          const filesWithTemp = [...files, ...tempFiles];
          setFiles(filesWithTemp);

          const uploadingIds = new Set(tempFiles.map((f) => f.id));
          setUploadingFiles(uploadingIds);

          let uploadedFiles: FileCellData[] = [];

          if (cell.table.options.onFilesUpload) {
            try {
              uploadedFiles = await cell.table.options.onFilesUpload({
                files: filesToValidate,
                rowId,
                columnId,
              });
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : `Failed to upload ${filesToValidate.length} file${filesToValidate.length !== 1 ? "s" : ""}`,
              );
              setFiles((prev) => prev.filter((f) => !uploadingIds.has(f.id)));
              setUploadingFiles(new Set());
              return;
            }
          } else {
            uploadedFiles = filesToValidate.map((f, i) => ({
              id: tempFiles[i]?.id ?? crypto.randomUUID(),
              name: f.name,
              size: f.size,
              type: f.type,
              url: URL.createObjectURL(f),
            }));
          }

          const finalFiles = filesWithTemp
            .map((f) => {
              if (uploadingIds.has(f.id)) {
                return uploadedFiles.find((uf) => uf.name === f.name) ?? f;
              }
              return f;
            })
            .filter((f) => f.url !== undefined);

          setFiles(finalFiles);
          setUploadingFiles(new Set());
          cell.setValue(finalFiles);
        } else {
          const newFilesData: FileCellData[] = filesToValidate.map((f) => ({
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            type: f.type,
            url: URL.createObjectURL(f),
          }));
          const updatedFiles = [...files, ...newFilesData];
          setFiles(updatedFiles);
          cell.setValue(updatedFiles);
        }
      }
    },
    [cell, files, maxFiles, validateFile, rowId, columnId, readOnly, isPending],
  );

  const removeFile = React.useCallback(
    async (fileId: string) => {
      if (readOnly || isPending) return;
      setError(null);

      const fileToRemove = files.find((f) => f.id === fileId);
      if (!fileToRemove) return;

      setDeletingFiles((prev) => new Set(prev).add(fileId));

      if (cell.table.options.onFilesDelete) {
        try {
          await cell.table.options.onFilesDelete({
            fileIds: [fileId],
            rowId,
            columnId,
          });
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : `Failed to delete ${fileToRemove.name}`,
          );
          setDeletingFiles((prev) => {
            const next = new Set(prev);
            next.delete(fileId);
            return next;
          });
          return;
        }
      }

      if (fileToRemove.url?.startsWith("blob:")) {
        URL.revokeObjectURL(fileToRemove.url);
      }

      const updatedFiles = files.filter((f) => f.id !== fileId);
      setFiles(updatedFiles);
      setDeletingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      cell.setValue(updatedFiles);
    },
    [cell, files, rowId, columnId, readOnly, isPending],
  );

  const clearAll = React.useCallback(async () => {
    if (readOnly || isPending) return;
    setError(null);

    const fileIds = files.map((f) => f.id);
    setDeletingFiles(new Set(fileIds));

    if (cell.table.options.onFilesDelete && files.length > 0) {
      try {
        await cell.table.options.onFilesDelete({
          fileIds,
          rowId,
          columnId,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete files",
        );
        setDeletingFiles(new Set());
        return;
      }
    }

    for (const file of files) {
      if (file.url?.startsWith("blob:")) {
        URL.revokeObjectURL(file.url);
      }
    }
    setFiles([]);
    setDeletingFiles(new Set());
    cell.setValue([]);
  }, [cell, files, rowId, columnId, readOnly, isPending]);

  const onCellDragEnter = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true);
    }
  }, []);

  const onCellDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDraggingOver(false);
    }
  }, []);

  const onCellDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onCellDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingOver(false);

      const droppedFiles = Array.from(event.dataTransfer.files);
      if (droppedFiles.length > 0) {
        void addFiles(droppedFiles, false);
      }
    },
    [addFiles],
  );

  const onDropzoneDragEnter = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDropzoneDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const onDropzoneDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onDropzoneDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(event.dataTransfer.files);
      void addFiles(droppedFiles, false);
    },
    [addFiles],
  );

  const onDropzoneClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onDropzoneKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onDropzoneClick();
      }
    },
    [onDropzoneClick],
  );

  const onFileInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      void addFiles(selectedFiles, false);
      event.target.value = "";
    },
    [addFiles],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && !readOnly) {
        setError(null);
        cell.startEditing();
      } else {
        setError(null);
        cell.table.stopEditing();
      }
    },
    [cell, readOnly],
  );

  const onEditorKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Prevent the escape key from propagating to the data grid's keyboard handler
      // which would call blurCell() and remove focus from the cell
      if (event.key === "Escape") event.stopPropagation();
    },
    [],
  );

  const onInitialFocus = React.useCallback(() => {
    queueMicrotask(() => {
      dropzoneRef.current?.focus();
    });
    return false;
  }, []);

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        if (event.key === "Escape") {
          event.preventDefault();
          setFiles(cellValue);
          setError(null);
          cell.table.stopEditing();
        } else if (event.key === " ") {
          event.preventDefault();
          onDropzoneClick();
        } else if (event.key === "Tab") {
          event.preventDefault();
          cell.table.stopEditing({
            direction: event.shiftKey ? "shift+tab" : "tab",
          });
        }
      } else if (isFocused && event.key === "Enter") {
        event.preventDefault();
        cell.startEditing();
      }
    },
    [cell, isEditing, isFocused, cellValue, onDropzoneClick],
  );

  React.useEffect(() => {
    return () => {
      for (const file of files) {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      }
    };
  }, [files]);

  const lineCount = getLineCount(rowHeight);

  const { visibleItems: visibleFiles, hiddenCount: hiddenFileCount } =
    useBadgeOverflow({
      items: files,
      getLabel: (file) => file.name,
      containerRef,
      lineCount,
      cacheKeyPrefix: "file",
      iconSize: 12,
      maxWidth: 100,
    });

  return (
    <DataGridCellWrapper<TData>
      {...props}
      ref={containerRef}
      className={cn({
        "ring-1 ring-primary/80 ring-inset": isDraggingOver,
      })}
      onDragEnter={onCellDragEnter}
      onDragLeave={onCellDragLeave}
      onDragOver={onCellDragOver}
      onDrop={onCellDrop}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Popover open={isEditing} onOpenChange={onOpenChange}>
          <PopoverTrigger
            nativeButton={false}
            render={<div className="pointer-events-none absolute inset-0" />}
          />
          <PopoverContent
            data-grid-cell-editor=""
            align="start"
            sideOffset={sideOffset}
            className="w-100 rounded-none p-0"
            initialFocus={onInitialFocus}
            onKeyDown={onEditorKeyDown}
          >
            <div className="flex flex-col gap-2 p-3">
              <span id={labelId} className="sr-only">
                File upload
              </span>
              <div
                role="region"
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                aria-invalid={!!error}
                aria-disabled={isPending}
                data-dragging={isDragging ? "" : undefined}
                data-invalid={error ? "" : undefined}
                data-disabled={isPending ? "" : undefined}
                tabIndex={isDragging || isPending ? -1 : 0}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors outline-none hover:bg-accent/30 focus-visible:border-ring/50 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50"
                ref={dropzoneRef}
                onClick={onDropzoneClick}
                onDragEnter={onDropzoneDragEnter}
                onDragLeave={onDropzoneDragLeave}
                onDragOver={onDropzoneDragOver}
                onDrop={onDropzoneDrop}
                onKeyDown={onDropzoneKeyDown}
              >
                <IconPlaceholder
                  lucide="Upload"
                  tabler="IconCloudUpload"
                  hugeicons="CloudUploadIcon"
                  phosphor="CloudArrowUpIcon"
                  remixicon="RiUploadCloudLine"
                  className="size-8 text-muted-foreground"
                />
                <div className="text-center text-sm">
                  <p className="font-medium">
                    {isDragging ? "Drop files here" : "Drag files here"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse
                  </p>
                </div>
                <p id={descriptionId} className="text-xs text-muted-foreground">
                  {maxFileSize
                    ? `Max size: ${formatFileSize(maxFileSize)}${maxFiles ? ` • Max ${maxFiles} files` : ""}`
                    : maxFiles
                      ? `Max ${maxFiles} files`
                      : "Select files to upload"}
                </p>
              </div>
              <input
                type="file"
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                multiple={multiple}
                accept={accept}
                className="sr-only"
                ref={fileInputRef}
                onChange={onFileInputChange}
              />
              {files.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {files.length} {files.length === 1 ? "file" : "files"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={clearAll}
                      disabled={isPending}
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="max-h-50 space-y-1 overflow-y-auto">
                    {files.map((file) => {
                      const FileIcon = getFileIcon(file.type);
                      const isFileUploading = uploadingFiles.has(file.id);
                      const isFileDeleting = deletingFiles.has(file.id);
                      const isFilePending = isFileUploading || isFileDeleting;

                      return (
                        <div
                          key={file.id}
                          data-pending={isFilePending ? "" : undefined}
                          className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5 data-pending:opacity-60"
                        >
                          {FileIcon && (
                            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isFileUploading
                                ? "Uploading..."
                                : isFileDeleting
                                  ? "Deleting..."
                                  : formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-5 rounded-sm"
                            onClick={() => removeFile(file.id)}
                            disabled={isPending}
                          >
                            <IconPlaceholder
                              lucide="X"
                              tabler="IconX"
                              hugeicons="Cancel01Icon"
                              phosphor="XIcon"
                              remixicon="RiCloseLine"
                              className="size-3"
                            />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      {isDraggingOver ? (
        <div className="flex items-center justify-center gap-2 text-sm text-primary">
          <IconPlaceholder
            lucide="Upload"
            tabler="IconCloudUpload"
            hugeicons="CloudUploadIcon"
            phosphor="CloudArrowUpIcon"
            remixicon="RiUploadCloudLine"
            className="size-4"
          />
          <span>Drop files here</span>
        </div>
      ) : files.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
          {visibleFiles.map((file) => {
            const isUploading = uploadingFiles.has(file.id);

            if (isUploading) {
              return (
                <Skeleton
                  key={file.id}
                  className="h-5 shrink-0 px-1.5"
                  style={{
                    width: `${Math.min(file.name.length * 8 + 30, 100)}px`,
                  }}
                />
              );
            }

            const FileIcon = getFileIcon(file.type);

            return (
              <Badge
                key={file.id}
                variant="secondary"
                className="gap-1 px-1.5 py-px"
              >
                {FileIcon && <FileIcon className="size-3 shrink-0" />}
                <span className="max-w-25 truncate">{file.name}</span>
              </Badge>
            );
          })}
          {hiddenFileCount > 0 && (
            <Badge
              variant="outline"
              className="px-1.5 py-px text-muted-foreground"
            >
              +{hiddenFileCount}
            </Badge>
          )}
        </div>
      ) : null}
    </DataGridCellWrapper>
  );
}

function toastDangerousUrl() {
  toast.error("Invalid URL", {
    description:
      "URL contains a dangerous protocol (javascript:, data:, vbscript:, or file:)",
  });
}
