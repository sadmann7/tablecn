import { createDataTableConfig } from "@/lib/data-table-config";

import { tasksTableConfig } from "../../lib/validations";

export const basesTasksTableConfig = createDataTableConfig({
  columns: tasksTableConfig.columns,
  defaultSorting: tasksTableConfig.defaultSorting,
});
