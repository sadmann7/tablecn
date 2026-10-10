import type {
  CellSelectionBounds,
  CellSelectionState,
  Column,
  RowData,
  Table,
} from "@tanstack/react-table";
import type * as React from "react";

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

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type {
  CellOpts,
  CellPosition,
  FileCellData,
  RowHeightValue,
} from "@/lib/data-grid-types";

const DOMAIN_REGEX = /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/;
const TRUTHY_BOOLEANS = new Set(["true", "1", "yes", "checked"]);
const VALID_BOOLEANS = new Set([
  "true",
  "false",
  "1",
  "0",
  "yes",
  "no",
  "checked",
  "unchecked",
]);

// Unit separator, so row ids and column ids may contain any printable character
const CELL_KEY_SEPARATOR = "\u001f";

// Overlay scrollbars take no layout space, so presses this close to the edge are treated as scrollbar presses
const SCROLLBAR_HITBOX_SIZE = 16;

const ROW_HEIGHTS: Record<RowHeightValue, number> = {
  short: 36,
  medium: 56,
  tall: 76,
  "extra-tall": 96,
};

const LINE_COUNTS: Record<RowHeightValue, number> = {
  short: 1,
  medium: 2,
  tall: 3,
  "extra-tall": 4,
};

export function stringifyUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
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

export function getTextCellValue(value: unknown): string {
  return stringifyUnknown(value);
}

export function getNumberCellValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function getBooleanCellValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return TRUTHY_BOOLEANS.has(value.toLowerCase());
  }
  return value === 1;
}

export function getDateCellValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateToString(value);
  }
  return "";
}

export function getOptionCellValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function getOptionsCellValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function getFilesCellValue(value: unknown): FileCellData[] {
  return Array.isArray(value) ? value.filter(getIsFileCellData) : [];
}

export function getEmptyCellValue(
  variant: CellOpts["variant"] | undefined,
): unknown {
  if (variant === "multi-select" || variant === "file") return [];
  if (variant === "number" || variant === "date" || variant === "select")
    return null;
  if (variant === "checkbox") return false;
  return "";
}

export function serializeCellValue(
  value: unknown,
  variant: CellOpts["variant"] | undefined,
): string {
  if (variant === "file" || variant === "multi-select") {
    return value ? JSON.stringify(value) : "";
  }
  if (value instanceof Date) return value.toISOString();
  return stringifyUnknown(value);
}

function matchSelectOption(
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

function parseTextValue(text: string): unknown {
  if (ISO_DATE_REGEX.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }

  const firstChar = text[0];
  if (
    firstChar !== "[" &&
    firstChar !== "{" &&
    firstChar !== "t" &&
    firstChar !== "f"
  ) {
    return text;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && parsed.every(getIsFileCellData)) {
        return parsed.map((file) => file.name).join(", ");
      }
      if (parsed.every((item) => typeof item === "string")) {
        return parsed.join(", ");
      }
    } else if (typeof parsed === "boolean") {
      return parsed ? "Checked" : "Unchecked";
    }
  } catch {
    const lower = text.toLowerCase();
    if (lower === "true" || lower === "false") {
      return lower === "true" ? "Checked" : "Unchecked";
    }
  }
  return text;
}

function parseMultiSelectValues(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fall back to comma separated values
  }
  return text ? text.split(",").map((item) => item.trim()) : [];
}

export function parsePastedCellValue(
  text: string,
  cellOpts: CellOpts | undefined,
): { value: unknown } | null {
  switch (cellOpts?.variant) {
    case "number": {
      if (!text) return { value: null };
      const num = Number.parseFloat(text);
      return Number.isNaN(num) ? null : { value: num };
    }
    case "checkbox": {
      if (!text) return { value: false };
      const lower = text.toLowerCase();
      return VALID_BOOLEANS.has(lower)
        ? { value: TRUTHY_BOOLEANS.has(lower) }
        : null;
    }
    case "date": {
      if (!text) return { value: null };
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : { value: date };
    }
    case "select": {
      if (!text) return { value: null };
      const matched = matchSelectOption(text, cellOpts.options);
      return matched ? { value: matched } : null;
    }
    case "multi-select": {
      const values = parseMultiSelectValues(text);
      const validated = values.flatMap((item) => {
        const matched = matchSelectOption(item, cellOpts.options);
        return matched ? [matched] : [];
      });
      return values.length > 0 && validated.length === 0
        ? null
        : { value: validated };
    }
    case "file": {
      if (!text) return { value: [] };
      try {
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) return null;
        const validFiles = parsed.filter(getIsFileCellData);
        return parsed.length > 0 && validFiles.length === 0
          ? null
          : { value: validFiles };
      } catch {
        return null;
      }
    }
    case "url": {
      if (!text) return { value: "" };
      if (text[0] === "[" || text[0] === "{") return null;
      try {
        new URL(text);
        return { value: text };
      } catch {
        return DOMAIN_REGEX.test(text) ? { value: text } : null;
      }
    }
    default:
      return { value: text ? parseTextValue(text) : "" };
  }
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

  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
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

export function getCellKey(rowId: string, columnId: string) {
  return `${rowId}${CELL_KEY_SEPARATOR}${columnId}`;
}

export function parseCellKey(cellKey: string): CellPosition {
  const separatorIndex = cellKey.indexOf(CELL_KEY_SEPARATOR);
  if (separatorIndex === -1) return { rowId: "", columnId: "" };
  return {
    rowId: cellKey.slice(0, separatorIndex),
    columnId: cellKey.slice(separatorIndex + CELL_KEY_SEPARATOR.length),
  };
}

export function getRowCellSelectionKey(
  bounds: Array<CellSelectionBounds>,
  rowIndex: number,
) {
  let key = "";
  for (const bound of bounds) {
    if (rowIndex < bound.minRowIndex || rowIndex > bound.maxRowIndex) continue;
    key += `${bound.minColumnIndex}:${bound.maxColumnIndex},`;
  }
  return key;
}

function getActiveCellRange(ranges: CellSelectionState) {
  return ranges[ranges.length - 1] ?? null;
}

export function getFocusedCellPosition(
  ranges: CellSelectionState,
): CellPosition | null {
  const range = getActiveCellRange(ranges);
  return range
    ? { rowId: range.anchorRowId, columnId: range.anchorColumnId }
    : null;
}

export function getSelectionEdgePosition(
  ranges: CellSelectionState,
): CellPosition | null {
  const range = getActiveCellRange(ranges);
  return range
    ? { rowId: range.focusRowId, columnId: range.focusColumnId }
    : null;
}

export function getHasCellRangeSelection(ranges: CellSelectionState) {
  const range = getActiveCellRange(ranges);
  if (!range) return false;
  return (
    ranges.length > 1 ||
    range.anchorRowId !== range.focusRowId ||
    range.anchorColumnId !== range.focusColumnId
  );
}

export function getIsDataColumn(
  column: { columnDef: { enableCellSelection?: boolean } } | undefined,
) {
  return column?.columnDef.enableCellSelection !== false;
}

export function getRowIndexById<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  rowId: string,
) {
  return table.getRowModel().rowsById[rowId]?.getDisplayIndex() ?? -1;
}

export function getTabTargetCell(params: {
  rowIndex: number;
  columnId: string;
  columnIds: string[];
  rowCount: number;
  isBackward: boolean;
  getIsColumnTabbable?: (columnId: string) => boolean;
}): { rowIndex: number; columnId: string } | null {
  const {
    rowIndex,
    columnId,
    columnIds,
    rowCount,
    isBackward,
    getIsColumnTabbable = () => true,
  } = params;
  const colIndex = columnIds.indexOf(columnId);
  if (colIndex === -1 || !columnIds.some(getIsColumnTabbable)) return null;

  const step = isBackward ? -1 : 1;
  let nextRowIndex = rowIndex;
  let nextColIndex = colIndex;

  while (true) {
    nextColIndex += step;
    if (nextColIndex >= columnIds.length) {
      nextColIndex = 0;
      nextRowIndex++;
    } else if (nextColIndex < 0) {
      nextColIndex = columnIds.length - 1;
      nextRowIndex--;
    }

    if (nextRowIndex < 0 || nextRowIndex >= rowCount) return null;

    const nextColumnId = columnIds[nextColIndex];
    if (nextColumnId && getIsColumnTabbable(nextColumnId)) {
      return { rowIndex: nextRowIndex, columnId: nextColumnId };
    }
  }
}

export function swapItems<T>(items: Array<T>, first: T, second: T) {
  return items.map((item) => {
    if (item === first) return second;
    if (item === second) return first;
    return item;
  });
}

export function getRowHeightValue(rowHeight: RowHeightValue): number {
  return ROW_HEIGHTS[rowHeight];
}

export function getLineCount(rowHeight: RowHeightValue): number {
  return LINE_COUNTS[rowHeight];
}

export function getColumnBorderVisibility<TData extends RowData>(params: {
  column: Column<DataGridFeatures, TData>;
  nextColumn?: Column<DataGridFeatures, TData>;
}): {
  showEndBorder: boolean;
  showStartBorder: boolean;
} {
  const { column, nextColumn } = params;

  const isPinned = column.getIsPinned();
  const isFirstRightPinnedColumn =
    isPinned === "end" && column.getIsFirstColumn("end");
  const isLastRightPinnedColumn =
    isPinned === "end" && column.getIsLastColumn("end");

  const nextIsPinned = nextColumn?.getIsPinned();
  const isBeforeRightPinned =
    nextIsPinned === "end" && nextColumn?.getIsFirstColumn("end");

  const showEndBorder = !isBeforeRightPinned && !isLastRightPinnedColumn;

  const showStartBorder = isFirstRightPinnedColumn;

  return {
    showEndBorder,
    showStartBorder,
  };
}

export function getColumnPinningStyle<TData extends RowData>(params: {
  column: Column<DataGridFeatures, TData>;
}): React.CSSProperties {
  const { column } = params;

  const isPinned = column.getIsPinned();

  return {
    insetInlineStart:
      isPinned === "start" ? `${column.getStart("start")}px` : undefined,
    insetInlineEnd:
      isPinned === "end" ? `${column.getAfter("end")}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: "var(--background)",
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

export function getColumnFitSize(params: {
  gridElement: HTMLElement;
  columnId: string;
  minSize: number;
  maxSize: number;
  wrapperContentSize?: number;
}): number | null {
  const {
    gridElement,
    columnId,
    minSize,
    maxSize,
    wrapperContentSize = 0,
  } = params;
  const cellElements = gridElement.querySelectorAll<HTMLElement>(
    `:is([data-slot="data-grid-header-cell"], [data-slot="data-grid-cell"])[data-column-id="${CSS.escape(columnId)}"]`,
  );
  if (cellElements.length === 0) return null;

  let cellChromeSize = 0;
  for (const cellElement of cellElements) {
    const wrapperElement = cellElement.querySelector<HTMLElement>(
      '[data-slot="data-grid-cell-wrapper"]',
    );
    if (!wrapperElement) continue;
    cellChromeSize =
      cellElement.getBoundingClientRect().width - wrapperElement.clientWidth;
    break;
  }

  const measurer = document.createElement("div");
  measurer.setAttribute("aria-hidden", "true");
  Object.assign(measurer.style, {
    position: "absolute",
    top: "0",
    insetInlineStart: "0",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    visibility: "hidden",
    pointerEvents: "none",
    contain: "layout style",
  });

  for (const cellElement of cellElements) {
    const clone = cellElement.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    Object.assign(clone.style, {
      position: "static",
      width: "max-content",
      minWidth: "0",
      maxWidth: "none",
    });
    for (const element of clone.querySelectorAll<HTMLElement>("*")) {
      element.style.whiteSpace = "nowrap";
      element.style.flexWrap = "nowrap";
      element.style.webkitLineClamp = "unset";
    }
    measurer.append(clone);
  }

  gridElement.append(measurer);
  let contentSize =
    wrapperContentSize > 0 ? wrapperContentSize + cellChromeSize : 0;
  for (const clone of measurer.children) {
    contentSize = Math.max(contentSize, clone.getBoundingClientRect().width);
  }
  measurer.remove();

  return Math.min(maxSize, Math.max(minSize, Math.ceil(contentSize)));
}

export function scrollCellIntoView<TData extends RowData>(params: {
  container: HTMLDivElement;
  targetCell: HTMLDivElement;
  tableRef: React.RefObject<Table<DataGridFeatures, TData> | null>;
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
  const leftPinnedColumns = currentTable?.getStartVisibleLeafColumns() ?? [];
  const rightPinnedColumns = currentTable?.getEndVisibleLeafColumns() ?? [];

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

function escapeAttributeValue(value: string) {
  return value.replace(/["\\]/g, "\\$&");
}

export function getColumnLabel<TData extends RowData, TValue = unknown>(
  column: Column<DataGridFeatures, TData, TValue>,
): string {
  const { header, meta } = column.columnDef;
  if (meta?.label) return meta.label;
  return typeof header === "string" ? header : column.id;
}

export function getCellElement(
  container: HTMLElement,
  rowId: string,
  columnId: string,
) {
  return container.querySelector<HTMLDivElement>(
    `[data-row-id="${escapeAttributeValue(rowId)}"][data-column-id="${escapeAttributeValue(columnId)}"]`,
  );
}

export function getCellFocusTarget(cellElement: HTMLElement): HTMLElement {
  if (cellElement.dataset.slot === "data-grid-cell-wrapper") return cellElement;
  return (
    cellElement.querySelector<HTMLElement>(
      'button, a[href], [role="checkbox"]',
    ) ?? cellElement
  );
}

export function getIsInPopover(element: unknown): boolean {
  if (!(element instanceof Element)) return false;

  return (
    element.closest("[data-grid-cell-editor]") !== null ||
    element.closest("[data-grid-popover]") !== null ||
    element.closest("[data-slot='dropdown-menu-content']") !== null ||
    element.closest("[data-slot='popover-content']") !== null ||
    element.closest("[data-slot='select-content']") !== null ||
    element.closest("[data-slot='faceted-content']") !== null
  );
}

export function getIsPointOnScrollbar(
  container: HTMLElement | null,
  clientX: number,
  clientY: number,
): boolean {
  if (!container) return false;

  const rect = container.getBoundingClientRect();
  const isRtl = getComputedStyle(container).direction === "rtl";

  if (container.scrollHeight > container.clientHeight) {
    const edgeDistance = isRtl ? clientX - rect.left : rect.right - clientX;
    if (edgeDistance >= 0 && edgeDistance <= SCROLLBAR_HITBOX_SIZE) return true;
  }

  if (container.scrollWidth > container.clientWidth) {
    const edgeDistance = rect.bottom - clientY;
    if (edgeDistance >= 0 && edgeDistance <= SCROLLBAR_HITBOX_SIZE) return true;
  }

  return false;
}

export function getIsEventOnScrollbar(
  event: React.MouseEvent<HTMLElement>,
): boolean {
  return getIsPointOnScrollbar(
    event.currentTarget.closest<HTMLElement>('[data-slot="data-grid"]'),
    event.clientX,
    event.clientY,
  );
}

function execInsertText(text: string) {
  return (
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text)
  );
}

function dispatchInsertTextInput(element: HTMLElement, text: string) {
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: text,
      inputType: "insertText",
    }),
  );
}

export function insertTextAtSelection(
  element: HTMLTextAreaElement | HTMLInputElement,
  text: string,
) {
  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? start;
  element.focus();
  element.setSelectionRange(start, end);

  const valueBeforeInsert = element.value;

  const inserted = execInsertText(text);
  if (inserted && element.value !== valueBeforeInsert) return;

  element.setRangeText(text, start, end, "end");
  dispatchInsertTextInput(element, text);
}

export function replaceEditableText(element: HTMLElement, text: string) {
  element.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const textBeforeInsert = element.textContent;
  const inserted = execInsertText(text);
  if (inserted && element.textContent !== textBeforeInsert) return;

  element.textContent = text;
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  dispatchInsertTextInput(element, text);
}

export function flexRender<TProps extends object>(
  Comp: ((props: TProps) => React.ReactNode) | string | undefined,
  props: TProps,
): React.ReactNode {
  if (typeof Comp === "string") {
    return Comp;
  }
  return Comp?.(props);
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
