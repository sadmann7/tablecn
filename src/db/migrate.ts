import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db } from ".";

export async function runMigrate() {
  console.log("⏳ Running migrations...");

  const start = Date.now();

  await migrate(db, { migrationsFolder: "drizzle" });

  const end = Date.now();

  console.log(`✅ Migrations completed in ${end - start}ms`);

  process.exit(0);
}

runMigrate().catch((error) => {
  console.error("❌ Migration failed");
  console.error(error);
  process.exit(1);
});
