import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://handy_dani:handy_dani_dev@localhost:5432/handy_dani_test";

export function configureTestDatabase() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error("Integration tests require a database whose name ends in _test.");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === databaseUrl) {
    throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL.");
  }
  process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}

export async function recreateTestDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.slice(1);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, prepare: false });

  try {
    await admin.unsafe(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [databaseName],
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }

  const migrationSql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const migrationDirectory = path.resolve(process.cwd(), "drizzle");
    const migrations = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const migration of migrations) {
      await migrationSql.unsafe(await readFile(path.join(migrationDirectory, migration), "utf8"));
    }
  } finally {
    await migrationSql.end();
  }
}

export async function resetTestData(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(
    "TRUNCATE password_reset_tokens, appointments, booking_slots, customers RESTART IDENTITY CASCADE",
  );
  await sql`DELETE FROM manual_blocks`;
  await sql`DELETE FROM weekly_hours`;
  await sql`
    INSERT INTO weekly_hours (business_id, weekday, starts_at_local, ends_at_local)
    SELECT '11111111-1111-4111-8111-111111111111', weekday, '09:00', '17:00'
    FROM generate_series(1, 5) AS weekday
  `;
}
