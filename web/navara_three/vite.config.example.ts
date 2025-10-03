import { readdirSync } from "fs";
import path, { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
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
            src: resolve(__dirname, "./assets"),
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
            entry: resolve(__dirname, `example/pages/${page}/main.ts`),
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
        "@shaders": path.resolve(__dirname, "../../shaders"),
        "@navara/three": path.resolve(__dirname, "./dist"),
      },
    },
    publicDir: path.resolve(__dirname, "example/public"),
    envDir: path.resolve(__dirname, "example"),
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
