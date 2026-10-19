import type { SkaterSchema } from "./validation";

// Orders are fractional, so a row inserted below another sits halfway to the next one
export function getInsertOrder(skaters: SkaterSchema[], afterRowId?: string) {
  const maxOrder = skaters.reduce(
    (max, skater) => Math.max(max, skater.order),
    0,
  );
  const anchor = afterRowId
    ? skaters.find((skater) => skater.id === afterRowId)
    : undefined;
  if (!anchor) return maxOrder + 1;

  const nextOrder = skaters.reduce(
    (next, skater) =>
      skater.order > anchor.order && skater.order < next ? skater.order : next,
    Number.POSITIVE_INFINITY,
  );
  return nextOrder === Number.POSITIVE_INFINITY
    ? anchor.order + 1
    : (anchor.order + nextOrder) / 2;
}
