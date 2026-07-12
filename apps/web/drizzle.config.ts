import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://handy_dani:handy_dani_dev@localhost:5432/handy_dani",
  },
  strict: true,
  verbose: true,
});
