import path from "path";

import { defineConfig, normalizePath } from "vite";
import dts from "vite-plugin-dts";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfig from "vite-tsconfig-paths";

import { commonConfig } from "../vite.config.common";

export default defineConfig((env) => {
  const common = commonConfig("Navara", env);
  return {
    ...common,
    base: "./",

    // Note: Plugin doesn't include common config.
    plugins: [
      tsconfig({ configNames: ["tsconfig.build.json"] }),
      dts({ tsconfigPath: "./tsconfig.build.json" }),
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
