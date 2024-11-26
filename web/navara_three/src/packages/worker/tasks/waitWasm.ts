import init, { type InitOutput } from "@navara/engine-worker";

let WASM: Promise<InitOutput>;

export async function waitWasm() {
  if (WASM) {
    await WASM;
  } else {
    WASM = init();
    await WASM;
  }
}
