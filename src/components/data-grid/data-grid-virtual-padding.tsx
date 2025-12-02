export function DataGridVirtualPadding({
  children,
  virtualPaddingLeft,
  virtualPaddingRight,
}: {
  children: React.ReactNode;
  virtualPaddingLeft?: number;
  virtualPaddingRight?: number;
}) {
  return (
    <>
      {virtualPaddingLeft ? (
        <div
          role="presentation"
          aria-hidden
          style={{ width: virtualPaddingLeft, display: "flex" }}
        />
      ) : null}
      {children}
      {virtualPaddingRight ? (
        <div
          role="presentation"
          aria-hidden
          style={{ width: virtualPaddingRight, display: "flex" }}
        />
      ) : null}
    </>
  );
}
