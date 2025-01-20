import { readdirSync } from "fs";
import path, { resolve } from "path";

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { createMpaPlugin, Page } from "vite-plugin-virtual-mpa";
import tsconfig from "vite-tsconfig-paths";

const pages = readdirSync(resolve(__dirname, "example/pages"));

export default defineConfig({
  envPrefix: "NAVARA",
  plugins: [
    glsl(),
    tsconfig(),
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
  resolve: {
    alias: {
      "@shaders": path.resolve(__dirname, "../../shaders"),
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
});
