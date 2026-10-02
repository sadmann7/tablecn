import type { Metadata } from "next";

import { Suspense } from "react";

import { LaunchDemo } from "./components/launch-demo";
import "./launch.css";

export const metadata: Metadata = {
  title: "Launch",
  description: "A self-playing launch demo of the tablecn data table.",
};

export default function LaunchPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-black" />}>
      <LaunchDemo />
    </Suspense>
  );
}
