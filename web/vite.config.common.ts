import fs from "fs";
import path from "path";
import { ConfigEnv } from "vite";
import { PluginOption, type UserConfig } from "vite";

import dts from "vite-plugin-dts";
import tsconfig from "vite-tsconfig-paths";

// This is necessary to watch shared packages.
// Ref: https://github.com/vitejs/vite/issues/8619#issuecomment-2019967424
function watchPackages(packageNames: string[]): PluginOption {
  return {
    name: "vite-plugin-watch-packages",
    buildStart() {
      packageNames.forEach((packageName) => {
        const absPackagePath = path.resolve(
          __dirname,
          "../node_modules",
          packageName
        );
        const realPackagePath = fs.realpathSync(absPackagePath);

        this.addWatchFile(realPackagePath);
      });
    },
  };
}

export const commonConfig = (name: string, env: ConfigEnv): UserConfig => ({
  plugins: [
    watchPackages(["navara_wasm", "navara_wasm_worker", "navara_wasm_api"]),
    tsconfig(),
    dts(),
  ],
  resolve: {
    mainFields: ["module"],
    alias: {
      "@navara/engine": "navara_wasm",
      "@navara/engine-worker": "navara_wasm_worker",
      "@navara/engine-api": "navara_wasm_api",
    },
  },
  build: {
    lib: {
      entry: "./src/index.ts",
      name,
      fileName: "index",
    },
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      external: ["@navara/engine", "@navara/engine-worker", "@navara/engine-api"],
    },
    watch:
      env.mode === "watch"
        ? {
            buildDelay: 100,
          }
        : undefined,
  },
});
