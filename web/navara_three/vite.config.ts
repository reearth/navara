import path from "path";

import dts from "unplugin-dts/vite";
import { defineConfig, normalizePath } from "vite";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfig from "vite-tsconfig-paths";

import { commonConfig, composePlugins } from "../vite.config.common";

export default defineConfig((env) => {
  const common = commonConfig("Navara", env);
  return {
    ...common,
    base: "./",
    plugins: composePlugins(env, [
      tsconfig({ configNames: ["tsconfig.build.json"] }),
      glsl(),
      dts({
        tsconfigPath: "./tsconfig.build.json",
        bundleTypes: {
          bundledPackages: [
            "@navara/engine",
            "@navara/engine-api",
            "@navara/core",
            "@navara/three_api",
            "@navara/worker",
          ],
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
    ]),
    worker: {
      plugins: () => [...common.plugins],
    },
    resolve: {
      ...common.resolve,
      alias: {
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
      sourcemap: false, // TODO: Enable this when it's released.
    },
  };
});
