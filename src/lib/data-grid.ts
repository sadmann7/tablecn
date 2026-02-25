import type { Column, Table } from "@tanstack/react-table";
import {
  BaselineIcon,
  CalendarIcon,
  CheckSquareIcon,
  File,
  FileArchive,
  FileAudio,
  FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  HashIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  Presentation,
  TextInitialIcon,
} from "lucide-react";
import type * as React from "react";
import type {
  CellOpts,
  CellPosition,
  Direction,
  FileCellData,
  RowHeightValue,
} from "@/types/data-grid";

export function flexRender<TProps extends object>(
  Comp: ((props: TProps) => React.ReactNode) | string | undefined,
  props: TProps,
): React.ReactNode {
  if (typeof Comp === "string") {
    return Comp;
  }
  return Comp?.(props);
}

export function getIsFileCellData(item: unknown): item is FileCellData {
  return (
    !!item &&
    typeof item === "object" &&
    "id" in item &&
    "name" in item &&
    "size" in item &&
    "type" in item
  );
}

export function matchSelectOption(
  value: string,
  options: { value: string; label: string }[],
): string | undefined {
  return options.find(
    (o) =>
      o.value === value ||
      o.value.toLowerCase() === value.toLowerCase() ||
      o.label.toLowerCase() === value.toLowerCase(),
  )?.value;
}

export function getCellKey(rowIndex: number, columnId: string) {
  return `${rowIndex}:${columnId}`;
}

export function parseCellKey(cellKey: string): Required<CellPosition> {
  const parts = cellKey.split(":");
  const rowIndexStr = parts[0];
  const columnId = parts[1];
  if (rowIndexStr && columnId) {
    const rowIndex = parseInt(rowIndexStr, 10);
    if (!Number.isNaN(rowIndex)) {
      return { rowIndex, columnId };
    }
  }
  return { rowIndex: 0, columnId: "" };
}

export function getRowHeightValue(rowHeight: RowHeightValue): number {
  const rowHeightMap: Record<RowHeightValue, number> = {
    short: 36,
    medium: 56,
    tall: 76,
    "extra-tall": 96,
  };

  return rowHeightMap[rowHeight];
}

export function getLineCount(rowHeight: RowHeightValue): number {
  const lineCountMap: Record<RowHeightValue, number> = {
    short: 1,
    medium: 2,
    tall: 3,
    "extra-tall": 4,
  };

  return lineCountMap[rowHeight];
}

export function getColumnBorderVisibility<TData>(params: {
  column: Column<TData>;
  nextColumn?: Column<TData>;
  isLastColumn: boolean;
}): {
  showEndBorder: boolean;
  showStartBorder: boolean;
} {
  const { column, nextColumn, isLastColumn } = params;

  const isPinned = column.getIsPinned();
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");
  const isLastRightPinnedColumn =
    isPinned === "right" && column.getIsLastColumn("right");

  const nextIsPinned = nextColumn?.getIsPinned();
  const isBeforeRightPinned =
    nextIsPinned === "right" && nextColumn?.getIsFirstColumn("right");

  const showEndBorder =
    !isBeforeRightPinned && (isLastColumn || !isLastRightPinnedColumn);

  const showStartBorder = isFirstRightPinnedColumn;

  return {
    showEndBorder,
    showStartBorder,
  };
}

export function getColumnPinningStyle<TData>(params: {
  column: Column<TData>;
  withBorder?: boolean;
  dir?: Direction;
}): React.CSSProperties {
  const { column, dir = "ltr", withBorder = false } = params;

  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  const isRtl = dir === "rtl";

  const leftPosition =
    isPinned === "left" ? `${column.getStart("left")}px` : undefined;
  const rightPosition =
    isPinned === "right" ? `${column.getAfter("right")}px` : undefined;

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? isRtl
          ? "4px 0 4px -4px var(--border) inset"
          : "-4px 0 4px -4px var(--border) inset"
        : isFirstRightPinnedColumn
          ? isRtl
            ? "-4px 0 4px -4px var(--border) inset"
            : "4px 0 4px -4px var(--border) inset"
          : undefined
      : undefined,
    left: isRtl ? rightPosition : leftPosition,
    right: isRtl ? leftPosition : rightPosition,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: isPinned ? "var(--background)" : "var(--background)",
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

export function getScrollDirection(
  direction: string,
): "left" | "right" | "home" | "end" | undefined {
  if (
    direction === "left" ||
    direction === "right" ||
    direction === "home" ||
    direction === "end"
  ) {
    return direction as "left" | "right" | "home" | "end";
  }
  if (direction === "pageleft") return "left";
  if (direction === "pageright") return "right";
  return undefined;
}

export function scrollCellIntoView<TData>(params: {
  container: HTMLDivElement;
  targetCell: HTMLDivElement;
  tableRef: React.RefObject<Table<TData> | null>;
  viewportOffset: number;
  direction?: "left" | "right" | "home" | "end";
  isRtl: boolean;
}): void {
  const { container, targetCell, tableRef, direction, viewportOffset, isRtl } =
    params;

  const containerRect = container.getBoundingClientRect();
  const cellRect = targetCell.getBoundingClientRect();

  const hasNegativeScroll = container.scrollLeft < 0;
  const isActuallyRtl = isRtl || hasNegativeScroll;

  const currentTable = tableRef.current;
  const leftPinnedColumns = currentTable?.getLeftVisibleLeafColumns() ?? [];
  const rightPinnedColumns = currentTable?.getRightVisibleLeafColumns() ?? [];

  const leftPinnedWidth = leftPinnedColumns.reduce(
    (sum, c) => sum + c.getSize(),
    0,
  );
  const rightPinnedWidth = rightPinnedColumns.reduce(
    (sum, c) => sum + c.getSize(),
    0,
  );

  const viewportLeft = isActuallyRtl
    ? containerRect.left + rightPinnedWidth + viewportOffset
    : containerRect.left + leftPinnedWidth + viewportOffset;
  const viewportRight = isActuallyRtl
    ? containerRect.right - leftPinnedWidth - viewportOffset
    : containerRect.right - rightPinnedWidth - viewportOffset;

  const isFullyVisible =
    cellRect.left >= viewportLeft && cellRect.right <= viewportRight;

  if (isFullyVisible) return;

  const isClippedLeft = cellRect.left < viewportLeft;
  const isClippedRight = cellRect.right > viewportRight;

  let scrollDelta = 0;

  if (!direction) {
    if (isClippedRight) {
      scrollDelta = cellRect.right - viewportRight;
    } else if (isClippedLeft) {
      scrollDelta = -(viewportLeft - cellRect.left);
    }
  } else {
    const shouldScrollRight = isActuallyRtl
      ? direction === "right" || direction === "home"
      : direction === "right" || direction === "end";

    if (shouldScrollRight) {
      scrollDelta = cellRect.right - viewportRight;
    } else {
      scrollDelta = -(viewportLeft - cellRect.left);
    }
  }

  container.scrollLeft += scrollDelta;
}

function countTabs(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === "\t") n++;
  return n;
}

export function parseTsv(
  text: string,
  fallbackColumnCount: number,
): string[][] {
  if (text.startsWith('"') || text.includes('\t"')) {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i += 2;
        } else if (char === '"') {
          inQuotes = false;
          i++;
        } else {
          currentField += char;
          i++;
        }
      } else {
        if (char === '"' && currentField === "") {
          inQuotes = true;
          i++;
        } else if (char === "\t") {
          currentRow.push(currentField);
          currentField = "";
          i++;
        } else if (char === "\n") {
          currentRow.push(currentField);
          if (currentRow.length > 1 || currentRow.some((f) => f.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = "";
          i++;
        } else if (char === "\r" && nextChar === "\n") {
          currentRow.push(currentField);
          if (currentRow.length > 1 || currentRow.some((f) => f.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = "";
          i += 2;
        } else {
          currentField += char;
          i++;
        }
      }
    }

    currentRow.push(currentField);
    if (currentRow.length > 1 || currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }

    return rows;
  }

  const lines = text.split("\n");
  let maxTabCount = 0;
  for (const line of lines) {
    const n = countTabs(line);
    if (n > maxTabCount) maxTabCount = n;
  }
  const columnCount = maxTabCount > 0 ? maxTabCount + 1 : fallbackColumnCount;
  if (columnCount <= 0) return [];

  const expectedTabCount = columnCount - 1;
  const rows: string[][] = [];
  let buf = "";
  let bufTabCount = 0;

  for (const line of lines) {
    const tc = countTabs(line);

    if (tc === expectedTabCount) {
      if (buf && bufTabCount === expectedTabCount) rows.push(buf.split("\t"));
      buf = "";
      bufTabCount = 0;
      rows.push(line.split("\t"));
    } else {
      buf = buf ? `${buf}\n${line}` : line;
      bufTabCount += tc;
      if (bufTabCount === expectedTabCount) {
        rows.push(buf.split("\t"));
        buf = "";
        bufTabCount = 0;
      }
    }
  }

  if (buf && bufTabCount === expectedTabCount) rows.push(buf.split("\t"));

  return rows.length > 0
    ? rows
    : lines.filter((l) => l.length > 0).map((l) => l.split("\t"));
}

export function getIsInPopover(element: unknown): boolean {
  if (!(element instanceof Element)) return false;

  return (
    element.closest("[data-grid-cell-editor]") !== null ||
    element.closest("[data-grid-popover]") !== null ||
    element.closest("[data-slot='dropdown-menu-content']") !== null ||
    element.closest("[data-slot='popover-content']") !== null
  );
}

export function getColumnVariant(variant?: CellOpts["variant"]): {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
} | null {
  switch (variant) {
    case "short-text":
      return { label: "Short text", icon: BaselineIcon };
    case "long-text":
      return { label: "Long text", icon: TextInitialIcon };
    case "number":
      return { label: "Number", icon: HashIcon };
    case "url":
      return { label: "URL", icon: LinkIcon };
    case "checkbox":
      return { label: "Checkbox", icon: CheckSquareIcon };
    case "select":
      return { label: "Select", icon: ListIcon };
    case "multi-select":
      return { label: "Multi-select", icon: ListChecksIcon };
    case "date":
      return { label: "Date", icon: CalendarIcon };
    case "file":
      return { label: "File", icon: FileIcon };
    default:
      return null;
  }
}

export function getEmptyCellValue(
  variant: CellOpts["variant"] | undefined,
): unknown {
  if (variant === "multi-select" || variant === "file") return [];
  if (variant === "number" || variant === "date") return null;
  if (variant === "checkbox") return false;
  return "";
}

export function getUrlHref(urlString: string): string {
  if (!urlString || urlString.trim() === "") return "";

  const trimmed = urlString.trim();

  // Reject dangerous protocols (extra safety, though our http:// prefix would neutralize them)
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

export function parseLocalDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== "string") return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  // Verify date wasn't auto-corrected (e.g. Feb 30 -> Mar 1)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(dateStr: unknown): string {
  if (!dateStr) return "";
  const date = parseLocalDate(dateStr);
  if (!date) return typeof dateStr === "string" ? dateStr : "";
  return date.toLocaleDateString();
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0 || !Number.isFinite(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  );
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(
  type: string,
): React.ComponentType<React.SVGProps<SVGSVGElement>> {
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  if (type.includes("pdf")) return FileText;
  if (type.includes("zip") || type.includes("rar")) return FileArchive;
  if (
    type.includes("word") ||
    type.includes("document") ||
    type.includes("doc")
  )
    return FileText;
  if (type.includes("sheet") || type.includes("excel") || type.includes("xls"))
    return FileSpreadsheet;
  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    type.includes("ppt")
  )
    return Presentation;
  return File;
}
