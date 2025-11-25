"use client";

import * as React from "react";

type Direction = "ltr" | "rtl";

const DirectionContext = React.createContext<Direction | undefined>(undefined);

function useDirection(dir?: Direction): Direction {
  const contextDir = React.useContext(DirectionContext);
  return dir ?? contextDir ?? "ltr";
}

interface DirectionProviderProps {
  children: React.ReactNode;
  dir: Direction;
}

function DirectionProvider({ children, dir }: DirectionProviderProps) {
  return (
    <DirectionContext.Provider value={dir}>
      {children}
    </DirectionContext.Provider>
  );
}

export {
  DirectionProvider,
  useDirection,
  //
  type Direction,
};
