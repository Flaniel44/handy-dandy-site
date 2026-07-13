import { defineConfig } from "vitest/config";
import { configureTestDatabase } from "./test/integration/database";

configureTestDatabase();

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.integration.test.ts"],
    fileParallelism: false,
    globalSetup: ["./test/integration/global-setup.ts"],
  },
});
