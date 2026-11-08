import type { Metadata } from "next";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { AriaDataTableDemo } from "../components/aria-data-table-demo";
import { BaseDataGridDemo } from "../components/base-data-grid-demo";
import { BaseDataTableDemo } from "../components/base-data-table-demo";
import { BasesControls } from "../components/bases-controls";
import { BasesView } from "../components/bases-view";
import { RadixDataGridDemo } from "../components/radix-data-grid-demo";
import { RadixDataTableDemo } from "../components/radix-data-table-demo";
import { type Base, BASES, getIsBase } from "../lib/data";

export const metadata: Metadata = {
  title: "Bases",
  description:
    "The same data table and data grid built on Radix UI, Base UI, and React Aria.",
};

const DEMOS: Record<
  Base,
  { table: React.ComponentType; grid: React.ComponentType | null }
> = {
  radix: { table: RadixDataTableDemo, grid: RadixDataGridDemo },
  base: { table: BaseDataTableDemo, grid: BaseDataGridDemo },
  aria: { table: AriaDataTableDemo, grid: null },
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
  if (!isDev || !getIsBase(base)) notFound();

  const { table: Table, grid: Grid } = DEMOS[base];

  return (
    <>
      <BasesControls base={base} />
      <BasesView table={<Table />} grid={Grid ? <Grid /> : null} />
    </>
  );
}
