import { db } from "@/db/index";
import { type Skater, skaters, type Task, tasks } from "@/db/schema";

import { generateRandomSkater, generateRandomTask } from "./utils";

export async function seedTasks(input: { count: number }) {
  const count = input.count ?? 100;

  try {
    const allTasks: Task[] = [];

    for (let i = 0; i < count; i++) {
      allTasks.push(generateRandomTask());
    }

    await db.delete(tasks);

    console.log("📝 Inserting tasks", allTasks.length);

    await db.insert(tasks).values(allTasks).onConflictDoNothing();
  } catch (err) {
    console.error(err);
  }
}

export async function seedSkaters(input: { count: number }) {
  const count = input.count ?? 100;

  try {
    const allSkaters: Skater[] = [];

    for (let i = 0; i < count; i++) {
      allSkaters.push(generateRandomSkater());
    }

    await db.delete(skaters);

    console.log("🛹 Inserting skaters", allSkaters.length);

    await db.insert(skaters).values(allSkaters).onConflictDoNothing();
  } catch (err) {
    console.error(err);
  }
}
