/**
 * Builds the registry once per base, then fans each build out to every
 * `{base}-{style}` id that shadcn publishes.
 *
 * Styles are purely CSS for our components, so the JSON for a given base is
 * byte-identical across styles. The per-style copies exist so the `{style}`
 * placeholder in a consumer's registry URL resolves for every official style id
 * instead of 404ing.
 *
 * Base resolution: a file is taken from the base tree when a counterpart exists
 * there, otherwise it falls back to the app source. That keeps base-agnostic
 * files (hooks, lib, calendar/command/input consumers) in exactly one place.
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

const DEFAULT_BASE = DEFAULT_STYLE_ID.split("-")[0] as Base;

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, "public/r");
const STYLES_ROOT = path.join(OUT_ROOT, "styles");
const BASE_TREE = "src/registry/bases/base";

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

  const override = file.path.replace(/^src\//, `${BASE_TREE}/`);

  return existsSync(path.join(ROOT, override))
    ? { ...file, path: override }
    : file;
}

/**
 * Base UI is a peer of the base tree, not of registry.json, so the dependency is
 * added per item based on what its resolved files actually import.
 */
function withBaseUiDependency(
  dependencies: string[] | undefined,
  files: RegistryFile[] | undefined,
) {
  const importsBaseUi = files?.some((file) =>
    readFileSync(path.join(ROOT, file.path), "utf8").includes(
      '"@base-ui/react',
    ),
  );

  if (!importsBaseUi) return dependencies;

  const next = dependencies ?? [];

  return next.includes("@base-ui/react") ? next : [...next, "@base-ui/react"];
}

function buildBase(base: Base, outDir: string) {
  const registry = JSON.parse(
    readFileSync(path.join(ROOT, "registry.json"), "utf8"),
  ) as Registry;

  const items = registry.items.map((item) => {
    const files = item.files?.map((file) => resolveFile(file, base));

    return {
      ...item,
      dependencies: withBaseUiDependency(item.dependencies, files),
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
  rmSync(STYLES_ROOT, { recursive: true, force: true });
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
