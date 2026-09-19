"use client";

import { useMounted } from "@/hooks/use-mounted";
import { Fps } from "@/registry/bases/radix/ui/fps";
import { Skeleton } from "@/registry/bases/radix/ui/skeleton";

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
