import { useQueryStates } from "nuqs";
import * as React from "react";

import { getBasesGridFixture } from "../lib/data-grid-fixtures";
import { basesSearchParams } from "../lib/search-params";

export function useBasesDataGrid() {
  const [{ dir, data: dataMode }] = useQueryStates(basesSearchParams);
  const [{ rows, ...fixture }] = React.useState(() =>
    getBasesGridFixture(dataMode ?? "demo"),
  );
  const [data, setData] = React.useState(rows);

  return { dir, data, setData, ...fixture };
}
