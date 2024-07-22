import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import glsl from 'vite-plugin-glsl';
import wasm from "vite-plugin-wasm";
import path from "path";

export default defineConfig({
  envPrefix: "NAVARA",
  resolve: {
    alias: {
      "@shaders": path.resolve(__dirname, "../shaders"),
    }
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
