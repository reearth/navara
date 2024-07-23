import path from "path";

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  envPrefix: "NAVARA",
  resolve: {
    alias: {
      "@shaders": path.resolve(__dirname, "../shaders"),
    },
  },
  plugins: [wasm(), topLevelAwait(), glsl()],
  worker: {
    plugins: [wasm(), topLevelAwait()],
  },
  server: {
    open: true,
    fs: {
      allow: [".."],
    },
  },
});
