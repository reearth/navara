import path from "path";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
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
      dts({
        rollupTypes: true
      }),
      glsl(),
      viteStaticCopy({
        targets: [
          {
            src: path.resolve(__dirname, "./assets"),
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
        "@shaders": path.resolve(__dirname, "../../shaders"),
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
