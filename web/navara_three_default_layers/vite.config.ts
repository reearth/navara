import path from "path";

import dts from "unplugin-dts/vite";
import { defineConfig, normalizePath } from "vite";
import glsl from "vite-plugin-glsl";
import tsconfig from "vite-tsconfig-paths";

import { commonConfig, composePlugins } from "../vite.config.common";

export default defineConfig((env) => {
  const common = commonConfig("NavaraDefaultLayers", env);
  return {
    ...common,
    plugins: composePlugins(env, [
      tsconfig({ configNames: ["tsconfig.build.json"] }),
      glsl(),
      dts({
        tsconfigPath: "./tsconfig.build.json",
        bundleTypes: true,
      }),
    ]),
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
        external: ["three", "postprocessing", "@navara/three"],
      },
    },
  };
});
