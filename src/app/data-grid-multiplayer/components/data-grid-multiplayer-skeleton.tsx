import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/components/data-grid/data-grid-skeleton";

export function DataGridMultiplayerSkeleton() {
  return (
    <DataGridSkeleton className="container flex flex-col gap-4 py-4">
      <DataGridSkeletonToolbar actionCount={5} />
      <DataGridSkeletonGrid />
    </DataGridSkeleton>
  );
}
