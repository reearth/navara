import path from "path";

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import tsconfig from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [wasm(), topLevelAwait(), glsl(), tsconfig()],
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
      fileName: "@navara/three",
    },
    rollupOptions: {
      external: ["three"],
    },
  },
});
