"use client";

import { DataGridRenderTest } from "@/components/data-grid/data-grid-render-test";
import { Fps } from "@/components/ui/fps";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/hooks/use-mounted";

export default function RenderTestPage() {
  const mounted = useMounted();

  if (!mounted)
    return (
      <div className="container flex h-[calc(100dvh-5rem)] py-8">
        <Skeleton className="size-full" />
      </div>
    );

  return (
    <>
      <Fps strategy="fixed" />
      <DataGridRenderTest />
    </>
  );
}
