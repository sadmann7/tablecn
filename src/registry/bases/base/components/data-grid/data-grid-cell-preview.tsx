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
import { badgeVariants } from "@/registry/bases/base/ui/badge";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const BADGE_CLASS_NAME = cn(
  badgeVariants({ variant: "secondary" }),
  "px-1.5 py-px",
);
const OVERFLOW_BADGE_CLASS_NAME = cn(
  badgeVariants({ variant: "outline" }),
  "px-1.5 py-px text-muted-foreground",
);
const BADGE_LIST_CLASS_NAME =
  "flex flex-wrap content-start items-center gap-1 overflow-hidden";

const LINE_CLAMP_CLASS_NAMES: Record<RowHeightValue, string> = {
  short: "line-clamp-1",
  medium: "line-clamp-2",
  tall: "line-clamp-3",
  "extra-tall": "line-clamp-4",
};

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
  const { className, content } = getPreviewContent(
    cell,
    cell.column.columnDef.meta?.cell,
    width,
    rowHeight,
  );

  return (
    <div
      data-slot="grid-cell-preview"
      className={cn(
        "size-full cursor-default px-2 py-1.5 text-start text-sm",
        className,
        {
          "bg-yellow-100 dark:bg-yellow-900/30":
            isSearchMatch && !isActiveSearchMatch,
          "bg-orange-200 dark:bg-orange-900/50": isActiveSearchMatch,
          "bg-primary/10": isSelected,
        },
      )}
    >
      {content}
    </div>
  );
}

// Each preview mounts as few elements as possible, since every element inserted mid scroll is matched against the whole stylesheet
function getPreviewContent<TData extends RowData>(
  cell: Cell<DataGridFeatures, TData>,
  cellOpts: CellOpts | undefined,
  width: number,
  rowHeight: RowHeightValue,
): { className?: string; content: React.ReactNode } {
  const value = cell.getValue();
  const lineClampClassName = LINE_CLAMP_CLASS_NAMES[rowHeight];

  switch (cellOpts?.variant) {
    case "checkbox": {
      const isChecked = getBooleanCellValue(value);
      return {
        className: "flex justify-center pt-2.5",
        content: (
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
        ),
      };
    }
    case "select": {
      const selectedValue = getOptionCellValue(value);
      const label =
        cellOpts.options.find((option) => option.value === selectedValue)
          ?.label ?? selectedValue;
      return {
        content: label ? (
          <span
            className={cn(
              BADGE_CLASS_NAME,
              "whitespace-pre-wrap",
              lineClampClassName,
            )}
          >
            {label}
          </span>
        ) : null,
      };
    }
    case "multi-select": {
      const values = getOptionsCellValue(value);
      if (values.length === 0) return { content: null };
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
      return {
        className: BADGE_LIST_CLASS_NAME,
        content: (
          <>
            {visibleItems.map((label, index) => (
              <span key={values[index]} className={BADGE_CLASS_NAME}>
                {label}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className={OVERFLOW_BADGE_CLASS_NAME}>+{hiddenCount}</span>
            )}
          </>
        ),
      };
    }
    case "file": {
      const files = getFilesCellValue(value);
      if (files.length === 0) return { content: null };
      const { visibleItems, hiddenCount } = getBadgeOverflow({
        items: files,
        getLabel: (file) => file.name,
        containerWidth: width,
        lineCount: getLineCount(rowHeight),
        cacheKeyPrefix: "file",
        iconSize: 12,
        maxWidth: 100,
      });
      return {
        className: BADGE_LIST_CLASS_NAME,
        content: (
          <>
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
          </>
        ),
      };
    }
    case "date":
      return {
        className: lineClampClassName,
        content: formatDateForDisplay(getDateCellValue(value)),
      };
    case "url": {
      const url = getTextCellValue(value);
      if (!url) return { content: null };
      // Keeps its own clipping box so the unbroken URL stops at the content edge, not in the padding
      return {
        content: (
          <div className={cn("size-full overflow-hidden", lineClampClassName)}>
            <span
              data-invalid={getUrlHref(url) ? undefined : ""}
              className="truncate text-primary underline decoration-primary/30 underline-offset-2 data-invalid:text-destructive data-invalid:decoration-destructive/50"
            >
              {url}
            </span>
          </div>
        ),
      };
    }
    case "number":
      return {
        className: lineClampClassName,
        content: getNumberCellValue(value) ?? "",
      };
    default:
      return {
        className: lineClampClassName,
        content: getTextCellValue(value),
      };
  }
}
