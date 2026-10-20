"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { getDoomParams } from "../lib/params";
import { DataGridDoomSkeleton } from "./data-grid-doom-skeleton";

const DataGridDoomDemo = dynamic(
  () => import("./data-grid-doom-demo").then((mod) => mod.DataGridDoomDemo),
  {
    ssr: false,
    loading: () => <DataGridDoomSkeleton />,
  },
);

export function DataGridDoomPlayer() {
  const searchParams = useSearchParams();

  return <DataGridDoomDemo {...getDoomParams(searchParams)} />;
}
