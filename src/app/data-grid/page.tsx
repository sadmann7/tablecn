import { Suspense } from "react";

import { DataGridDemo } from "./components/data-grid-demo";
import { DataGridDemoSkeleton } from "./components/data-grid-demo-skeleton";

export default async function DataGridPage() {
  return (
    <>
      <h1 className="sr-only">Data Grid</h1>
      <Suspense fallback={<DataGridDemoSkeleton />}>
        <DataGridDemo />
      </Suspense>
    </>
  );
}
