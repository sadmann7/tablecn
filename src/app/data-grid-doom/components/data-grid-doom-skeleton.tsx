export function DataGridDoomSkeleton() {
  return (
    <div className="container flex min-h-[calc(100dvh-3.5rem-1px)] flex-col items-center justify-center pt-7 pb-4">
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
