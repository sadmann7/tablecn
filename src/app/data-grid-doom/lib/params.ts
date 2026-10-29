import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./doom";

export const RESOLUTIONS = [40, 64, 80, 106, 128, 160, 192, 320] as const;
export const NATIVE_RESOLUTION = 320;
const DEFAULT_RESOLUTION = 192;

export function getResolutionLabel(columnCount: number) {
  const rowCount = Math.round((columnCount * SCREEN_HEIGHT) / SCREEN_WIDTH);
  return `${columnCount}×${rowCount}${columnCount === NATIVE_RESOLUTION ? " (native)" : ""}`;
}

// The share of rows the plasma benchmark changes each frame, from just over 0 to all of them
function getDamage(value: string | null) {
  const damage = Number(value ?? 1);
  return Number.isFinite(damage) && damage > 0 ? Math.min(damage, 1) : 1;
}

// res=40|64|80|106|128|160|192|320 (columns, 16:10), mode=data|dom|gradient, source=doom|plasma, damage (plasma only), auto=1 to expose measurements, grid=1 to start with the grid shown
export function getDoomParams(params: Pick<URLSearchParams, "get">) {
  const res = Number(params.get("res") ?? DEFAULT_RESOLUTION);
  const columnCount = (RESOLUTIONS as readonly number[]).includes(res)
    ? res
    : DEFAULT_RESOLUTION;
  const modeParam = params.get("mode");
  const mode =
    modeParam === "data" || modeParam === "dom" || modeParam === "gradient"
      ? modeParam
      : columnCount === NATIVE_RESOLUTION
        ? "gradient"
        : "data";

  return {
    columnCount,
    mode,
    source: params.get("source") === "plasma" ? "plasma" : "doom",
    damage: getDamage(params.get("damage")),
    auto: params.get("auto") === "1",
    grid: params.get("grid") === "1",
  } as const;
}

export type DoomParams = ReturnType<typeof getDoomParams>;
