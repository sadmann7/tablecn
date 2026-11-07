import { sql } from "drizzle-orm";

import { db } from ".";

export async function runExtensions() {
  console.log("⏳ Enabling extensions...");

  const start = Date.now();

  await db.execute(sql`create extension if not exists pg_trgm`);

  const end = Date.now();

  console.log(`✅ Extensions enabled in ${end - start}ms`);

  process.exit(0);
}

runExtensions().catch((error) => {
  console.error("❌ Enabling extensions failed");
  console.error(error);
  process.exit(1);
});
