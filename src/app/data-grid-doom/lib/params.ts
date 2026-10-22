import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./doom";

export const RESOLUTIONS = [40, 64, 80, 106, 128, 160, 192, 320] as const;
export const NATIVE_RESOLUTION = 320;

export function getResolutionLabel(columns: number) {
  const rows = Math.round((columns * SCREEN_HEIGHT) / SCREEN_WIDTH);
  return `${columns}×${rows}${columns === NATIVE_RESOLUTION ? " (native)" : ""}`;
}

// The share of rows the plasma benchmark changes each frame, from just over 0 to all of them
function getDamage(value: string | null) {
  const damage = Number(value ?? 1);
  return Number.isFinite(damage) && damage > 0 ? Math.min(damage, 1) : 1;
}

// res=40|64|80|106|128|160|192|320 (columns, 16:10), mode=data|dom|gradient, source=doom|plasma, damage (plasma only), auto=1 to expose measurements, grid=1 to start with the grid shown
export function getDoomParams(params: Pick<URLSearchParams, "get">) {
  const res = Number(params.get("res") ?? NATIVE_RESOLUTION);
  const columns = (RESOLUTIONS as readonly number[]).includes(res)
    ? res
    : NATIVE_RESOLUTION;
  const modeParam = params.get("mode");
  const mode =
    modeParam === "data" || modeParam === "dom" || modeParam === "gradient"
      ? modeParam
      : columns === NATIVE_RESOLUTION
        ? "gradient"
        : "dom";

  return {
    columns,
    mode,
    // Resolution links keep an explicit mode but let the per-resolution default apply otherwise
    modeParam: mode === modeParam ? modeParam : null,
    source: params.get("source") === "plasma" ? "plasma" : "doom",
    damage: getDamage(params.get("damage")),
    auto: params.get("auto") === "1",
    grid: params.get("grid") === "1",
  } as const;
}

export type DoomParams = ReturnType<typeof getDoomParams>;
