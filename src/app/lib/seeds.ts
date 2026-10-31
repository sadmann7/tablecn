import { db } from "@/db/index";
import { tasks } from "@/db/schema";

import { generateRandomTasks } from "./utils";

export async function seedTasks(input: { count: number }) {
  try {
    const allTasks = generateRandomTasks(input.count);

    await db.delete(tasks);

    console.log("📝 Inserting tasks", allTasks.length);

    await db.insert(tasks).values(allTasks).onConflictDoNothing();
  } catch (error) {
    console.error(error);
  }
}
