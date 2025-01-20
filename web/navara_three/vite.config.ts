import path from "path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import glsl from "vite-plugin-glsl";
import tsconfig from "vite-tsconfig-paths";

export default defineConfig({
  base: "./",
  plugins: [glsl(), tsconfig(), dts({ rollupTypes: true })],
  worker: {
    plugins: () => [tsconfig()],
  },
  resolve: {
    mainFields: ["module"],
    alias: {
      "@shaders": path.resolve(__dirname, "../../shaders"),
      "@navara/core": path.resolve(__dirname, "./src/packages/core"),
      "@navara/worker": path.resolve(__dirname, "./src/packages/worker"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Navara",
    },
    rollupOptions: {
      external: ["three", "@navara/engine", "@navara/engine-worker"],
    },
  },
});
