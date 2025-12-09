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
export const employees = pgTable("employees", {
  id: varchar("id", { length: 30 })
    .$defaultFn(() => generateId())
    .primaryKey(),
  name: varchar("name", { length: 128 }),
  email: varchar("email", { length: 256 }),
  department: varchar("department", {
    length: 30,
    enum: ["engineering", "marketing", "sales", "hr", "finance"],
  })
    .notNull()
    .default("engineering"),
  role: varchar("role", {
    length: 30,
    enum: ["admin", "manager", "developer", "designer", "analyst"],
  })
    .notNull()
    .default("developer"),
  status: varchar("status", {
    length: 30,
    enum: ["active", "inactive", "on-leave", "remote"],
  })
    .notNull()
    .default("active"),
  salary: integer("salary").notNull().default(0),
  startDate: timestamp("start_date"),
  isVerified: boolean("is_verified").notNull().default(false),
  skills: jsonb("skills").$type<string[]>(),
  documents:
    jsonb("documents").$type<
      Array<{
        id: string;
        name: string;
        size: number;
        type: string;
        url?: string;
      }>
    >(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`current_timestamp`)
    .$onUpdate(() => new Date()),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
