import init, { type InitOutput } from "@navara/engine-worker";
import URL from "@navara/engine-worker/navara_wasm_worker_bg.wasm?url";

let WASM: Promise<InitOutput>;

export async function waitWasm() {
  if (WASM) {
    await WASM;
  } else {
    WASM = init(URL);
    await WASM;
  }
}
