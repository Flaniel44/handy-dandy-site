import { recreateTestDatabase } from "./database";

export default async function setup() {
  if (!process.env.DATABASE_URL) throw new Error("The integration-test database was not configured.");
  await recreateTestDatabase(process.env.DATABASE_URL);
}
