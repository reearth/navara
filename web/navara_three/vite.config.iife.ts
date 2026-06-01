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
      // Redirect @navara/three to source so workspace packages that import it
      // (e.g. @navara/three_default_plugin/dist/index.js → @navara/three) use
      // the same module instance as the IIFE entry, avoiding double init.
      {
        find: /^@navara\/three$/,
        replacement: normalizePath(path.resolve(__dirname, "src/index.ts")),
      },
      // Use Three.js source files directly so that `three`, `three/webgpu`, and
      // `three/tsl` all share the same module instances (avoids duplicate ShaderChunk).
      // Use exact-match regex to avoid breaking `three/addons/*` subpath imports.
      {
        find: /^three$/,
        replacement: normalizePath(
          path.resolve(__dirname, "node_modules/three/src/Three.js"),
        ),
      },
      {
        find: "three/webgpu",
        replacement: normalizePath(
          path.resolve(__dirname, "node_modules/three/src/Three.WebGPU.js"),
        ),
      },
      {
        find: "three/tsl",
        replacement: normalizePath(
          path.resolve(__dirname, "node_modules/three/src/Three.TSL.js"),
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
