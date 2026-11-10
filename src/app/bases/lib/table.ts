import { defineDataTable } from "@/lib/data-table-definition";

import { tasksTable } from "../../lib/validations";

export const basesTasksTable = defineDataTable({
  columns: tasksTable.columns,
  defaultSorting: tasksTable.defaultSorting,
});
