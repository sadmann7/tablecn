"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import * as React from "react";

import { type FilterFlag, filterFlags } from "@/lib/flag";

interface FeatureFlagsContextValue {
  filterFlag: FilterFlag | null;
  enableAdvancedFilter: boolean;
}

const FeatureFlagsContext =
  React.createContext<FeatureFlagsContextValue | null>(null);

export function useFeatureFlags() {
  const context = React.useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    );
  }
  return context;
}

export function useFilterFlag() {
  return useQueryState(
    "filterFlag",
    parseAsStringEnum<FilterFlag>(
      filterFlags.map((flag) => flag.value),
    ).withOptions({ shallow: false }),
  );
}

interface FeatureFlagsProviderProps {
  children: React.ReactNode;
}

export function FeatureFlagsProvider({ children }: FeatureFlagsProviderProps) {
  const [filterFlag] = useFilterFlag();

  const contextValue = React.useMemo<FeatureFlagsContextValue>(
    () => ({
      filterFlag,
      enableAdvancedFilter:
        filterFlag === "advancedFilters" || filterFlag === "commandFilters",
    }),
    [filterFlag],
  );

  return (
    <FeatureFlagsContext.Provider value={contextValue}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}
