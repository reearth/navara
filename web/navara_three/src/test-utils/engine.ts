import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { Core, initSync } from "@navaramap/engine";

import type { TileHandler } from "../event/context";
import { createTileHandler } from "../event/tileHandler";

let engineInitialized = false;

/**
 * Initialize the engine WASM once per vitest worker. The web-target module
 * normally streams the binary over `fetch` (`initCore`), which Node cannot do
 * for workspace files — so the bytes are read from the `@navaramap/engine`
 * package and compiled synchronously. Repeat calls are no-ops; every test
 * file that touches Rust-backed functions can call this without coordination.
 */
export function initTestEngine(): void {
  if (engineInitialized) return;
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("@navaramap/engine/navara_wasm_bg.wasm");
  initSync({ module: readFileSync(wasmPath) });
  engineInitialized = true;
}

let sharedCore: Core | undefined;

/**
 * Lazily created `Core` shared across a vitest worker's test files.
 * `Core::new` only builds the Bevy app (no DOM access), so it is safe in the
 * Node test environment. Shared deliberately: tests exercise Rust-backed
 * queries against one engine instead of paying a per-file world setup.
 */
export function getTestCore(): Core {
  initTestEngine();
  sharedCore ??= new Core("navara-test");
  return sharedCore;
}

/**
 * The production {@link TileHandler} assembled over the shared test engine —
 * tests reach the same Rust functions (e.g. `mercatorY`) the app wires through
 * the event context, instead of stubbing them. The `Core` is created lazily on
 * first Core-backed call, so pure-function consumers never construct it.
 */
export function createTestTileHandler(): TileHandler {
  initTestEngine();
  return createTileHandler({
    getCore: () => getTestCore(),
    getVectorRevision: () => 0,
    getRasterRevision: () => 0,
  });
}
