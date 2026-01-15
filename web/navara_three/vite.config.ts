import path from "path";

import dts from "unplugin-dts/vite";
import { defineConfig, normalizePath } from "vite";
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
      glsl(),
      dts({
        tsconfigPath: "./tsconfig.build.json",
        bundleTypes: {
          // TODO: Remove this once we publish these modules on NPM,
          // since these modules should be loaded automatically by package manager.
          bundledPackages: ["@navara/core", "@navara/three_api"],
        },
      }),
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
