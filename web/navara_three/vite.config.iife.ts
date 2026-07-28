import path from "path";

import { defineConfig, normalizePath } from "vite";
import glsl from "vite-plugin-glsl";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfig from "vite-tsconfig-paths";

const plugins = [tsconfig({ configNames: ["tsconfig.build.json"] }), glsl()];

export default defineConfig({
  base: "./",
  plugins: [
    ...plugins,
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, "./assets")),
          dest: "./",
        },
      ],
    }),
  ],
  worker: {
    plugins: () => plugins,
  },
  resolve: {
    mainFields: ["module"],
    dedupe: ["three"],
    alias: [
      // Redirect @navaramap/three to source so workspace packages that import it
      // (e.g. @navaramap/three-default-plugin/dist/index.js → @navaramap/three) use
      // the same module instance as the IIFE entry, avoiding double init.
      {
        find: /^@navaramap\/three$/,
        replacement: normalizePath(path.resolve(__dirname, "src/index.ts")),
      },
      // Use the Three.js source file directly so that `three` resolves to a
      // single module instance (avoids duplicate ShaderChunk).
      // Use exact-match regex to avoid breaking `three/addons/*` subpath imports.
      {
        find: /^three$/,
        replacement: normalizePath(
          path.resolve(__dirname, "node_modules/three/src/Three.js"),
        ),
      },
      {
        find: "@shaders",
        replacement: normalizePath(path.resolve(__dirname, "../../shaders")),
      },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    // import.meta.url is unavailable in IIFE format; polyfill with currentScript
    "import.meta.url":
      "((document.currentScript && document.currentScript.src) || location.href)",
  },
  build: {
    lib: {
      entry: "./src/index.iife.ts",
      name: "Navara",
      fileName: "navara",
      formats: ["iife"],
    },
    outDir: "dist/iife",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        exports: "named",
      },
    },
    sourcemap: false,
  },
});
