import { redirect } from "next/navigation";

import { DEFAULT_BASE } from "@/lib/constants";

export default function BasesIndexPage() {
  redirect(`/bases/${DEFAULT_BASE}`);
}
