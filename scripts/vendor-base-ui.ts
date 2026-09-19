/**
 * Vendors shadcn's published Base UI primitives into the base registry tree.
 *
 * These files are a type harness: they let the Base UI copies of our components
 * compile against the real Base UI APIs. They are never listed in registry.json,
 * so consumers keep getting their own primitives via registryDependencies.
 *
 * Re-run after a shadcn release to pick up upstream primitive changes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE_STYLE = "base-nova";

const PRIMITIVES = [
  "badge",
  "button",
  "dropdown-menu",
  "label",
  "popover",
  "select",
  "separator",
  "slider",
];

const OUT = path.join(process.cwd(), "src/registry/bases/base/components/ui");

interface RegistryItem {
  files?: { path: string; content?: string }[];
}

async function vendor(name: string) {
  const url = `https://ui.shadcn.com/r/styles/${SOURCE_STYLE}/${name}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${name}: ${response.status} ${response.statusText}`);
  }

  const item = (await response.json()) as RegistryItem;
  const content = item.files?.[0]?.content;

  if (!content) throw new Error(`${name}: no file content in ${url}`);

  const source = content
    // Upstream imports cn from the `cn` package; this repo owns it in lib/utils.
    .replaceAll('from "cn"', 'from "@/lib/utils"')
    // IconPlaceholder lives in shadcn's docs app, not in their registry output.
    .replaceAll(
      'from "@/app/(create)/components/icon-placeholder"',
      'from "@/registry/bases/base/components/ui/icon-placeholder"',
    );

  writeFileSync(path.join(OUT, `${name}.tsx`), source);
  console.log(`  ${name}.tsx`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log(`Vendoring ${SOURCE_STYLE} primitives...`);

  for (const name of PRIMITIVES) {
    await vendor(name);
  }

  console.log(`\nVendored ${PRIMITIVES.length} primitives.`);
}

await main();
