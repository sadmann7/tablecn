"use client";

import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { RowData } from "@tanstack/react-table";
import type { ExternalToast } from "sonner";

import { cn } from "cn";
import * as React from "react";
import { toast } from "sonner";

import type {
  DataGridCellProps,
  FileCellData,
  NavigationDirection,
} from "@/lib/data-grid-types";

import { useBadgeOverflow } from "@/hooks/use-badge-overflow";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  createFileObjectUrl,
  formatDateForDisplay,
  formatDateToString,
  formatFileSize,
  formatNumberForDisplay,
  getBooleanCellValue,
  getCellKey,
  getColumnLabel,
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
  moveCaretToEnd,
  parseLocalDate,
  replaceEditableText,
} from "@/lib/data-grid-utils";
import {
  DataGridCell,
  useCellValue,
} from "@/registry/bases/base/components/data-grid/data-grid-cell";
import { Badge } from "@/registry/bases/base/ui/badge";
import { Button } from "@/registry/bases/base/ui/button";
import { Calendar } from "@/registry/bases/base/ui/calendar";
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
import { Skeleton } from "@/registry/bases/base/ui/skeleton";
import { Textarea } from "@/registry/bases/base/ui/textarea";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

// Editors start a border out, so they cover the cell borders instead of doubling them
const CELL_BORDER_WIDTH = 1;
// Editors open in place, so they skip the popover's enter and exit animations
const CELL_EDITOR_CLASS_NAME =
  "rounded-none p-0 ring-inset data-open:animate-none data-closed:animate-none";
// Badges fit the cell's first text line
const CELL_BADGE_CLASS_NAME = "mt-0.5 mb-px h-4.25 px-1.5 py-0";

interface SaveOptions {
  moveToNextRow?: boolean;
  direction?: NavigationDirection;
}

export function ShortTextCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { onKeyDown, textProps } = useEditableText(props);

  return (
    <DataGridCell<TData> {...props} onKeyDown={onKeyDown}>
      <EditableText {...textProps} />
    </DataGridCell>
  );
}

export function LongTextCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, isFocused, readOnly } = props;
  const initialValue = getTextCellValue(useCellValue(cell));
  const [draft, setDraft] = React.useState<{
    initialValue: string;
    value: string;
  } | null>(null);
  const value =
    isEditing && draft?.initialValue === initialValue
      ? draft.value
      : initialValue;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { takePendingChar, onPendingCharKeyDown } = usePendingChar({
    isFocused,
    isEditing,
    readOnly,
  });

  const editStartValueRef = React.useRef(initialValue);
  const isCancelingRef = React.useRef(false);
  const wasEditingRef = React.useRef(false);

  React.useEffect(() => {
    if (isEditing && !wasEditingRef.current) {
      editStartValueRef.current = initialValue;
      isCancelingRef.current = false;
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, initialValue]);

  const debouncedSave = useDebouncedCallback((newValue: string) => {
    if (!readOnly) {
      cell.setValue(newValue);
    }
  }, 300);

  const onSave = React.useCallback(
    (options?: SaveOptions) => {
      debouncedSave.cancel();
      if (isCancelingRef.current) {
        cell.table.stopEditing(options);
        return;
      }
      if (!readOnly && value !== initialValue) {
        cell.setValue(value);
      }
      setDraft(null);
      cell.table.stopEditing(options);
    },
    [cell, value, initialValue, readOnly, debouncedSave],
  );

  const onCancel = React.useCallback(() => {
    debouncedSave.cancel();
    isCancelingRef.current = true;
    setDraft(null);
    const editStartValue = editStartValueRef.current;
    if (!readOnly && getTextCellValue(cell.getValue()) !== editStartValue) {
      cell.setValue(editStartValue);
    }
    cell.table.stopEditing();
  }, [cell, readOnly, debouncedSave]);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && !readOnly) {
        cell.startEditing();
      } else {
        onSave();
      }
    },
    [cell, readOnly, onSave],
  );

  const { onPopoverOpenChange, onFinalFocus } = useCellEditorDismiss(
    containerRef,
    onOpenChange,
  );

  const onInitialFocus = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return false;

    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);

    const pendingChar = takePendingChar();
    if (pendingChar) {
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea && document.activeElement === textarea) {
          insertTextAtSelection(textarea, pendingChar);
          textarea.scrollTop = textarea.scrollHeight;
        }
      });
    } else {
      textarea.scrollTop = textarea.scrollHeight;
    }

    return false;
  }, [takePendingChar]);

  const onBlur = React.useCallback(() => onSave(), [onSave]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setDraft({ initialValue, value: newValue });
      debouncedSave(newValue);
    },
    [debouncedSave, initialValue],
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
        onSave({ direction: getTabDirection(event) });
        return;
      }
      event.stopPropagation();
    },
    [onSave, onCancel],
  );

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onPendingCharKeyDown}
    >
      <Popover open={isEditing} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger
          nativeButton={false}
          render={<div className="pointer-events-none absolute inset-0" />}
        />
        <PopoverContent
          aria-label={getColumnLabel(cell.column)}
          data-grid-cell-editor=""
          align="start"
          side="bottom"
          alignOffset={-CELL_BORDER_WIDTH}
          sideOffset={getOverlapOffset}
          className={cn(CELL_EDITOR_CLASS_NAME, "w-100")}
          initialFocus={onInitialFocus}
          finalFocus={onFinalFocus}
        >
          <Textarea
            aria-label={getColumnLabel(cell.column)}
            placeholder="Enter text..."
            className="max-h-75 min-h-37.5 resize-none overflow-y-auto rounded-none border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset dark:bg-transparent"
            ref={textareaRef}
            value={value}
            onBlur={onBlur}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
        </PopoverContent>
      </Popover>
      <span data-slot="data-grid-cell-content" dir="auto">
        {value}
      </span>
    </DataGridCell>
  );
}

export function NumberCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, isFocused, readOnly } = props;
  const initialValue = getNumberCellValue(useCellValue(cell));
  const [draft, setDraft] = React.useState<{
    initialValue: number | null;
    value: string;
  } | null>(null);
  const value =
    isEditing && draft?.initialValue === initialValue
      ? draft.value
      : String(initialValue ?? "");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isCancelingRef = React.useRef(false);
  const prevIsEditingRef = React.useRef(false);
  const { pendingCharRef, onPendingCharKeyDown } = usePendingChar({
    isFocused,
    isEditing,
    readOnly,
  });

  const cellOpts = cell.column.columnDef.meta?.cell;
  const numberCellOpts = cellOpts?.variant === "number" ? cellOpts : null;
  const min = numberCellOpts?.min;
  const max = numberCellOpts?.max;
  const step = numberCellOpts?.step;
  const format = numberCellOpts?.format;
  const displayNumber = getNumberCellValue(value);

  const onSave = React.useCallback(
    (options?: SaveOptions) => {
      const numValue = value === "" ? null : Number(value);
      if (!readOnly && numValue !== initialValue) {
        cell.setValue(numValue);
      }
      setDraft(null);
      cell.table.stopEditing(options);
    },
    [cell, initialValue, value, readOnly],
  );

  const onBlur = React.useCallback(() => {
    // Escape blurs too, and the typed value hasn't been cleared by then
    if (isCancelingRef.current) {
      isCancelingRef.current = false;
      cell.table.stopEditing();
      return;
    }
    onSave();
  }, [cell, onSave]);

  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDraft({ initialValue, value: event.target.value });
    },
    [initialValue],
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        endEditOnKey(event, onSave, () => {
          setDraft(null);
          isCancelingRef.current = true;
          inputRef.current?.blur();
        });
      } else {
        onPendingCharKeyDown(event);
      }
    },
    [isEditing, onSave, onPendingCharKeyDown],
  );

  React.useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;

    if (isEditing && !wasEditing && inputRef.current) {
      isCancelingRef.current = false;
      inputRef.current.focus();

      const pendingChar = pendingCharRef.current;
      pendingCharRef.current = null;
      if (pendingChar) {
        inputRef.current.select();
        if (!document.execCommand("insertText", false, pendingChar)) {
          setDraft({ initialValue, value: pendingChar });
        }
      }
    }
  }, [isEditing, initialValue, pendingCharRef]);

  return (
    <DataGridCell<TData> {...props} onKeyDown={onWrapperKeyDown}>
      {isEditing ? (
        <input
          aria-label={getColumnLabel(cell.column)}
          type="number"
          ref={inputRef}
          defaultValue={value}
          min={min}
          max={max}
          step={step}
          className="w-full [appearance:textfield] border-none bg-transparent p-0 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onBlur={onBlur}
          onChange={onChange}
        />
      ) : (
        <span
          data-slot="data-grid-cell-content"
          dir="auto"
          className="tabular-nums"
        >
          {displayNumber === null
            ? ""
            : formatNumberForDisplay(displayNumber, format)}
        </span>
      )}
    </DataGridCell>
  );
}

export function UrlCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { isEditing, isFocused } = props;
  const { value, onKeyDown, textProps } = useEditableText({
    ...props,
    parse: parseUrlText,
  });

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        !isEditing &&
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
        return;
      }
      onKeyDown(event);
    },
    [isEditing, isFocused, value, onKeyDown],
  );

  const onLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (isEditing) {
        event.preventDefault();
        return;
      }

      const href = getUrlHref(value);
      if (!href) {
        event.preventDefault();
        toastDangerousUrl();
        return;
      }

      event.stopPropagation();
    },
    [isEditing, value],
  );

  const displayValue = isEditing ? "" : value;
  const urlHref = displayValue ? getUrlHref(displayValue) : "";
  const isDangerousUrl = displayValue && !urlHref;

  return (
    <DataGridCell<TData> {...props} onKeyDown={onWrapperKeyDown}>
      {!isEditing && displayValue ? (
        <div
          data-slot="data-grid-cell-content"
          dir="auto"
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
        <EditableText {...textProps} />
      )}
    </DataGridCell>
  );
}

export function CheckboxCell<TData extends RowData>(
  props: Omit<DataGridCellProps<TData>, "isEditing">,
) {
  const { cell, isFocused, readOnly } = props;
  const value = getBooleanCellValue(useCellValue(cell));
  const containerRef = React.useRef<HTMLDivElement>(null);

  const onCheckedChange = React.useCallback(
    (checked: boolean) => {
      if (readOnly) return;
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
      event.preventDefault();
      cell.table.setFocusedCell(cell.row.id, cell.column.id);
      containerRef.current?.focus();
    },
    [cell],
  );

  const onCheckboxDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      isEditing={false}
      onClick={onWrapperClick}
      onKeyDown={onWrapperKeyDown}
      className="flex size-full justify-center"
    >
      <Checkbox
        aria-label={getColumnLabel(cell.column)}
        tabIndex={-1}
        checked={value}
        onCheckedChange={onCheckedChange}
        disabled={readOnly}
        className="border-primary"
        onClick={onCheckboxClick}
        onMouseDown={onCheckboxMouseDown}
        onDoubleClick={onCheckboxDoubleClick}
      />
    </DataGridCell>
  );
}

export function SelectCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, readOnly } = props;
  const value = getOptionCellValue(useCellValue(cell));
  const containerRef = React.useRef<HTMLDivElement>(null);
  const commandRef = React.useRef<HTMLDivElement>(null);
  const { options, getOptionLabel } = useCellOptions(cell, "select");

  const onValueChange = React.useCallback(
    (newValue: string) => {
      if (readOnly) return;
      cell.setValue(newValue);
      cell.table.stopEditing();
    },
    [cell, readOnly],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => setCellEditing(cell, open, readOnly),
    [cell, readOnly],
  );

  const onInitialFocus = React.useCallback(() => {
    commandRef.current?.focus();
    return false;
  }, []);

  const { onPopoverOpenChange, onFinalFocus } = useCellEditorDismiss(
    containerRef,
    onOpenChange,
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) closeEditorOnKey(cell, event);
    },
    [cell, isEditing],
  );

  const displayLabel = value ? getOptionLabel(value) : null;

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      onMouseDown={isEditing ? onEditingCellMouseDown : undefined}
      onKeyDown={onWrapperKeyDown}
    >
      <Popover open={isEditing} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger
          nativeButton={false}
          render={<div className="pointer-events-none absolute inset-0" />}
        />
        <PopoverContent
          aria-label={getColumnLabel(cell.column)}
          data-grid-cell-editor=""
          align="start"
          sideOffset={0}
          className={cn(CELL_EDITOR_CLASS_NAME, "w-(--anchor-width) min-w-36")}
          initialFocus={onInitialFocus}
          finalFocus={onFinalFocus}
        >
          <Command
            ref={commandRef}
            tabIndex={-1}
            loop
            defaultValue={value ?? undefined}
            className="bg-transparent p-px outline-none"
          >
            <CommandList>
              <CommandGroup className="p-1.5">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    data-checked={option.value === value}
                    onSelect={onValueChange}
                  >
                    <span>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {displayLabel ? (
        <Badge
          data-slot="data-grid-cell-content"
          dir="auto"
          variant="secondary"
          className="mt-0.5 mb-px h-auto px-1.5 py-0 leading-3.75 whitespace-pre-wrap"
        >
          {displayLabel}
        </Badge>
      ) : null}
    </DataGridCell>
  );
}

export function MultiSelectCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, width, rowHeight, isEditing, readOnly } = props;
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const rawValue = useCellValue(cell);
  const cellValue = React.useMemo(
    () => getOptionsCellValue(rawValue),
    [rawValue],
  );

  const cellKey = getCellKey(rowId, columnId);

  const [draft, setDraft] = React.useState<{
    cellValue: string[];
    values: string[];
  } | null>(null);
  const selectedValues =
    draft?.cellValue === cellValue ? draft.values : cellValue;
  const [search, setSearch] = React.useState({ cellKey, value: "" });
  const searchValue = search.cellKey === cellKey ? search.value : "";
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { options, getOptionLabel } = useCellOptions(cell, "multi-select");

  const onSearchValueChange = React.useCallback(
    (value: string) => setSearch({ cellKey, value }),
    [cellKey],
  );

  const commitValues = React.useCallback(
    (newValues: string[]) => {
      setDraft({ cellValue, values: newValues });
      queueMicrotask(() => {
        cell.setValue(newValues);
        setDraft(null);
        inputRef.current?.focus();
      });
    },
    [cell, cellValue],
  );

  const onValueChange = React.useCallback(
    (value: string) => {
      if (readOnly) return;
      commitValues(
        selectedValues.includes(value)
          ? selectedValues.filter((v) => v !== value)
          : [...selectedValues, value],
      );
      setSearch({ cellKey, value: "" });
    },
    [readOnly, commitValues, selectedValues, cellKey],
  );

  const removeValue = React.useCallback(
    (valueToRemove: string, event?: React.MouseEvent) => {
      if (readOnly) return;
      event?.stopPropagation();
      event?.preventDefault();
      commitValues(selectedValues.filter((v) => v !== valueToRemove));
    },
    [readOnly, commitValues, selectedValues],
  );

  const clearAll = React.useCallback(() => {
    if (readOnly) return;
    setDraft(null);
    cell.setValue([]);
    queueMicrotask(() => inputRef.current?.focus());
  }, [cell, readOnly]);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) setSearch({ cellKey, value: "" });
      setCellEditing(cell, open, readOnly);
    },
    [cell, readOnly, cellKey],
  );

  const { onPopoverOpenChange, onFinalFocus } = useCellEditorDismiss(
    containerRef,
    onOpenChange,
  );

  const onInitialFocus = React.useCallback(() => {
    inputRef.current?.focus();
    return false;
  }, []);

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isEditing) return;
      if (event.key === "Escape") setDraft(null);
      if (closeEditorOnKey(cell, event)) setSearch({ cellKey, value: "" });
    },
    [cell, isEditing, cellKey],
  );

  const onInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && searchValue === "") {
        event.preventDefault();
        if (selectedValues.length > 0) {
          commitValues(selectedValues.slice(0, -1));
        } else {
          queueMicrotask(() => inputRef.current?.focus());
        }
      }
    },
    [searchValue, selectedValues, commitValues],
  );

  const displayLabels = selectedValues
    .map((value) => getOptionLabel(value))
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
      containerWidth: width,
      lineCount,
    });

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      onKeyDown={onWrapperKeyDown}
    >
      {isEditing ? (
        <Popover open={isEditing} onOpenChange={onPopoverOpenChange}>
          <PopoverTrigger
            nativeButton={false}
            render={<div className="pointer-events-none absolute inset-0" />}
          />
          <PopoverContent
            aria-label={getColumnLabel(cell.column)}
            data-grid-cell-editor=""
            align="start"
            alignOffset={-CELL_BORDER_WIDTH}
            sideOffset={getOverlapOffset}
            className={cn(CELL_EDITOR_CLASS_NAME, "w-75")}
            style={{
              minWidth: `calc(var(--anchor-width) + ${CELL_BORDER_WIDTH * 2}px)`,
            }}
            initialFocus={onInitialFocus}
            finalFocus={onFinalFocus}
          >
            <Command className="bg-transparent p-px **:data-[slot=command-input-wrapper]:min-w-16 **:data-[slot=command-input-wrapper]:flex-1 **:data-[slot=command-input-wrapper]:p-0 **:data-[slot=input-group]:h-auto! **:data-[slot=input-group]:rounded-none! **:data-[slot=input-group]:border-none **:data-[slot=input-group]:bg-transparent **:data-[slot=input-group-addon]:hidden **:data-[slot=input-group]:dark:bg-transparent">
              <div className="flex flex-wrap items-center gap-1 border-b px-3.5 py-2 has-data-[slot=badge]:px-2">
                {selectedValues.map((value) => {
                  const label = getOptionLabel(value);

                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className="gap-1 px-1.5 py-px"
                    >
                      {label}
                      <button
                        aria-label={`Remove ${label}`}
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
                  aria-label={`Search ${getColumnLabel(cell.column)}`}
                  ref={inputRef}
                  value={searchValue}
                  onValueChange={onSearchValueChange}
                  onKeyDown={onInputKeyDown}
                  placeholder={
                    selectedValues.length > 0 ? undefined : "Search..."
                  }
                  className="p-0! placeholder:text-muted-foreground"
                />
              </div>
              <CommandList className="max-h-full">
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup className="max-h-75 scroll-py-1.5 overflow-x-hidden overflow-y-auto p-1.5">
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
                    <CommandGroup className="p-1.5">
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
        <div className="flex flex-wrap items-center gap-x-1 overflow-hidden">
          {visibleLabels.map((label, index) => (
            <Badge
              key={selectedValues[index]}
              variant="secondary"
              className={cn(
                CELL_BADGE_CLASS_NAME,
                "max-w-full",
                hiddenBadgeCount > 0 &&
                  index === visibleLabels.length - 1 &&
                  "max-w-[calc(100%-2.75rem)]",
              )}
            >
              <span dir="auto" className="truncate">
                {label}
              </span>
            </Badge>
          ))}
          {hiddenBadgeCount > 0 && <OverflowBadge count={hiddenBadgeCount} />}
        </div>
      ) : null}
    </DataGridCell>
  );
}

export function DateCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, isEditing, readOnly } = props;
  const value = getDateCellValue(useCellValue(cell));
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isInvalidDate = value !== "" && !parseLocalDate(value);

  const selectedDate = value ? (parseLocalDate(value) ?? undefined) : undefined;

  const onDateSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date || readOnly) return;

      cell.setValue(formatDateToString(date));
      cell.table.stopEditing();
    },
    [cell, readOnly],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => setCellEditing(cell, open, readOnly),
    [cell, readOnly],
  );

  const { onPopoverOpenChange, onFinalFocus } = useCellEditorDismiss(
    containerRef,
    onOpenChange,
  );

  const onWrapperKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) closeEditorOnKey(cell, event);
    },
    [cell, isEditing],
  );

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      onMouseDown={isEditing ? onEditingCellMouseDown : undefined}
      onKeyDown={onWrapperKeyDown}
    >
      <Popover open={isEditing} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger
          nativeButton={false}
          render={<div className="pointer-events-none absolute inset-0" />}
        />
        <span
          data-slot="data-grid-cell-content"
          dir="auto"
          data-invalid={isInvalidDate ? "" : undefined}
          className="data-invalid:text-destructive"
        >
          {formatDateForDisplay(value)}
        </span>
        <PopoverContent
          aria-label={getColumnLabel(cell.column)}
          data-grid-cell-editor=""
          align="start"
          sideOffset={0}
          className={cn(CELL_EDITOR_CLASS_NAME, "w-auto")}
          finalFocus={onFinalFocus}
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
      </Popover>
    </DataGridCell>
  );
}

export function FileCell<TData extends RowData>(
  props: DataGridCellProps<TData>,
) {
  const { cell, width, rowHeight, isEditing, readOnly } = props;
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const cellKey = getCellKey(rowId, columnId);
  const rawValue = useCellValue(cell);
  const cellValue = React.useMemo(
    () => getFilesCellValue(rawValue),
    [rawValue],
  );

  const labelId = React.useId();
  const descriptionId = React.useId();

  const [uploads, setUploads] = React.useState<{
    cellKey: string;
    files: FileCellData[];
  } | null>(null);
  const uploadingFiles = uploads?.cellKey === cellKey ? uploads.files : null;
  const files = React.useMemo(
    () => (uploadingFiles ? [...cellValue, ...uploadingFiles] : cellValue),
    [cellValue, uploadingFiles],
  );
  const uploadingIds = React.useMemo(
    () => new Set(uploadingFiles?.map((file) => file.id)),
    [uploadingFiles],
  );
  const [deletingFiles, setDeletingFiles] = React.useState<Set<string>>(
    new Set(),
  );
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [errorState, setErrorState] = React.useState<{
    cellValue: FileCellData[];
    message: string;
  } | null>(null);
  const error = errorState?.cellValue === cellValue ? errorState.message : null;
  const errorTimeoutRef = React.useRef<number | undefined>(undefined);

  const isUploading = uploadingFiles !== null;
  const isDeleting = deletingFiles.size > 0;
  const isPending = isUploading || isDeleting;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropzoneRef = React.useRef<HTMLDivElement>(null);
  const cellOpts = cell.column.columnDef.meta?.cell;

  const fileCellOpts = cellOpts?.variant === "file" ? cellOpts : null;
  const maxFileSize = fileCellOpts?.maxFileSize ?? 10 * 1024 * 1024;
  const maxFiles = fileCellOpts?.maxFiles ?? 10;
  const accept = fileCellOpts?.accept;
  const multiple = fileCellOpts?.multiple ?? false;

  const acceptedTypes = React.useMemo(
    () => (accept ? accept.split(",").map((t) => t.trim()) : null),
    [accept],
  );

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

  React.useEffect(() => () => window.clearTimeout(errorTimeoutRef.current), []);

  const flashError = React.useCallback(
    (message: string, toastOptions?: ExternalToast) => {
      setErrorState({ cellValue, message });
      toast(message, toastOptions);
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = window.setTimeout(
        () => setErrorState(null),
        2000,
      );
    },
    [cellValue],
  );

  const addFiles = React.useCallback(
    async (newFiles: File[]) => {
      if (readOnly || isPending) return;
      setErrorState(null);

      if (maxFiles && cellValue.length + newFiles.length > maxFiles) {
        flashError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const rejectedFiles: { name: string; reason: string }[] = [];
      const filesToUpload: File[] = [];

      for (const file of newFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          rejectedFiles.push({ name: file.name, reason: validationError });
          continue;
        }
        filesToUpload.push(file);
      }

      const firstError = rejectedFiles[0];
      if (firstError) {
        const truncatedName =
          firstError.name.length > 20
            ? `${firstError.name.slice(0, 20)}...`
            : firstError.name;

        flashError(firstError.reason, {
          description:
            rejectedFiles.length === 1
              ? `"${truncatedName}" has been rejected`
              : `"${truncatedName}" and ${rejectedFiles.length - 1} more rejected`,
        });
      }

      if (filesToUpload.length === 0) return;

      const tempFiles = filesToUpload.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: undefined,
      }));
      setUploads({ cellKey, files: tempFiles });

      let uploadedFiles: FileCellData[];

      if (cell.table.options.uploadFiles) {
        try {
          uploadedFiles = await cell.table.options.uploadFiles({
            files: filesToUpload,
            rowId,
            columnId,
          });
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : `Failed to upload ${filesToUpload.length} file${filesToUpload.length !== 1 ? "s" : ""}`,
          );
          setUploads(null);
          return;
        }
      } else {
        uploadedFiles = filesToUpload.map((file, index) => ({
          id: tempFiles[index]?.id ?? crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: createFileObjectUrl(cell.table, file),
        }));
      }

      cell.setValue([
        ...getFilesCellValue(cell.getValue()),
        ...uploadedFiles.filter((file) => file.url !== undefined),
      ]);
      setUploads(null);
    },
    [
      cell,
      cellKey,
      cellValue,
      maxFiles,
      validateFile,
      flashError,
      rowId,
      columnId,
      readOnly,
      isPending,
    ],
  );

  const removeFile = React.useCallback(
    async (fileId: string) => {
      if (readOnly || isPending) return;
      setErrorState(null);

      const fileToRemove = cellValue.find((f) => f.id === fileId);
      if (!fileToRemove) return;

      setDeletingFiles((prev) => new Set(prev).add(fileId));

      if (cell.table.options.deleteFiles) {
        try {
          await cell.table.options.deleteFiles({
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

      cell.setValue(
        getFilesCellValue(cell.getValue()).filter((f) => f.id !== fileId),
      );
      setDeletingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    },
    [cell, cellValue, rowId, columnId, readOnly, isPending],
  );

  const clearAll = React.useCallback(async () => {
    if (readOnly || isPending) return;
    setErrorState(null);

    const fileIds = cellValue.map((f) => f.id);
    setDeletingFiles(new Set(fileIds));

    if (cell.table.options.deleteFiles && cellValue.length > 0) {
      try {
        await cell.table.options.deleteFiles({
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

    setDeletingFiles(new Set());
    cell.setValue([]);
  }, [cell, cellValue, rowId, columnId, readOnly, isPending]);

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
    if (getIsDragLeaving(event)) setIsDraggingOver(false);
  }, []);

  const onCellDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingOver(false);

      const droppedFiles = Array.from(event.dataTransfer.files);
      if (droppedFiles.length > 0) {
        void addFiles(droppedFiles);
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
    if (getIsDragLeaving(event)) setIsDragging(false);
  }, []);

  const onDropzoneDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(event.dataTransfer.files);
      void addFiles(droppedFiles);
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
      void addFiles(selectedFiles);
      event.target.value = "";
    },
    [addFiles],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      setErrorState(null);
      setCellEditing(cell, open, readOnly);
    },
    [cell, readOnly],
  );

  const { onPopoverOpenChange, onFinalFocus } = useCellEditorDismiss(
    containerRef,
    onOpenChange,
  );

  const onEditorKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
        if (event.key === " ") {
          event.preventDefault();
          onDropzoneClick();
          return;
        }
        if (event.key === "Escape") setErrorState(null);
        closeEditorOnKey(cell, event);
      }
    },
    [cell, isEditing, onDropzoneClick],
  );

  const lineCount = getLineCount(rowHeight);

  const { visibleItems: visibleFiles, hiddenCount: hiddenFileCount } =
    useBadgeOverflow({
      items: files,
      getLabel: (file) => file.name,
      containerWidth: width,
      lineCount,
      cacheKeyPrefix: "file",
      iconSize: 12,
      maxWidth: 100,
    });

  return (
    <DataGridCell<TData>
      {...props}
      ref={containerRef}
      onDragEnter={onCellDragEnter}
      onDragLeave={onCellDragLeave}
      onDragOver={onFileDragOver}
      onDrop={onCellDrop}
      onKeyDown={onWrapperKeyDown}
      className={cn({
        "ring-1 ring-primary/80 ring-inset": isDraggingOver,
      })}
    >
      {isEditing ? (
        <Popover open={isEditing} onOpenChange={onPopoverOpenChange}>
          <PopoverTrigger
            nativeButton={false}
            render={<div className="pointer-events-none absolute inset-0" />}
          />
          <PopoverContent
            aria-label={getColumnLabel(cell.column)}
            data-grid-cell-editor=""
            align="start"
            alignOffset={-CELL_BORDER_WIDTH}
            sideOffset={getOverlapOffset}
            className={cn(CELL_EDITOR_CLASS_NAME, "w-100")}
            initialFocus={onInitialFocus}
            finalFocus={onFinalFocus}
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
                onDragOver={onFileDragOver}
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
                      const isFileUploading = uploadingIds.has(file.id);
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
                            aria-label={`Remove ${file.name}`}
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
        <div className="flex flex-wrap items-center gap-x-1 overflow-hidden">
          {visibleFiles.map((file) => {
            const isUploading = uploadingIds.has(file.id);

            if (isUploading) {
              return (
                <Skeleton
                  key={file.id}
                  className="mt-0.5 mb-px h-4.25 shrink-0 px-1.5"
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
                className={cn(CELL_BADGE_CLASS_NAME, "gap-1")}
              >
                {FileIcon && <FileIcon className="size-3 shrink-0" />}
                <span dir="auto" className="max-w-25 truncate">
                  {file.name}
                </span>
              </Badge>
            );
          })}
          {hiddenFileCount > 0 && <OverflowBadge count={hiddenFileCount} />}
        </div>
      ) : null}
    </DataGridCell>
  );
}

interface OverflowBadgeProps {
  count: number;
}

function OverflowBadge({ count }: OverflowBadgeProps) {
  return (
    <Badge
      variant="outline"
      dir="ltr"
      className={cn(CELL_BADGE_CLASS_NAME, "text-muted-foreground")}
    >
      +{count}
    </Badge>
  );
}

interface UseEditableTextOptions<
  TData extends RowData,
> extends DataGridCellProps<TData> {
  parse?: (text: string) => string | null;
}

function useEditableText<TData extends RowData>({
  cell,
  isEditing,
  isFocused,
  readOnly,
  parse = parsePlainText,
}: UseEditableTextOptions<TData>) {
  const initialValue = getTextCellValue(useCellValue(cell));
  const [draft, setDraft] = React.useState<{
    initialValue: string;
    value: string;
  } | null>(null);
  const value =
    isEditing && draft?.initialValue === initialValue
      ? draft.value
      : initialValue;
  const textRef = React.useRef<HTMLDivElement>(null);
  const prevIsEditingRef = React.useRef(false);
  const { takePendingChar, onPendingCharKeyDown } = usePendingChar({
    isFocused,
    isEditing,
    readOnly,
  });

  React.useLayoutEffect(() => {
    const element = textRef.current;
    if (!isEditing && element && element.textContent !== initialValue) {
      element.textContent = initialValue;
    }
  }, [initialValue, isEditing]);

  React.useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    const element = textRef.current;
    if (!element) return;

    if (isEditing && !wasEditing) {
      element.focus();

      if (!element.textContent && value) {
        element.textContent = value;
      }

      const pendingChar = takePendingChar();
      if (pendingChar) {
        replaceEditableText(element, pendingChar);
      } else if (element.textContent) {
        moveCaretToEnd(element);
      }
    } else if (!isEditing && wasEditing) {
      element.scrollLeft = 0;
    }
  }, [isEditing, value, takePendingChar]);

  const onSave = React.useCallback(
    (options?: SaveOptions) => {
      const value = parse(textRef.current?.textContent ?? "");
      if (!readOnly && value !== parse(initialValue)) {
        cell.setValue(value);
      }
      setDraft(null);
      cell.table.stopEditing(options);
    },
    [cell, parse, initialValue, readOnly],
  );

  const onBlur = React.useCallback(() => onSave(), [onSave]);

  const onInput = React.useCallback(
    (event: React.InputEvent<HTMLDivElement>) => {
      setDraft({ initialValue, value: event.currentTarget.textContent ?? "" });
    },
    [initialValue],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) {
        endEditOnKey(event, onSave, () => {
          setDraft(null);
          const element = textRef.current;
          if (!element) return;
          // Blurring saves the DOM text, so the typed text is undone first
          element.textContent = initialValue;
          element.blur();
        });
      } else {
        onPendingCharKeyDown(event);
      }
    },
    [isEditing, initialValue, onSave, onPendingCharKeyDown],
  );

  return {
    value,
    onKeyDown,
    textProps: {
      ref: textRef,
      isEditing,
      label: getColumnLabel(cell.column),
      value,
      onBlur,
      onInput,
    },
  };
}

function parsePlainText(text: string) {
  return text;
}

function parseUrlText(text: string) {
  return text.trim() || null;
}

interface EditableTextProps extends React.ComponentProps<"div"> {
  isEditing: boolean;
  label: string;
  value: string;
}

function EditableText({
  isEditing,
  label,
  value,
  className,
  ...props
}: EditableTextProps) {
  return (
    <div
      role={isEditing ? "textbox" : undefined}
      aria-label={isEditing ? label : undefined}
      data-slot="data-grid-cell-content"
      dir="auto"
      contentEditable={isEditing}
      tabIndex={-1}
      suppressContentEditableWarning
      {...props}
      className={cn(
        "size-full overflow-hidden outline-none",
        {
          "whitespace-nowrap **:inline **:whitespace-nowrap [&_br]:hidden":
            isEditing,
        },
        className,
      )}
    >
      {isEditing ? "" : value}
    </div>
  );
}

interface UsePendingCharOptions {
  isFocused: boolean;
  isEditing: boolean;
  readOnly: boolean;
}

function usePendingChar({
  isFocused,
  isEditing,
  readOnly,
}: UsePendingCharOptions) {
  const pendingCharRef = React.useRef<string | null>(null);

  const onPendingCharKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
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

  const takePendingChar = React.useCallback(() => {
    const pendingChar = pendingCharRef.current;
    pendingCharRef.current = null;
    return pendingChar;
  }, []);

  return { pendingCharRef, takePendingChar, onPendingCharKeyDown };
}

function endEditOnKey(
  event: React.KeyboardEvent,
  onSave: (options: SaveOptions) => void,
  onCancel: () => void,
) {
  if (event.key === "Enter") {
    event.preventDefault();
    onSave({ moveToNextRow: true });
  } else if (event.key === "Tab") {
    event.preventDefault();
    onSave({ direction: getTabDirection(event) });
  } else if (event.key === "Escape") {
    event.preventDefault();
    onCancel();
  }
}

function useCellEditorDismiss(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onOpenChange: (open: boolean) => void,
) {
  const onPopoverOpenChange = React.useCallback(
    (open: boolean, eventDetails: PopoverPrimitive.Root.ChangeEventDetails) => {
      const { target } = eventDetails.event;
      if (
        eventDetails.reason === "outside-press" &&
        target instanceof Node &&
        containerRef.current?.contains(target)
      ) {
        eventDetails.cancel();
        return;
      }
      onOpenChange(open);
    },
    [containerRef, onOpenChange],
  );

  const onFinalFocus = React.useCallback(() => {
    const container = containerRef.current;
    if (container?.closest('[role="grid"]')?.contains(document.activeElement)) {
      return false;
    }
    return container;
  }, [containerRef]);

  return { onPopoverOpenChange, onFinalFocus };
}

const getOverlapOffset: PopoverPrimitive.Positioner.Props["sideOffset"] = ({
  anchor,
}) => -anchor.height - CELL_BORDER_WIDTH;

function setCellEditing<TData extends RowData>(
  cell: DataGridCellProps<TData>["cell"],
  open: boolean,
  readOnly: boolean,
) {
  if (open && !readOnly) {
    cell.startEditing();
  } else {
    cell.table.stopEditing();
  }
}

function closeEditorOnKey<TData extends RowData>(
  cell: DataGridCellProps<TData>["cell"],
  event: React.KeyboardEvent,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    cell.table.stopEditing();
    return true;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    cell.table.stopEditing({ direction: getTabDirection(event) });
    return true;
  }
  return false;
}

function onEditingCellMouseDown(event: React.MouseEvent) {
  event.preventDefault();
}

function getTabDirection(event: React.KeyboardEvent): NavigationDirection {
  return event.shiftKey ? "shift+tab" : "tab";
}

function useCellOptions<TData extends RowData>(
  cell: DataGridCellProps<TData>["cell"],
  variant: "select" | "multi-select",
) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const options = React.useMemo(
    () =>
      cellOpts?.variant === variant && "options" in cellOpts
        ? cellOpts.options
        : [],
    [cellOpts, variant],
  );
  const optionByValue = React.useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const getOptionLabel = React.useCallback(
    (value: string) => optionByValue.get(value)?.label ?? value,
    [optionByValue],
  );

  return { options, getOptionLabel };
}

function getIsDragLeaving(event: React.DragEvent) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;
  return x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom;
}

function onFileDragOver(event: React.DragEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function toastDangerousUrl() {
  toast.error("Invalid URL", {
    description:
      "URL contains a dangerous protocol (javascript:, data:, vbscript:, or file:)",
  });
}
