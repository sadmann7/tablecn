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
 * to its base-tree counterpart when one exists. Files outside the bases (hooks,
 * lib) and primitives with no base variant stay shared, so base-agnostic code
 * lives in exactly one place.
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

import {
  type Base,
  BASES,
  DEFAULT_STYLE_ID,
  getStyleIds,
  STYLES,
} from "../src/registry/styles";
import { OUT_ROOT, STYLES_ROOT, wipeRegistryOutput } from "./clean-registry";

const DEFAULT_BASE = DEFAULT_STYLE_ID.split("-")[0] as Base;

const ROOT = process.cwd();
const RADIX_TREE = "src/registry/bases/radix/";
const BASE_TREE = "src/registry/bases/base/";

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
 * Repoints a file at the base tree when an override exists there.
 * `target` is deliberately untouched so consumers get the same paths either way.
 */
function resolveFile(file: RegistryFile, base: Base): RegistryFile {
  if (base === "radix") return file;

  const override = file.path.replace(RADIX_TREE, BASE_TREE);

  return existsSync(path.join(ROOT, override))
    ? { ...file, path: override }
    : file;
}

/**
 * Base UI is a peer of the base tree, not of registry.json, so the dependency is
 * added per item based on what its resolved files actually import.
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
    "@dnd-kit/core",
    "@dnd-kit/modifiers",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
    "cn",
    "zod",
  ] as const) {
    if (contents.some((content) => content.includes(`"${pkg}`))) {
      if (!next.includes(pkg)) next.push(pkg);
    }
  }

  return next.length > 0 ? next : dependencies;
}

function buildBase(base: Base, outDir: string) {
  const registry = JSON.parse(
    readFileSync(path.join(ROOT, "registry.json"), "utf8"),
  ) as Registry;

  const items = registry.items.map((item) => {
    const files = item.files?.map((file) => resolveFile(file, base));

    return {
      ...item,
      dependencies: withImportedDependencies(item.dependencies, files),
      files,
    };
  });

  const overrides = items.flatMap(
    (item) =>
      item.files?.filter((file) => file.path.startsWith(BASE_TREE)) ?? [],
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
  wipeRegistryOutput();
  mkdirSync(STYLES_ROOT, { recursive: true });

  const scratch = mkdtempSync(path.join(tmpdir(), "tablecn-registry-"));

  try {
    for (const base of BASES) {
      const baseDir = path.join(scratch, base);
      mkdirSync(baseDir, { recursive: true });

      const overrideCount = buildBase(base, baseDir);
      const built = path.join(baseDir, "r");

      for (const style of STYLES) {
        cpSync(built, path.join(STYLES_ROOT, `${base}-${style}`), {
          recursive: true,
        });
      }

      // Flat `/r/{name}.json` keeps serving the default base so existing
      // DiceUI redirects and style-less installs keep working.
      if (base === DEFAULT_BASE) {
        cpSync(built, OUT_ROOT, { recursive: true });
      }

      console.log(
        `${base}: ${overrideCount} base-tree file(s), ${STYLES.length} style ids`,
      );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  const ids = getStyleIds();

  writeFileSync(
    path.join(STYLES_ROOT, "index.json"),
    `${JSON.stringify(
      ids.map((name) => ({ name })),
      null,
      2,
    )}\n`,
  );

  console.log(
    `\nPublished ${ids.length} style ids (default: ${DEFAULT_BASE}).`,
  );
}

main();
