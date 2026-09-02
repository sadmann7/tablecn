import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  metaHelper,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";
import type { DataGridColumnMeta, DataGridTableMeta } from "@/types/data-grid";

export const dataGridFeatures = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataGridTableMeta>(),
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
