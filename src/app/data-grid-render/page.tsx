"use client";

import { Fps } from "@/components/ui/fps";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/hooks/use-mounted";
import { DataGridRenderDemo } from "./components/data-grid-render-demo";

export default function DataGridRenderPage() {
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
      <DataGridRenderDemo />
    </>
  );
}
