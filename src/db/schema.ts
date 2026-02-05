import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { pgTable } from "@/db/utils";

import { generateId } from "@/lib/id";
import type { FileCellData } from "@/types/data-grid";

// For data-grid-live
export const skaters = pgTable("skaters", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  order: integer("order").notNull().default(0),
  name: varchar("name", { length: 128 }),
  email: varchar("email", { length: 256 }),
  stance: varchar("stance", {
    length: 30,
    enum: ["regular", "goofy"],
  })
    .notNull()
    .default("regular"),
  style: varchar("style", {
    length: 30,
    enum: ["street", "vert", "park", "freestyle", "all-around"],
  })
    .notNull()
    .default("street"),
  status: varchar("status", {
    length: 30,
    enum: ["amateur", "sponsored", "pro", "legend"],
  })
    .notNull()
    .default("amateur"),
  yearsSkating: integer("years_skating").notNull().default(0),
  startedSkating: timestamp("started_skating"),
  isPro: boolean("is_pro").notNull().default(false),
  tricks: jsonb("tricks").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export type Skater = typeof skaters.$inferSelect;
export type NewSkater = typeof skaters.$inferInsert;
