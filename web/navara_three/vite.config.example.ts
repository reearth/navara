import { existsSync, readdirSync } from "fs";
import path, { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import tsconfig from "vite-tsconfig-paths";

import { commonConfig } from "../vite.config.common";

import { createMpaPlugin } from "./vite-plugin-mpa";

type PageInfo = {
  name: string;
  category: string;
  displayName: string;
};

/**
 * Recursively discover example pages in nested directories.
 * A directory is considered a page if it contains a main.ts file.
 * Otherwise, it's treated as a category directory.
 */
function getExamplePages(
  baseDir: string,
  prefix = "",
): { name: string; path: string }[] {
  const entries = readdirSync(baseDir, { withFileTypes: true });
  const pages: { name: string; path: string }[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = resolve(baseDir, entry.name);
      const mainFile = resolve(fullPath, "main.ts");
      const mainTsxFile = resolve(fullPath, "main.tsx");

      if (existsSync(mainFile) || existsSync(mainTsxFile)) {
        // This is a page directory
        const pageName = prefix ? `${prefix}/${entry.name}` : entry.name;
        pages.push({ name: pageName, path: fullPath });
      } else {
        // This is a category directory, recurse
        const nestedPages = getExamplePages(
          fullPath,
          prefix ? `${prefix}/${entry.name}` : entry.name,
        );
        pages.push(...nestedPages);
      }
    }
  }

  return pages;
}

const examplePages = getExamplePages(resolve(__dirname, "example/pages"));

// Convert to PageInfo for the PAGES global
const pageInfos: PageInfo[] = examplePages.map(({ name }) => ({
  name,
  category: name.includes("/") ? name.split("/")[0] : "uncategorized",
  displayName: name.includes("/") ? (name.split("/").pop() ?? name) : name,
}));

export default defineConfig((env) => {
  const common = commonConfig("NavaraExample", env);
  return {
    ...common,
    envPrefix: "NAVARA",
    plugins: [
      glsl(),
      tsconfig(),
      react(),
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(resolve(__dirname, "./assets")),
            dest: "./",
          },
        ],
      }),
      createMpaPlugin({
        templatePath: resolve(__dirname, "example/template.html"),
        pages: examplePages.map(({ name }) => {
          // Convert nested path to URL-safe name: "styling/geojson-billboard" -> "styling-geojson-billboard"
          const urlName = name.replace(/\//g, "-");
          return {
            name: urlName,
            filename: `${urlName}.html`,
            entry: normalizePath(`/example/pages/${name}/main.ts`),
            data: { title: "Navara" },
          };
        }),
      }),
      ...(env.mode !== "production" ? [wasm(), topLevelAwait()] : []),
    ],
    define: {
      PAGES: JSON.stringify(pageInfos),
    },
    build: {
      outDir: "dist-example",
      assetsDir: "./",
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@shaders": normalizePath(path.resolve(__dirname, "../../shaders")),
        // For dev server, import packages directly from source to avoid bundling.
        ...(env.command === "serve"
          ? {
              "@navara/three": normalizePath(path.resolve(__dirname, "./src")),
              "@navara/core": normalizePath(
                path.resolve(__dirname, "../navara_core/src"),
              ),
              "@navara/three_api": normalizePath(
                path.resolve(__dirname, "../navara_three_api/src"),
              ),
              "@navara/three_csm": normalizePath(
                path.resolve(__dirname, "../navara_three_csm/src"),
              ),
              "@navara/three_default_plugin": normalizePath(
                path.resolve(__dirname, "../navara_three_default_plugin/src"),
              ),
              "@navara/three_react": normalizePath(
                path.resolve(__dirname, "../navara_three_react/src"),
              ),
              "@navara/worker": normalizePath(
                path.resolve(__dirname, "../navara_worker/src"),
              ),
            }
          : {
              // For production example builds, consume the built library output.
              "@navara/three": normalizePath(path.resolve(__dirname, "./dist")),
            }),
      },
    },
    publicDir: normalizePath(path.resolve(__dirname, "./example/public")),
    envDir: normalizePath(path.resolve(__dirname, "./example")),
    worker: {
      plugins: () => [tsconfig()],
    },
    server: {
      open: true,
      fs: {
        allow: ["../../.."],
      },
    },
  };
});
