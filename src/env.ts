import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url(),
    UPLOADTHING_TOKEN: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  },

  // Next.js only exposes variables prefixed with `NEXT_PUBLIC_` to the client.
  client: {
    NEXT_PUBLIC_PARTYKIT_HOST: z.string().optional(),
  },

  // `process.env` can't be destructured in Next.js edge runtimes or on the
  // client, so each key is listed.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_PARTYKIT_HOST: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
  },
  // Set `SKIP_ENV_VALIDATION` to build or run without validation, as in Docker builds.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
