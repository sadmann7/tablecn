export function getPlasmaColor(x: number, y: number, t: number) {
  const wave =
    Math.sin(x * 0.17 + t) +
    Math.sin(y * 0.13 + t * 1.3) +
    Math.sin((x + y) * 0.11 + t * 0.7) +
    Math.sin(Math.hypot(x - 40, y - 25) * 0.2 - t * 1.7);
  const paletteIndex = Math.floor(((wave + 4) / 8) * 255) & 255;
  const angle = (paletteIndex / 256) * Math.PI * 2;
  const r = Math.round(128 + 127 * Math.sin(angle));
  const g = Math.round(128 + 127 * Math.sin(angle + 2));
  const b = Math.round(128 + 127 * Math.sin(angle + 4));
  return (r << 16) | (g << 8) | b;
}

const hexColorCache = new Map<number, string>();

export function getHexColor(rgb: number) {
  let color = hexColorCache.get(rgb);
  if (color === undefined) {
    color = `#${rgb.toString(16).padStart(6, "0")}`;
    hexColorCache.set(rgb, color);
  }
  return color;
}
