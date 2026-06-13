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
