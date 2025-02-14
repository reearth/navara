import path from "path";

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

import { commonConfig } from "../vite.config.common";

const common = commonConfig("Navara");

export default defineConfig({
  ...common,
  base: "./",
  plugins: [...common.plugins, glsl()],
  worker: {
    plugins: () => [...common.plugins],
  },
  resolve: {
    ...common.resolve,
    alias: {
      ...common.resolve.alias,
      "@shaders": path.resolve(__dirname, "../../shaders"),
    },
  },
  build: {
    ...common.build,
    rollupOptions: {
      ...common.build.rollupOptions,
      external: [...(common.build.rollupOptions.external as string[]), "three"],
    },
  },
});
