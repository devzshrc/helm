import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `server-only` throws when imported outside an RSC; stub it for unit tests.
    alias: {
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url)
        .pathname,
    },
    env: { SKIP_ENV_VALIDATION: "1" },
  },
});
