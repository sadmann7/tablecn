/**
 * Keeps the radix and base registry copies from drifting apart.
 *
 * Each file under `src/registry/bases/radix` is compared with its counterpart
 * under `src/registry/bases/base`, after import paths are normalized. The
 * expected difference of every pair is recorded in `scripts/bases.json`:
 * `"identical"` for copies, or a hash of the lines that differ on purpose
 * (like Radix and Base UI APIs). Editing one copy without the other changes
 * that difference and fails the check.
 *
 *   pnpm check:bases                  fail on drift and print the difference
 *   pnpm check:bases --update         record the current differences
 *   pnpm sync:bases                   copy radix to base for identical files
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

const ROOT = process.cwd();
const BASES_ROOT = path.join(ROOT, "src/registry/bases");
const SNAPSHOT_PATH = path.join(ROOT, "scripts/bases.json");
const RADIX = "radix";
const BASE = "base";

type PairState = "identical" | "radix-only" | "base-only" | (string & {});

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  if (args.includes("--sync")) syncBases();
  else if (args.includes("--update")) updateSnapshot();
  else checkBases();
}

function checkBases() {
  const snapshot = readSnapshot();
  const pairs = getPairs();
  const drifted = pairs.filter(({ file, state }) => snapshot[file] !== state);
  const removed = Object.keys(snapshot).filter(
    (file) => !pairs.some((pair) => pair.file === file),
  );

  for (const { file, state, changes } of drifted) {
    const expected = snapshot[file] ?? "missing";
    console.error(`\n${file}: expected ${expected}, found ${state}`);
    for (const change of changes) console.error(`  ${change}`);
  }
  for (const file of removed) {
    console.error(`\n${file}: in bases.json but no longer in either base`);
  }

  if (drifted.length > 0 || removed.length > 0) {
    console.error(
      "\nThe radix and base copies drifted. Sync them (`pnpm sync:bases` copies radix to base for identical files), or run `pnpm check:bases --update` if the difference is intended.",
    );
    process.exit(1);
  }
  console.log(`Checked ${pairs.length} files: radix and base are in sync`);
}

function updateSnapshot() {
  const snapshot = Object.fromEntries(
    getPairs().map(({ file, state }) => [file, state]),
  );
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(snapshot).length} files in bases.json`);
}

function syncBases() {
  const snapshot = readSnapshot();
  let count = 0;
  for (const [file, state] of Object.entries(snapshot)) {
    if (state !== "identical") continue;
    const radixPath = path.join(BASES_ROOT, RADIX, file);
    const basePath = path.join(BASES_ROOT, BASE, file);
    const next = readFileSync(radixPath, "utf8").replaceAll(
      `bases/${RADIX}/`,
      `bases/${BASE}/`,
    );
    if (readFileSync(basePath, "utf8") === next) continue;
    writeFileSync(basePath, next);
    console.log(`Synced ${file}`);
    count++;
  }
  console.log(`Synced ${count} files from radix to base`);
}

function readSnapshot(): Record<string, PairState> {
  if (!existsSync(SNAPSHOT_PATH)) return {};
  return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
}

function getPairs() {
  const radixFiles = new Set(listFiles(path.join(BASES_ROOT, RADIX)));
  const baseFiles = new Set(listFiles(path.join(BASES_ROOT, BASE)));
  const files = [...new Set([...radixFiles, ...baseFiles])].sort();

  return files.map((file) => {
    if (!baseFiles.has(file)) {
      return { file, state: "radix-only", changes: [] };
    }
    if (!radixFiles.has(file)) {
      return { file, state: "base-only", changes: [] };
    }
    const changes = getChangedLines(
      readNormalized(RADIX, file),
      readNormalized(BASE, file),
    );
    const state: PairState =
      changes.length === 0
        ? "identical"
        : createHash("sha1")
            .update(changes.join("\n"))
            .digest("hex")
            .slice(0, 12);
    return { file, state, changes };
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
