import { db } from "@/db/index";
import { type Skater, skaters } from "@/db/schema";

import { generateRandomSkater } from "./utils";

export async function seedSkaters(input: { count: number }) {
  const count = input.count ?? 100;

  try {
    const allSkaters: Skater[] = [];

    for (let i = 0; i < count; i++) {
      allSkaters.push(generateRandomSkater({ order: i }));
    }

    await db.delete(skaters);

    console.log("🛹 Inserting skaters", allSkaters.length);

    await db.insert(skaters).values(allSkaters).onConflictDoNothing();
  } catch (err) {
    console.error(err);
  }
}
