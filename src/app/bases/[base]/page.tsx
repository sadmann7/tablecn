import type { Metadata } from "next";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DataTableSkeleton } from "@/registry/bases/radix/components/data-table/data-table-skeleton";

import { AriaBasesDemo } from "../components/aria-bases-demo";
import { BaseBasesDemo } from "../components/base-bases-demo";
import { BasesControls } from "../components/bases-controls";
import { RadixBasesDemo } from "../components/radix-bases-demo";
import { type Base, BASES, isBase } from "../lib/data";

export const metadata: Metadata = {
  title: "Bases",
  description:
    "The same data table built on Radix UI, Base UI, and React Aria.",
};

const DEMOS: Record<Base, React.ComponentType> = {
  radix: RadixBasesDemo,
  base: BaseBasesDemo,
  aria: AriaBasesDemo,
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

async function BasesContent({ params }: BasesPageProps) {
  const { base } = await params;
  if (!isBase(base)) notFound();

  const Demo = DEMOS[base];

  return (
    <>
      <BasesControls base={base} />
      <Demo />
    </>
  );
}
