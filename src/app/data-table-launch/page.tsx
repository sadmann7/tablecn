import type { Metadata } from "next";

import { Suspense } from "react";

import { DataTableLaunchDemo } from "./components/data-table-launch-demo";
import "./data-table-launch.css";

export const metadata: Metadata = {
  title: "Data Table Launch",
  description: "A self-playing launch demo of the tablecn data table.",
};

export default function DataTableLaunchPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-black" />}>
      <DataTableLaunchDemo />
    </Suspense>
  );
}
