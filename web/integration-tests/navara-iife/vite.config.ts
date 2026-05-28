import path from "path";

import { defineConfig } from "vite";

// Serve the IIFE bundle from navara_three's build output as static files.
// Run `pnpm build:iife` in web/navara_three before starting this.
export default defineConfig({
  publicDir: path.resolve(__dirname, "../../navara_three/dist/iife"),
});
