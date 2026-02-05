import type { Config } from "drizzle-kit";

import { DATABASE_PREFIX } from "@/lib/constants";

export default {
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: [`${DATABASE_PREFIX}_*`],
} satisfies Config;
