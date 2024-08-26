import path from "path";

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import tsconfig from "vite-tsconfig-paths";

export default defineConfig({
  envPrefix: "NAVARA",
  plugins: [wasm(), topLevelAwait(), glsl(), tsconfig()],
  resolve: {
    alias: {
      "@shaders": path.resolve(__dirname, "../../shaders"),
    },
  },
  publicDir: path.resolve(__dirname, "example/public"),
  envDir: path.resolve(__dirname, "example"),
  worker: {
    plugins: () => [wasm(), topLevelAwait(), glsl(), tsconfig()],
  },
  server: {
    open: true,
    fs: {
      allow: ["../.."],
    },
  },
});
