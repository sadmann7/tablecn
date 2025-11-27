import * as React from "react";

function useMounted() {
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

export { useMounted };
