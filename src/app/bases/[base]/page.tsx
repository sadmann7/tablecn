import type { Metadata } from "next";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { AriaBasesDemo } from "../components/aria-bases-demo";
import { BaseBasesDemo } from "../components/base-bases-demo";
import { BaseBasesGrid } from "../components/base-bases-grid";
import { BasesControls } from "../components/bases-controls";
import { BasesView } from "../components/bases-view";
import { RadixBasesDemo } from "../components/radix-bases-demo";
import { RadixBasesGrid } from "../components/radix-bases-grid";
import { type Base, BASES, isBase } from "../lib/data";

export const metadata: Metadata = {
  title: "Bases",
  description:
    "The same data table and data grid built on Radix UI, Base UI, and React Aria.",
};

const DEMOS: Record<
  Base,
  { table: React.ComponentType; grid: React.ComponentType | null }
> = {
  radix: { table: RadixBasesDemo, grid: RadixBasesGrid },
  base: { table: BaseBasesDemo, grid: BaseBasesGrid },
  aria: { table: AriaBasesDemo, grid: null },
};

interface BasesPageProps {
  params: Promise<{ base: string }>;
}

export function generateStaticParams() {
  return BASES.map((base) => ({ base: base.value }));
}

export default function BasesPage({ params }: BasesPageProps) {
  return (
    <div className="container flex flex-col gap-4 py-4">
      <h1 className="sr-only">Bases</h1>
      <Suspense
        fallback={
          <DataTableSkeleton
            columnCount={7}
            filterCount={2}
            cellWidths={[
              "10rem",
              "30rem",
              "10rem",
              "10rem",
              "6rem",
              "6rem",
              "6rem",
            ]}
            shrinkZero
          />
        }
      >
        <BasesContent params={params} />
      </Suspense>
    </div>
  );
}

const isDev = process.env.NODE_ENV === "development";

async function BasesContent({ params }: BasesPageProps) {
  const { base } = await params;
  if (!isDev || !isBase(base)) notFound();

  const { table: Table, grid: Grid } = DEMOS[base];

  return (
    <>
      <BasesControls base={base} />
      <BasesView table={<Table />} grid={Grid ? <Grid /> : null} />
    </>
  );
}
