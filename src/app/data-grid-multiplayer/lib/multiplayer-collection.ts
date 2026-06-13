import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db";
import type { SkaterSchema } from "@/app/data-grid-live/lib/validation";

export const multiplayerCollection = createCollection(
  localOnlyCollectionOptions<SkaterSchema, string>({
    id: "multiplayer-skaters",
    getKey: (item: SkaterSchema) => item.id,
  }),
);

export function serializeSkater(row: SkaterSchema): Record<string, unknown> {
  return {
    ...row,
    startedSkating: row.startedSkating?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}
