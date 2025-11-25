import * as React from "react";

type Direction = "ltr" | "rtl";

const DirectionContext = React.createContext<Direction | undefined>(undefined);

const DirectionProvider = DirectionContext.Provider;

function useDirection(dirProp?: Direction): Direction {
  const contextDir = React.useContext(DirectionContext);
  return dirProp ?? contextDir ?? "ltr";
}

export {
  useDirection,
  DirectionProvider,
  //
  type Direction,
};
