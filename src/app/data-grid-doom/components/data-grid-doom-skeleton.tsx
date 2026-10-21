// Matches the demo's loading overlay without a stage: the stage's size depends on the resolution and the device's pixel ratio
export function DataGridDoomSkeleton() {
  return (
    // The bottom padding stands in for the toolbar under the stage, so the text lands where the overlay's does
    <div className="container flex min-h-[calc(100dvh-3.5rem-1px)] flex-col items-center justify-center pt-4 pb-[calc(1rem+66px)]">
      <DataGridDoomLoading />
    </div>
  );
}

export function DataGridDoomLoading() {
  return (
    <span className="flex flex-col items-center gap-1 text-center">
      <span className="text-lg font-medium">Loading DOOM…</span>
      <span className="text-sm text-balance text-muted-foreground">
        Fetching the shareware episode
      </span>
    </span>
  );
}
