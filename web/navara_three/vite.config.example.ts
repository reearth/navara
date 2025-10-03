import { readdirSync } from "fs";
import path, { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { createMpaPlugin, Page } from "vite-plugin-virtual-mpa";
import tsconfig from "vite-tsconfig-paths";

import { commonConfig } from "../vite.config.common";

const pages = readdirSync(resolve(__dirname, "example/pages"));

export default defineConfig((env) => {
  const common = commonConfig("NavaraExample", env);
  return {
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
        template: "example/template.html",
        pages: pages.map((page) => {
          return {
            name: page,
            filename: `${page}.html`,
            entry: normalizePath(`/example/pages/${page}/main.ts`),
            data: {
              title: "Navara",
            },
          } as Page;
        }),
        rewrites: [
          {
            from: /^\/$/,
            to: "/index.html",
          },
        ],
      }),
    ],
    define: {
      PAGES: pages,
    },
    build: {
      outDir: "dist-example",
    },
    resolve: {
      alias: {
        ...common.resolve?.alias,
        "@shaders": normalizePath(path.resolve(__dirname, "../../shaders")),
        // For dev server, import packages directly from source to avoid bundling.
        ...(env.command === "serve"
          ? {
              "@navara/three": normalizePath(path.resolve(__dirname, "./src")),
              "@navara/core": normalizePath(path.resolve(__dirname, "../navara_core/src")),
              "@navara/three_api": normalizePath(path.resolve(
                __dirname,
                "../navara_three_api/src",
              )),
              "@navara/three_csm": normalizePath(path.resolve(
                __dirname,
                "../navara_three_csm/src",
              )),
              "@navara/three_react": normalizePath(path.resolve(
                __dirname,
                "../navara_three_react/src",
              )),
              "@navara/worker": normalizePath(path.resolve(__dirname, "../navara_worker/src")),
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
