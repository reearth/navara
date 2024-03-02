import { defineConfig } from "vite";
import react from '@vitejs/plugin-react-swc'
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm(), topLevelAwait(), react()],
  worker: {
    plugins: [wasm(), topLevelAwait(), react()],
  },
  server: {
    open: true,
    fs: {
      allow: [".."],
    },
  },
});
