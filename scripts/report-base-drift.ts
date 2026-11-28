/**
 * Reports how far each component's base copies drift from the radix copy.
 *
 * Every file the registry ships from `src/registry/bases/radix` is compared
 * with its copy in each other base. Differences every base is expected to have
 * are left out first: imports, `"use client"`, indentation, lines of only
 * brackets or a closing tag, `asChild` against `render`, and the CSS variables and data
 * attributes of the primitive each base wraps. What's left is listed per component, as differing lines.
 *
 * It only reports and never fails, unlike `check:bases`.
 *
 *   pnpm report:bases                   table of the differing lines
 *   pnpm report:bases --json            the same numbers as JSON
 *   pnpm report:bases <file>            what's left for one file, like ui/faceted.tsx
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BASES } from "../registry/bases";
import { getChangedLines } from "./check-bases";

const ROOT = process.cwd();
const BASES_ROOT = path.join(ROOT, "src/registry/bases");
const RADIX = "radix";
const OTHER_BASES = BASES.map((base) => base.name).filter(
  (name) => name !== RADIX,
);

const COMPOSITION_LINE =
  /\basChild\b|\bSlot\b|\buseRender\b|\bmergeProps\b|\brender(\?)?\s*[=:,})]|^\s*render,?$/;
const PUNCTUATION_LINE = /^[\s{}()[\]<>/;,]*$|^<\/[\w.]+>$/;
const PRIMITIVE_TOKENS: [RegExp, string][] = [
  [/--radix-[\w-]+/g, "--<primitive-var>"],
  [
    /--(transform-origin|anchor-width|anchor-height|available-width|available-height|trigger-width)\b/g,
    "--<primitive-var>",
  ],
  [/data-\[state=(\w+)\]/g, "data-<$1>"],
  [/data-\[(\w+)\]/g, "data-<$1>"],
  [/data-popup-open\b/g, "data-<open>"],
  [/data-(open|closed|checked|unchecked|disabled|highlighted)\b/g, "data-<$1>"],
];

interface FileDrift {
  file: string;
  bases: Record<string, number | null>;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (file) printDetails(file);
  else if (args.includes("--json")) {
    console.log(JSON.stringify(getReport(), null, 2));
  } else printReport();
}

function printReport() {
  const report = getReport();
  const totals = getTotals(report);
  const lines = [
    "## Base drift",
    "",
    `Differing lines left after expected differences are removed, against radix. ${totals.summary}`,
    "",
    `| File | ${OTHER_BASES.join(" | ")} |`,
    `| --- | ${OTHER_BASES.map(() => "---:").join(" | ")} |`,
    ...report.map(
      ({ file, bases }) =>
        `| ${file} | ${OTHER_BASES.map((base) => formatCount(bases[base])).join(" | ")} |`,
    ),
    `| **Total** | ${OTHER_BASES.map((base) => `**${totals.byBase[base] ?? 0}**`).join(" | ")} |`,
    "",
  ];
  const output = lines.join("\n");
  console.log(output);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${output}\n`);
}

function printDetails(file: string) {
  for (const base of OTHER_BASES) {
    if (!existsSync(path.join(BASES_ROOT, base, file))) continue;
    const changes = getChangedLines(
      readComparable(RADIX, file),
      readComparable(base, file),
    );
    console.log(`\n${base}: ${file}: ${changes.length} differing lines`);
    for (const change of changes) console.log(`  ${change}`);
  }
}

export function getReport(): FileDrift[] {
  return getRegistryFiles().map((file) => ({
    file,
    bases: Object.fromEntries(
      OTHER_BASES.map((base) => [
        base,
        existsSync(path.join(BASES_ROOT, base, file))
          ? getChangedLines(
              readComparable(RADIX, file),
              readComparable(base, file),
            ).length
          : null,
      ]),
    ),
  }));
}

function getTotals(report: FileDrift[]) {
  const byBase: Record<string, number> = {};
  let compared = 0;
  let identical = 0;
  for (const { bases } of report) {
    for (const [base, count] of Object.entries(bases)) {
      if (count === null) continue;
      byBase[base] = (byBase[base] ?? 0) + count;
      compared++;
      if (count === 0) identical++;
    }
  }
  const total = Object.values(byBase).reduce((sum, count) => sum + count, 0);
  return {
    byBase,
    summary: `${identical} of ${compared} copies match, ${total} differing lines in all.`,
  };
}

function formatCount(count: number | null | undefined) {
  if (count === null || count === undefined) return "–";
  return count === 0 ? "✓" : String(count);
}

function getRegistryFiles() {
  const registry = JSON.parse(
    readFileSync(path.join(ROOT, "registry.json"), "utf8"),
  ) as { items: { files?: { path: string }[] }[] };
  const prefix = `src/registry/bases/${RADIX}/`;
  const files = registry.items
    .flatMap((item) => item.files ?? [])
    .map((file) => file.path)
    .filter((file) => file.startsWith(prefix))
    .map((file) => file.slice(prefix.length));
  return [...new Set(files)].sort();
}

function readComparable(base: string, file: string) {
  const source = readFileSync(path.join(BASES_ROOT, base, file), "utf8")
    .replaceAll(`bases/${base}/`, "bases/<base>/")
    .replace(/^import[\s\S]*?from\s+"[^"]+";$/gm, "")
    .replace(/^import\s+"[^"]+";$/gm, "")
    .replace(/^"use client";$/m, "");

  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => !PUNCTUATION_LINE.test(line) && !COMPOSITION_LINE.test(line),
    )
    .map((line) =>
      PRIMITIVE_TOKENS.reduce(
        (next, [pattern, token]) => next.replace(pattern, token),
        line,
      ),
    );
}
