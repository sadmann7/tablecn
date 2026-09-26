/**
 * Removes leftover generated registry files so a deleted item or old style
 * id cannot linger under `public/r` after the next build.
 *
 * `pnpm build:registry` wipes the output first, then regenerates. Generated
 * JSON under `public/r` is gitignored except `styles/index.json`. This script
 * is the standalone / surgical version: it keeps current items and only deletes
 * paths that are no longer expected.
 *
 *   pnpm clean:registry                remove stale files
 *   pnpm clean:registry -- --dry-run   print what would be removed
 *   pnpm clean:registry -- --all       wipe public/r entirely
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BASES } from "../registry/bases";
import { STYLES } from "../registry/styles";

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, "public/r");
const STYLES_ROOT = path.join(OUT_ROOT, "styles");

interface Registry {
  items: { name: string }[];
}

function getItemNames() {
  const registry = JSON.parse(
    readFileSync(path.join(ROOT, "registry.json"), "utf8"),
  ) as Registry;

  return registry.items.map((item) => item.name);
}

function getExpectedFiles() {
  const items = getItemNames();
  const files = new Set<string>([path.join(STYLES_ROOT, "index.json")]);

  for (const base of BASES) {
    for (const style of STYLES) {
      const styleId = `${base.name}-${style.name}`;
      files.add(path.join(STYLES_ROOT, styleId, "registry.json"));
      for (const name of items) {
        files.add(path.join(STYLES_ROOT, styleId, `${name}.json`));
      }
    }
  }

  return files;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const fullPath = path.join(dir, entry.name);
    return [fullPath, ...listDirs(fullPath)];
  });
}

function remove(target: string, dryRun: boolean, silent = false) {
  const relative = path.relative(ROOT, target);
  if (dryRun) {
    console.log(`  ✓ would remove ${relative}`);
    return;
  }
  rmSync(target, { recursive: true, force: true });
  if (!silent) console.log(`  ✓ Removed ${relative}`);
}

function wipeRegistryOutput(dryRun = false) {
  if (!existsSync(OUT_ROOT)) return 0;

  const entries = readdirSync(OUT_ROOT);
  for (const name of entries) {
    remove(path.join(OUT_ROOT, name), dryRun, !dryRun);
  }

  return entries.length;
}

function cleanStaleRegistryOutput(dryRun = false) {
  if (!existsSync(OUT_ROOT)) {
    console.log("📁 public/r is already empty. Nothing to clean.");
    return { files: 0, dirs: 0 };
  }

  const expected = getExpectedFiles();
  const staleFiles = listFiles(OUT_ROOT).filter((file) => !expected.has(file));

  if (staleFiles.length > 0) {
    console.log(
      `\n🗑️  ${dryRun ? "Would remove" : "Removing"} ${staleFiles.length} orphaned file(s)...`,
    );
  }

  for (const file of staleFiles) {
    remove(file, dryRun);
  }

  const expectedDirs = new Set([...expected].map((file) => path.dirname(file)));
  const staleDirs = listDirs(OUT_ROOT)
    .filter((dir) => !expectedDirs.has(dir))
    .sort((a, b) => b.length - a.length);

  const emptyDirs: string[] = [];
  for (const dir of staleDirs) {
    if (!existsSync(dir)) continue;
    if (readdirSync(dir).length > 0) continue;
    emptyDirs.push(dir);
    remove(dir, dryRun);
  }

  return { files: staleFiles.length, dirs: emptyDirs.length };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const wipeAll = args.has("--all");

  console.log(
    dryRun
      ? "🧹 Starting registry cleanup (dry run)..."
      : "🧹 Starting registry cleanup...",
  );

  if (wipeAll) {
    const removed = wipeRegistryOutput(dryRun);
    if (removed === 0) {
      console.log("📁 public/r is already empty. Nothing to clean.");
      return;
    }

    console.log(
      dryRun
        ? `\n🎉 Would wipe ${removed} entries from public/r.`
        : `\n🎉 Wiped ${removed} entries from public/r.`,
    );
    return;
  }

  const expectedStyleDirs = BASES.length * STYLES.length;
  const { files, dirs } = cleanStaleRegistryOutput(dryRun);
  const removed = files + dirs;

  if (removed === 0) {
    console.log("\n🎉 Cleanup completed! No stale registry files.");
  } else {
    console.log(
      `\n🎉 Cleanup completed! ${dryRun ? "Would remove" : "Removed"} ${removed} orphaned item(s).`,
    );
  }

  console.log("\n📊 Summary:");
  console.log(`  - Expected style directories: ${expectedStyleDirs}`);
  console.log(`  - Orphaned files ${dryRun ? "found" : "removed"}: ${files}`);
  console.log(`  - Empty directories ${dryRun ? "found" : "removed"}: ${dirs}`);
}

export { cleanStaleRegistryOutput, OUT_ROOT, STYLES_ROOT, wipeRegistryOutput };

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
}
