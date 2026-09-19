/**
 * The style ids we publish, shared by the registry build and the Next rewrites so
 * the two can't drift.
 *
 * shadcn composes a style id as `{base}-{style}`. Upstream ships three bases
 * (`radix`, `base`, `aria`); we author two of them, so `aria-*` and any legacy
 * v3 id (`new-york`, `default`) fall back to the default base at the routing
 * layer rather than 404ing.
 */
const BASES = ["radix", "base"] as const;

const STYLES = [
  "nova",
  "vega",
  "maia",
  "lyra",
  "mira",
  "luma",
  "sera",
  "rhea",
] as const;

type Base = (typeof BASES)[number];
type Style = (typeof STYLES)[number];

/** Must match `style` in components.json; also what flat `/r/{name}.json` serves. */
const DEFAULT_STYLE_ID = "radix-nova";

function getStyleIds() {
  return BASES.flatMap((base) => STYLES.map((style) => `${base}-${style}`));
}

export { type Base, BASES, DEFAULT_STYLE_ID, getStyleIds, type Style, STYLES };
