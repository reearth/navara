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
 * Directories under `example/pages` that hold a shared entrypoint (a `main.tsx`
 * reused by other pages) rather than a standalone page. They must not be
 * registered as their own MPA page or listed in the launchers. `detail` is the
 * shared React presentation template rendered at `/<section>/<slug>` for each
 * curated example.
 */
const SHARED_ENTRY_DIRS = new Set(["detail"]);

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
      if (!prefix && SHARED_ENTRY_DIRS.has(entry.name)) {
        // Shared entrypoint, not a page of its own.
        continue;
      }
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
          {
            // The prebuilt @navara/three worker chunks are re-emitted here as
            // opaque assets, so Vite never sees the .wasm they fetch relative
            // to their own URL at runtime; copy those files through verbatim.
            src: normalizePath(resolve(__dirname, "./dist/assets/*.wasm")),
            dest: "./",
            rename: { stripBase: true },
          },
        ],
      }),
      createMpaPlugin({
        templatePath: resolve(__dirname, "example/template.html"),
        pages: examplePages.flatMap(({ name, path: dir }) => {
          const mainFile = existsSync(resolve(dir, "main.tsx"))
            ? "main.tsx"
            : "main.ts";

          // Curated examples get two entries with clean, slash-separated URLs:
          //   detail (presentation)  -> /<section>/<slug>       (shared React template)
          //   demo   (iframe target) -> /demo/<section>/<slug>  (the raw full-screen demo)
          if (name.startsWith("examples/")) {
            const rel = name.replace(/^examples\//, "");
            return [
              {
                name: rel,
                filename: `${rel}.html`,
                entry: normalizePath(`/example/pages/detail/main.tsx`),
                data: { title: "Navara" },
              },
              {
                name: `demo/${rel}`,
                filename: `demo/${rel}.html`,
                entry: normalizePath(`/example/pages/${name}/${mainFile}`),
                data: { title: "Navara" },
              },
            ];
          }

          // Everything else (gallery index, dev launcher, debug/*, legacy demos):
          // dash URLs, with a trailing "/index" collapsed to its parent ("dev/index" -> /dev).
          const urlName = name.replace(/\/index$/, "").replace(/\//g, "-");
          return [
            {
              name: urlName,
              filename: `${urlName}.html`,
              entry: normalizePath(`/example/pages/${name}/${mainFile}`),
              data: { title: "Navara" },
            },
          ];
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
              "@navara/maplibre_style": normalizePath(
                path.resolve(__dirname, "../navara_maplibre_style/src"),
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
