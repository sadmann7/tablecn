import { seedTasks } from "@/app/lib/seeds";

async function runSeed() {
  console.log("⏳ Running seed...");

  const start = Date.now();

  await seedTasks({ count: 100 });

  const end = Date.now();

  console.log(`✅ Seed completed in ${end - start}ms`);

  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Seed failed");
  console.error(err);
  process.exit(1);
});
