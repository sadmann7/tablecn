import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  real,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { pgTable } from "@/db/utils";

import { generateId } from "@/lib/id";
import type { FileCellData } from "@/types/data-grid";

// For data-table
export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  code: varchar("code", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 128 }),
  status: varchar("status", {
    length: 30,
    enum: ["todo", "in-progress", "done", "canceled"],
  })
    .notNull()
    .default("todo"),
  priority: varchar("priority", {
    length: 30,
    enum: ["low", "medium", "high"],
  })
    .notNull()
    .default("low"),
  label: varchar("label", {
    length: 30,
    enum: ["bug", "feature", "enhancement", "documentation"],
  })
    .notNull()
    .default("bug"),
  estimatedHours: real("estimated_hours").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

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
  media: jsonb("media").$type<Array<FileCellData>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export type Skater = typeof skaters.$inferSelect;
export type NewSkater = typeof skaters.$inferInsert;
