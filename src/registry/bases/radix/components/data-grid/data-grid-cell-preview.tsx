import type { Cell, RowData } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { CellOpts, RowHeightValue } from "@/lib/data-grid-types";

import { getBadgeOverflow } from "@/hooks/use-badge-overflow";
import {
  formatDateForDisplay,
  getBooleanCellValue,
  getDateCellValue,
  getFileIcon,
  getFilesCellValue,
  getLineCount,
  getNumberCellValue,
  getOptionCellValue,
  getOptionsCellValue,
  getTextCellValue,
  getUrlHref,
} from "@/lib/data-grid-utils";
import { badgeVariants } from "@/registry/bases/radix/ui/badge";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const BADGE_CLASS_NAME = cn(
  badgeVariants({ variant: "secondary" }),
  "px-1.5 py-px",
);
const OVERFLOW_BADGE_CLASS_NAME = cn(
  badgeVariants({ variant: "outline" }),
  "px-1.5 py-px text-muted-foreground",
);

interface DataGridCellPreviewProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>;
  width: number;
  rowHeight: RowHeightValue;
  isSelected: boolean;
  isSearchMatch: boolean;
  isActiveSearchMatch: boolean;
}

// Static stand-in for a cell mounted mid fling, without the data-row-id and data-column-id attributes so focus never lands on it
export function DataGridCellPreview<TData extends RowData>({
  cell,
  width,
  rowHeight,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
}: DataGridCellPreviewProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "text";

  return (
    <div
      data-slot="grid-cell-preview"
      className={cn("size-full cursor-default px-2 py-1.5 text-start text-sm", {
        "flex justify-center pt-2.5": variant === "checkbox",
        "bg-yellow-100 dark:bg-yellow-900/30":
          isSearchMatch && !isActiveSearchMatch,
        "bg-orange-200 dark:bg-orange-900/50": isActiveSearchMatch,
        "bg-primary/10": isSelected,
        "**:data-[slot=grid-cell-content]:line-clamp-1": rowHeight === "short",
        "**:data-[slot=grid-cell-content]:line-clamp-2": rowHeight === "medium",
        "**:data-[slot=grid-cell-content]:line-clamp-3": rowHeight === "tall",
        "**:data-[slot=grid-cell-content]:line-clamp-4":
          rowHeight === "extra-tall",
      })}
    >
      {getPreviewContent(cell, cellOpts, width, rowHeight)}
    </div>
  );
}

function getPreviewContent<TData extends RowData>(
  cell: Cell<DataGridFeatures, TData>,
  cellOpts: CellOpts | undefined,
  width: number,
  rowHeight: RowHeightValue,
): React.ReactNode {
  const value = cell.getValue();

  switch (cellOpts?.variant) {
    case "checkbox": {
      const isChecked = getBooleanCellValue(value);
      return (
        <span
          data-checked={isChecked ? "" : undefined}
          className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-primary dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary [&>svg]:size-3.5"
        >
          {isChecked ? (
            <IconPlaceholder
              lucide="Check"
              tabler="IconCheck"
              hugeicons="Tick02Icon"
              phosphor="CheckIcon"
              remixicon="RiCheckLine"
            />
          ) : null}
        </span>
      );
    }
    case "select": {
      const selectedValue = getOptionCellValue(value);
      const label =
        cellOpts.options.find((option) => option.value === selectedValue)
          ?.label ?? selectedValue;
      return label ? (
        <span
          data-slot="grid-cell-content"
          className={cn(BADGE_CLASS_NAME, "whitespace-pre-wrap")}
        >
          {label}
        </span>
      ) : null;
    }
    case "multi-select": {
      const values = getOptionsCellValue(value);
      if (values.length === 0) return null;
      const labels = values.map(
        (item) =>
          cellOpts.options.find((option) => option.value === item)?.label ??
          item,
      );
      const { visibleItems, hiddenCount } = getBadgeOverflow({
        items: labels,
        getLabel: (label) => label,
        containerWidth: width,
        lineCount: getLineCount(rowHeight),
      });
      return (
        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
          {visibleItems.map((label, index) => (
            <span key={values[index]} className={BADGE_CLASS_NAME}>
              {label}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className={OVERFLOW_BADGE_CLASS_NAME}>+{hiddenCount}</span>
          )}
        </div>
      );
    }
    case "file": {
      const files = getFilesCellValue(value);
      if (files.length === 0) return null;
      const { visibleItems, hiddenCount } = getBadgeOverflow({
        items: files,
        getLabel: (file) => file.name,
        containerWidth: width,
        lineCount: getLineCount(rowHeight),
        cacheKeyPrefix: "file",
        iconSize: 12,
        maxWidth: 100,
      });
      return (
        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
          {visibleItems.map((file) => {
            const FileIcon = getFileIcon(file.type);
            return (
              <span key={file.id} className={cn(BADGE_CLASS_NAME, "gap-1")}>
                {FileIcon && <FileIcon className="size-3 shrink-0" />}
                <span className="max-w-25 truncate">{file.name}</span>
              </span>
            );
          })}
          {hiddenCount > 0 && (
            <span className={OVERFLOW_BADGE_CLASS_NAME}>+{hiddenCount}</span>
          )}
        </div>
      );
    }
    case "date":
      return (
        <span data-slot="grid-cell-content">
          {formatDateForDisplay(getDateCellValue(value))}
        </span>
      );
    case "url": {
      const url = getTextCellValue(value);
      if (!url) return null;
      return (
        <div
          data-slot="grid-cell-content"
          className="size-full overflow-hidden"
        >
          <span
            data-invalid={getUrlHref(url) ? undefined : ""}
            className="truncate text-primary underline decoration-primary/30 underline-offset-2 data-invalid:text-destructive data-invalid:decoration-destructive/50"
          >
            {url}
          </span>
        </div>
      );
    }
    case "number":
      return (
        <span data-slot="grid-cell-content">
          {getNumberCellValue(value) ?? ""}
        </span>
      );
    case "long-text":
      return (
        <span data-slot="grid-cell-content">{getTextCellValue(value)}</span>
      );
    default:
      return (
        <div
          data-slot="grid-cell-content"
          className="size-full overflow-hidden"
        >
          {getTextCellValue(value)}
        </div>
      );
  }
}
