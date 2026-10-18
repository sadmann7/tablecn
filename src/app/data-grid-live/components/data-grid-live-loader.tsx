"use client";

import dynamic from "next/dynamic";

import { DataGridLiveSkeleton } from "./data-grid-live-skeleton";

// Client only: the live query needs a server snapshot, and the collection's preload fetch fails while prerendering
export const DataGridLiveLoader = dynamic(
  () => import("./data-grid-live-demo").then((mod) => mod.DataGridLiveDemo),
  { ssr: false, loading: () => <DataGridLiveSkeleton /> },
);
