import {
  DataGridSkeleton,
  DataGridSkeletonGrid,
  DataGridSkeletonToolbar,
} from "@/registry/bases/radix/components/data-grid/data-grid-skeleton";

export function DataGridLiveSkeleton() {
  return (
    <DataGridSkeleton className="container flex flex-col gap-4 py-4">
      <DataGridSkeletonToolbar actionCount={4} />
      <DataGridSkeletonGrid />
    </DataGridSkeleton>
  );
}
