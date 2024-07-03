import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  envPrefix: "NAVARA",
  plugins: [wasm(), topLevelAwait()],
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
