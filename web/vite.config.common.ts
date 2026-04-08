/// <reference types="vitest/config" />
import fs from "fs";
import path from "path";
import { ConfigEnv, normalizePath } from "vite";
import { PluginOption, type UserConfig } from "vite";

import tsconfig from "vite-tsconfig-paths";
import wasm from "vite-plugin-wasm";
import dts from "unplugin-dts/vite";
import topLevelAwait from "vite-plugin-top-level-await";
// This is necessary to watch shared packages.
// Ref: https://github.com/vitejs/vite/issues/8619#issuecomment-2019967424
function watchPackages(packageNames: string[]): PluginOption {
  return {
    name: "vite-plugin-watch-packages",
    buildStart() {
      packageNames.forEach((packageName) => {
        const absPackagePath = normalizePath(path.resolve(
          __dirname,
          "../node_modules",
          packageName
        ));
        const realPackagePath = fs.realpathSync(absPackagePath);

        this.addWatchFile(realPackagePath);
      });
    },
  };
}

function getPluginName(plugin: PluginOption): string | undefined {
  if (plugin && typeof plugin === "object" && "name" in plugin) {
    return plugin.name;
  }
  return undefined;
}

export function composePlugins(
  env: ConfigEnv,
  additionalPlugins: PluginOption[] = [],
): PluginOption[] {
  const basePlugins: PluginOption[] = [
    watchPackages(["@navara/engine", "@navara/engine-worker", "@navara/engine-font-worker", "@navara/engine-api"]),
    tsconfig(),
    dts({ bundleTypes: true, tsconfigPath: "./tsconfig.build.json" }),
    ...(env.mode !== "production" ? [wasm(), topLevelAwait()] : []),
  ];

  const overrideNames = new Set(
    additionalPlugins.map(getPluginName).filter((n): n is string => n != null),
  );

  const filtered = basePlugins.filter((p) => {
    const name = getPluginName(p);
    return name == null || !overrideNames.has(name);
  });

  return [...filtered, ...additionalPlugins];
}

export const commonConfig = (name: string, env: ConfigEnv) => ({
  plugins: composePlugins(env),
  resolve: {
    mainFields: ["module"],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(env.mode),
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
      external: ["@navara/engine", "@navara/engine-worker", "@navara/engine-font-worker", "@navara/engine-api"],
    },
    watch:
      env.mode === "watch"
        ? {
            buildDelay: 100,
          }
        : undefined,
  },
  test: {
    environment: "jsdom",
  }
}) satisfies UserConfig;
