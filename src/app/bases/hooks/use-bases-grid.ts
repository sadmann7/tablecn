import { useQueryStates } from "nuqs";
import * as React from "react";

import { generatePeople } from "../../data-grid/lib/seeds";
import { basesSearchParams } from "./use-bases-demo";

export function useBasesGrid() {
  const [{ dir }] = useQueryStates(basesSearchParams);
  const [data, setData] = React.useState(() => generatePeople(200));

  return { dir, data, setData };
}
