/**
 * Builds the registry once per base, then fans each build out to every
 * `{base}-{style}` id that shadcn publishes.
 *
 * Styles are purely CSS for our components, so the JSON for a given base is
 * byte-identical across styles. The per-style copies exist so the `{style}`
 * placeholder in a consumer's registry URL resolves for every official style id
 * instead of 404ing. They are written to `public/r` at build time and are not
 * committed — same as shadcn's `registry:build` on deploy.
 *
 * Base resolution: registry.json points at the radix tree, and a file is swapped
 * to its counterpart in the built base's tree (`src/registry/bases/<base>/`)
 * when one exists. Files outside the bases (hooks, lib) and primitives with no
 * base variant stay shared, so base-agnostic code lives in exactly one place.
 *
 * @see https://github.com/shadcn-ui/ui/blob/main/apps/v4/scripts/build-registry.mts
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { BASES } from "../registry/bases";
import { STYLES } from "../registry/styles";
import { DEFAULT_BASE } from "../src/lib/constants";
import { OUT_ROOT, STYLES_ROOT, wipeRegistryOutput } from "./clean-registry";

const STYLE_COMBINATIONS = BASES.flatMap((base) =>
  STYLES.map((style) => ({
    base,
    style,
    name: `${base.name}-${style.name}`,
    title: `${base.title} ${style.title}`,
  })),
);

const ROOT = process.cwd();

function baseTree(baseName: string) {
  return `src/registry/bases/${baseName}/`;
}

interface RegistryFile {
  path: string;
  target?: string;
  type: string;
}

interface RegistryItem {
  name: string;
  dependencies?: string[];
  files?: RegistryFile[];
}

interface Registry {
  items: RegistryItem[];
}

/**
 * Repoints a file at the built base's tree when an override exists there.
 * `target` is deliberately untouched so consumers get the same paths either way.
 */
function resolveFile(file: RegistryFile, baseName: string): RegistryFile {
  if (baseName === "radix") return file;

  const override = file.path.replace(baseTree("radix"), baseTree(baseName));

  return existsSync(path.join(ROOT, override))
    ? { ...file, path: override }
    : file;
}

/**
 * A file imports a package when it names it exactly or a subpath of it; a bare
 * prefix would make `"react-aria` match `"react-aria-components`.
 */
function importsPackage(content: string, pkg: string) {
  return content.includes(`"${pkg}"`) || content.includes(`"${pkg}/`);
}

/**
 * Base UI and React Aria are peers of their base trees, not of registry.json, so
 * each dependency is added per item based on what its resolved files actually
 * import.
 */
function withImportedDependencies(
  dependencies: string[] | undefined,
  files: RegistryFile[] | undefined,
) {
  const contents =
    files?.map((file) => readFileSync(path.join(ROOT, file.path), "utf8")) ??
    [];

  const next = [...(dependencies ?? [])];

  for (const pkg of [
    "@base-ui/react",
    "@base-ui/utils",
    "react-aria-components",
    "@internationalized/date",
    "@dnd-kit/core",
    "@dnd-kit/modifiers",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
    "cn",
    "zod",
  ] as const) {
    if (contents.some((content) => importsPackage(content, pkg))) {
      if (!next.includes(pkg)) next.push(pkg);
    }
  }

  return next.length > 0 ? next : dependencies;
}

function buildBase(baseName: string, outDir: string) {
  const registry = JSON.parse(
    readFileSync(path.join(ROOT, "registry.json"), "utf8"),
  ) as Registry;

  const items = registry.items.map((item) => {
    const files = item.files?.map((file) => resolveFile(file, baseName));

    return {
      ...item,
      dependencies: withImportedDependencies(item.dependencies, files),
      files,
    };
  });

  const overrides = items.flatMap(
    (item) =>
      item.files?.filter((file) => file.path.startsWith(baseTree(baseName))) ??
      [],
  );

  const registryPath = path.join(outDir, "registry.input.json");
  writeFileSync(registryPath, JSON.stringify({ ...registry, items }, null, 2));

  execFileSync(
    path.join(ROOT, "node_modules/.bin/shadcn"),
    ["build", registryPath, "--output", path.join(outDir, "r")],
    { cwd: ROOT, stdio: "inherit" },
  );

  return overrides.length;
}

function main() {
  const totalStart = performance.now();

  console.log("🧹 Cleaning registry output...");
  wipeRegistryOutput();
  mkdirSync(STYLES_ROOT, { recursive: true });

  const scratch = mkdtempSync(path.join(tmpdir(), "tablecn-registry-"));

  try {
    console.log(`💅 Building ${STYLE_COMBINATIONS.length} style variants...`);

    for (const base of BASES) {
      const baseDir = path.join(scratch, base.name);
      mkdirSync(baseDir, { recursive: true });

      buildBase(base.name, baseDir);
      const built = path.join(baseDir, "r");

      for (const style of STYLES) {
        cpSync(built, path.join(STYLES_ROOT, `${base.name}-${style.name}`), {
          recursive: true,
        });
      }

      // Flat `/r/{name}.json` keeps serving the default base so existing
      // DiceUI redirects and style-less installs keep working.
      if (base.name === DEFAULT_BASE) {
        cpSync(built, OUT_ROOT, { recursive: true });
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  for (const style of STYLE_COMBINATIONS) {
    console.log(`   ✅ ${style.name}`);
  }

  console.log("📦 Writing styles index...");
  writeFileSync(
    path.join(STYLES_ROOT, "index.json"),
    `${JSON.stringify(
      STYLE_COMBINATIONS.map(({ name }) => ({ name })),
      null,
      2,
    )}\n`,
  );

  const elapsed = ((performance.now() - totalStart) / 1000).toFixed(2);
  console.log(`\n✅ Build complete in ${elapsed}s!`);
}

try {
  main();
} catch (error) {
  console.error("❌ Registry build failed:", error);
  process.exit(1);
}
