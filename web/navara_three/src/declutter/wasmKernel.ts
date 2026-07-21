import { declutterPlace } from "@navaramap/engine-api";

import type { DeclutterKernel } from "./kernel";

/**
 * @internal
 * {@link DeclutterKernel} backed by the Rust `declutterPlace` in
 * `navara_wasm_api`. The WASM module must be initialized (via `initNavaraApi()`)
 * before the first placement pass runs; `ThreeView` awaits that during setup.
 */
export const wasmDeclutterKernel: DeclutterKernel = {
  place: declutterPlace,
};
