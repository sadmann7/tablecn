import { sql } from "drizzle-orm";
import { boolean, index, real, timestamp, varchar } from "drizzle-orm/pg-core";

import { pgTable } from "@/db/utils";
import { generateId } from "@/lib/id";

// For data-table
export const tasks = pgTable(
  "tasks",
  {
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
  },
  (table) => [
    index("tablecn_tasks_title_trgm_idx").using(
      "gin",
      table.title.op("gin_trgm_ops"),
    ),
    index("tablecn_tasks_code_trgm_idx").using(
      "gin",
      table.code.op("gin_trgm_ops"),
    ),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
