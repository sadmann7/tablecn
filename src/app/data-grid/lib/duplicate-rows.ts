import type { Row, Table } from "@tanstack/react-table";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { generateId } from "@/lib/id";

import type { Person } from "./seeds";

export function duplicateRows(
  table: Table<DataGridFeatures, Person>,
  rows: Row<DataGridFeatures, Person>[],
) {
  for (const row of rows) {
    table.addRows([{ ...row.original, id: generateId() }], {
      afterRowId: row.id,
    });
  }
}
