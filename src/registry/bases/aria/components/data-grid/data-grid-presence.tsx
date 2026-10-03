"use client";

import * as React from "react";

interface DataGridCellPresence {
  color: string;
  name: string;
}

const DataGridCellPresenceContext = React.createContext<Map<
  string,
  DataGridCellPresence
> | null>(null);

interface DataGridPresenceProviderProps {
  value: Map<string, DataGridCellPresence>;
  children: React.ReactNode;
}

function DataGridPresenceProvider({
  value,
  children,
}: DataGridPresenceProviderProps) {
  return (
    <DataGridCellPresenceContext.Provider value={value}>
      {children}
    </DataGridCellPresenceContext.Provider>
  );
}

function useDataGridPresence(cellKey: string): DataGridCellPresence | null {
  const map = React.useContext(DataGridCellPresenceContext);
  return map?.get(cellKey) ?? null;
}

export {
  type DataGridCellPresence,
  DataGridPresenceProvider,
  useDataGridPresence,
};
