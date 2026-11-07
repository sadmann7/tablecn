import { notFound, redirect } from "next/navigation";

import { DEFAULT_BASE } from "@/lib/constants";

export default function BasesIndexPage() {
  // Local-only page for checking the bases side by side
  if (process.env.NODE_ENV !== "development") notFound();
  redirect(`/bases/${DEFAULT_BASE}`);
}
