import path from "path";
import { type UserConfig } from "vite";

import dts from "vite-plugin-dts";
import tsconfig from "vite-tsconfig-paths";

export const commonConfig = (name: string, isLib = true): UserConfig => ({
  plugins: [tsconfig(), dts({ rollupTypes: true })],
  resolve: {
    mainFields: ["module"],
    alias: {
      "@navara/engine": "navara_wasm",
      "@navara/engine-worker": "navara_wasm_worker",
    },
  },
  build: {
    lib: {
      entry: "./src/index.ts",
      name,
      fileName: "index",
    },
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      external: ["@navara/engine", "@navara/engine-worker"],
    },
  },
});
