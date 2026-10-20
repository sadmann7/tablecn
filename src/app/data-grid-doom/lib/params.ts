import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./doom";

export const RESOLUTIONS = [40, 64, 80, 106, 128, 160, 192, 320] as const;
export const NATIVE_RESOLUTION = 320;

export function getResolutionLabel(columns: number) {
  const rows = Math.round((columns * SCREEN_HEIGHT) / SCREEN_WIDTH);
  return `${columns}×${rows}${columns === NATIVE_RESOLUTION ? " (native)" : ""}`;
}

// res=40|64|80|106|128|160|192|320 (columns, 16:10), mode=data|dom|gradient, source=doom|plasma, damage (plasma only), auto=1 to expose measurements
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
    damage: Number(params.get("damage") ?? 1),
    auto: params.get("auto") === "1",
  } as const;
}

export type DoomParams = ReturnType<typeof getDoomParams>;
