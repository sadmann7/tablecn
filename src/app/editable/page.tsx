import { DataGridDemo } from "@/components/data-grid/data-grid-demo";
import { Shell } from "@/components/shell";

export default async function EditablePage() {
  return (
    <Shell className="gap-2">
      <DataGridDemo />
    </Shell>
  );
}
