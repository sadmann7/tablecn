import { db } from "@/db/index";
import { type Employee, employees, type Task, tasks } from "@/db/schema";

import { generateRandomEmployee, generateRandomTask } from "./utils";

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

export async function seedEmployees(input: { count: number }) {
  const count = input.count ?? 100;

  try {
    const allEmployees: Employee[] = [];

    for (let i = 0; i < count; i++) {
      allEmployees.push(generateRandomEmployee());
    }

    await db.delete(employees);

    console.log("👥 Inserting employees", allEmployees.length);

    await db.insert(employees).values(allEmployees).onConflictDoNothing();
  } catch (err) {
    console.error(err);
  }
}
