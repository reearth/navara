import path from "path";

import { defineConfig, normalizePath } from "vite";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";

import { commonConfig } from "../vite.config.common";

export default defineConfig((env) => {
  const common = commonConfig("Navara", env);
  return {
    ...common,
    base: "./",
    plugins: [
      ...common.plugins,
      glsl(),
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(path.resolve(__dirname, "./assets")),
            dest: "./",
          },
        ],
      }),
    ],
    worker: {
      plugins: () => [...common.plugins],
    },
    resolve: {
      ...common.resolve,
      alias: {
        ...common.resolve.alias,
        "@shaders": normalizePath(path.resolve(__dirname, "../../shaders")),
      },
    },
    build: {
      ...common.build,
      rollupOptions: {
        ...common.build.rollupOptions,
        external: [
          ...(common.build.rollupOptions.external as string[]),
          "three",
        ],
      },
      watch: undefined,
      sourcemap: true,
    },
  };
});
