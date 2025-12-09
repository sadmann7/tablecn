import { seedSkaters, seedTasks } from "@/app/lib/seeds";

const SEED_FUNCTIONS = {
  tasks: () => seedTasks({ count: 100 }),
  skaters: () => seedSkaters({ count: 100 }),
} as const;

type TableName = keyof typeof SEED_FUNCTIONS;
const ALL_TABLES = Object.keys(SEED_FUNCTIONS) as TableName[];

function parseArgs(): TableName[] {
  const args = process.argv.slice(2);

  if (args.length === 0) return ALL_TABLES;

  // Support both space-separated and comma-separated
  const tables = args
    .flatMap((arg) => arg.split(","))
    .map((t) => t.trim())
    .filter(Boolean) as TableName[];

  const invalid = tables.filter((t) => !(t in SEED_FUNCTIONS));

  if (invalid.length > 0) {
    console.error(`❌ Unknown table(s): ${invalid.join(", ")}`);
    console.log(`Available: ${ALL_TABLES.join(", ")}`);
    process.exit(1);
  }

  return tables;
}

async function runSeed() {
  const tables = parseArgs();

  console.log(`⏳ Seeding: ${tables.join(", ")}...`);

  const start = Date.now();

  for (const table of tables) {
    await SEED_FUNCTIONS[table]();
  }

  const end = Date.now();

  console.log(`✅ Seed completed in ${end - start}ms`);

  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Seed failed");
  console.error(err);
  process.exit(1);
});
