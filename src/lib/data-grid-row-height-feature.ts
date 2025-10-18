import type {
  OnChangeFn,
  RowData,
  Table,
  TableFeature,
  Updater,
} from "@tanstack/react-table";
import { functionalUpdate, makeStateUpdater } from "@tanstack/react-table";

export type RowHeightValue = "short" | "medium" | "tall" | "extra-tall";

export interface RowHeightTableState {
  rowHeight: RowHeightValue;
}

export interface RowHeightOptions {
  enableRowHeight?: boolean;
  onRowHeightChange?: OnChangeFn<RowHeightValue>;
}

export interface RowHeightInstance {
  setRowHeight: (updater: Updater<RowHeightValue>) => void;
  toggleRowHeight: (value?: RowHeightValue) => void;
}

declare module "@tanstack/react-table" {
  interface TableState extends RowHeightTableState {}
  interface InitialTableState extends Partial<RowHeightTableState> {}
  // biome-ignore lint/correctness/noUnusedVariables: TData is required for declaration merging
  interface TableOptionsResolved<TData extends RowData>
    extends RowHeightOptions {}
  // biome-ignore lint/correctness/noUnusedVariables: TData is required for declaration merging
  interface Table<TData extends RowData> extends RowHeightInstance {}
}

export const RowHeightFeature: TableFeature<unknown> = {
  getInitialState: (state): RowHeightTableState => {
    return {
      rowHeight: "short",
      ...state,
    };
  },

  getDefaultOptions: (table: Table<RowData>): RowHeightOptions => {
    return {
      enableRowHeight: true,
      onRowHeightChange: makeStateUpdater("rowHeight", table),
    };
  },

  createTable: (table: Table<RowData>): void => {
    table.setRowHeight = (updater) => {
      const safeUpdater: Updater<RowHeightValue> = (old) => {
        const newState = functionalUpdate(updater, old);
        return newState;
      };
      return table.options.onRowHeightChange?.(safeUpdater);
    };

    table.toggleRowHeight = (value) => {
      table.setRowHeight((old) => {
        if (value) return value;
        return old === "short"
          ? "medium"
          : old === "medium"
            ? "tall"
            : old === "tall"
              ? "extra-tall"
              : "short";
      });
    };
  },
};

export function getRowHeightValue(rowHeight: RowHeightValue): number {
  switch (rowHeight) {
    case "short":
      return 36; // 1 line of text
    case "medium":
      return 56; // 2 lines of text
    case "tall":
      return 76; // 3 lines of text
    case "extra-tall":
      return 96; // 4 lines of text
    default:
      return 36;
  }
}

export function getRowHeightPadding(rowHeight: RowHeightValue): string {
  switch (rowHeight) {
    case "short":
      return "6px 12px";
    case "medium":
      return "8px 12px";
    case "tall":
      return "8px 12px";
    case "extra-tall":
      return "8px 12px";
    default:
      return "6px 12px";
  }
}
