/**
 * Keeps the registry copies of every base from drifting apart.
 *
 * Each file under `src/registry/bases/radix` is compared with its counterpart
 * under every other base in `registry/bases.ts`, after import paths are
 * normalized. The expected difference of every pair is recorded per base in
 * `registry/base-differences.json`: `"identical"` for copies, or a hash of the
 * lines that differ on purpose (like Radix and Base UI APIs). Editing one copy
 * without the others changes that difference and fails the check.
 *
 *   pnpm check:bases                  fail on drift and print the difference
 *   pnpm check:bases --update         record the current differences
 *   pnpm sync:bases                   copy radix to the other bases for identical files
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BASES } from "../registry/bases";

const ROOT = process.cwd();
const BASES_ROOT = path.join(ROOT, "src/registry/bases");
const SNAPSHOT_PATH = path.join(ROOT, "registry/base-differences.json");
const RADIX = "radix";
const OTHER_BASES = BASES.map((base) => base.name).filter(
  (name) => name !== RADIX,
);

type PairState = "identical" | (string & {});

type Snapshot = Record<string, Record<string, PairState>>;

interface Pair {
  base: string;
  file: string;
  state: PairState;
  changes: string[];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  if (args.includes("--sync")) syncBases();
  else if (args.includes("--update")) updateSnapshot();
  else checkBases();
}

function checkBases() {
  const snapshot = readSnapshot();
  const pairs = OTHER_BASES.flatMap(getPairs);
  const drifted = pairs.filter(
    ({ base, file, state }) => snapshot[base]?.[file] !== state,
  );
  const removed = Object.entries(snapshot).flatMap(([base, files]) =>
    Object.keys(files)
      .filter(
        (file) =>
          !pairs.some((pair) => pair.base === base && pair.file === file),
      )
      .map((file) => `${base}: ${file}`),
  );

  for (const { base, file, state, changes } of drifted) {
    const expected = snapshot[base]?.[file] ?? "missing";
    console.error(`\n${base}: ${file}: expected ${expected}, found ${state}`);
    for (const change of changes) console.error(`  ${change}`);
  }
  for (const entry of removed) {
    console.error(
      `\n${entry}: in base-differences.json but no longer in radix or that base`,
    );
  }

  if (drifted.length > 0 || removed.length > 0) {
    console.error(
      "\nThe base copies drifted. Sync them (`pnpm sync:bases` copies radix to the other bases for identical files), or run `pnpm check:bases --update` if the difference is intended.",
    );
    process.exit(1);
  }
  console.log(
    `Checked ${pairs.length} files: radix and ${OTHER_BASES.join(", ")} are in sync`,
  );
}

function updateSnapshot() {
  const snapshot: Snapshot = Object.fromEntries(
    OTHER_BASES.map((base) => [
      base,
      Object.fromEntries(
        getPairs(base).map(({ file, state }) => [file, state]),
      ),
    ]),
  );
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  const count = Object.values(snapshot).reduce(
    (total, files) => total + Object.keys(files).length,
    0,
  );
  console.log(`Recorded ${count} files in base-differences.json`);
}

function syncBases() {
  const snapshot = readSnapshot();
  let count = 0;
  for (const base of OTHER_BASES) {
    for (const [file, state] of Object.entries(snapshot[base] ?? {})) {
      if (state !== "identical") continue;
      const radixPath = path.join(BASES_ROOT, RADIX, file);
      const basePath = path.join(BASES_ROOT, base, file);
      const next = readFileSync(radixPath, "utf8").replaceAll(
        `bases/${RADIX}/`,
        `bases/${base}/`,
      );
      if (readFileSync(basePath, "utf8") === next) continue;
      writeFileSync(basePath, next);
      console.log(`Synced ${base}: ${file}`);
      count++;
    }
  }
  console.log(`Synced ${count} files from radix to ${OTHER_BASES.join(", ")}`);
}

function readSnapshot(): Snapshot {
  if (!existsSync(SNAPSHOT_PATH)) return {};
  return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
}

function getPairs(base: string): Pair[] {
  const radixFiles = new Set(listFiles(path.join(BASES_ROOT, RADIX)));
  const baseFiles = new Set(listFiles(path.join(BASES_ROOT, base)));
  const files = [...new Set([...radixFiles, ...baseFiles])].sort();

  return files.map((file) => {
    if (!baseFiles.has(file)) {
      return { base, file, state: `${RADIX}-only`, changes: [] };
    }
    if (!radixFiles.has(file)) {
      return { base, file, state: `${base}-only`, changes: [] };
    }
    const changes = getChangedLines(
      readNormalized(RADIX, file),
      readNormalized(base, file),
    );
    const state: PairState =
      changes.length === 0
        ? "identical"
        : createHash("sha1")
            .update(changes.join("\n"))
            .digest("hex")
            .slice(0, 12);
    return { base, file, state, changes };
  });
}

function listFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const relativePath = prefix ? `${prefix}/${name}` : name;
    return statSync(path.join(dir, name)).isDirectory()
      ? listFiles(path.join(dir, name), relativePath)
      : [relativePath];
  });
}

function readNormalized(base: string, file: string) {
  return readFileSync(path.join(BASES_ROOT, base, file), "utf8")
    .replaceAll(`bases/${base}/`, "bases/<base>/")
    .split("\n");
}

function getChangedLines(from: string[], to: string[]) {
  let start = 0;
  while (
    start < from.length &&
    start < to.length &&
    from[start] === to[start]
  ) {
    start++;
  }
  let fromEnd = from.length;
  let toEnd = to.length;
  while (
    fromEnd > start &&
    toEnd > start &&
    from[fromEnd - 1] === to[toEnd - 1]
  ) {
    fromEnd--;
    toEnd--;
  }

  const a = from.slice(start, fromEnd);
  const b = to.slice(start, toEnd);
  const width = b.length + 1;
  const lengths = new Int32Array((a.length + 1) * width);
  const getLength = (i: number, j: number) => lengths[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] =
        a[i] === b[j]
          ? getLength(i + 1, j + 1) + 1
          : Math.max(getLength(i + 1, j), getLength(i, j + 1));
    }
  }

  const changes: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (
      j >= b.length ||
      (i < a.length && getLength(i + 1, j) >= getLength(i, j + 1))
    ) {
      changes.push(`- ${a[i++]}`);
    } else {
      changes.push(`+ ${b[j++]}`);
    }
  }
  return changes;
}
