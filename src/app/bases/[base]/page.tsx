import type { Metadata } from "next";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { AriaDataTable } from "../components/aria-data-table";
import { BaseDataGrid } from "../components/base-data-grid";
import { BaseDataTable } from "../components/base-data-table";
import { BasesControls } from "../components/bases-controls";
import { BasesView } from "../components/bases-view";
import { RadixDataGrid } from "../components/radix-data-grid";
import { RadixDataTable } from "../components/radix-data-table";
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
  radix: { table: RadixDataTable, grid: RadixDataGrid },
  base: { table: BaseDataTable, grid: BaseDataGrid },
  aria: { table: AriaDataTable, grid: null },
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
