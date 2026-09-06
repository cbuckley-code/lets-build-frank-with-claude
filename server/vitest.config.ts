import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only our own tests; never the compiled output in dist/.
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
