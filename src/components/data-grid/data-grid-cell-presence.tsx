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

interface DataGridCellPresenceProviderProps {
  value: Map<string, DataGridCellPresence>;
  children: React.ReactNode;
}

function DataGridCellPresenceProvider({
  value,
  children,
}: DataGridCellPresenceProviderProps) {
  return (
    <DataGridCellPresenceContext.Provider value={value}>
      {children}
    </DataGridCellPresenceContext.Provider>
  );
}

function useDataGridCellPresence(cellKey: string): DataGridCellPresence | null {
  const map = React.useContext(DataGridCellPresenceContext);
  return map?.get(cellKey) ?? null;
}

export {
  DataGridCellPresenceProvider,
  useDataGridCellPresence,
  type DataGridCellPresence,
};
