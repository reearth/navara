import { ExtentRadianF32Like } from "@navara/core";
import { parseMvtTile as parseMvtTileImpl } from "@navara/engine-worker";

import { transfer } from "..";
import { toExtentRadianF32Like } from "../utils";

import { waitWasm } from "./waitWasm";

/**
 * A whole tile's parsed groups packed into four per-type streams (see
 * `navara_parser::mvt::pack_parsed_mvt_groups` for the segment order). The
 * tile meta (per-group headers + per-layer property tables) rides along as a
 * structured clone; only the four stream buffers are transferred.
 */
export type ParsedMvtTileResultLike = {
  f64_stream: Float64Array;
  f32_stream: Float32Array;
  u32_stream: Uint32Array;
  u8_stream: Uint8Array;
  meta: unknown;
};

export async function parseMvtTile(
  bytes: Uint8Array,
  x: number,
  y: number,
  z: number,
  tileExtent: ExtentRadianF32Like | undefined,
  compression: number,
  configsJson: string,
): Promise<ParsedMvtTileResultLike> {
  await waitWasm();

  const packed = parseMvtTileImpl(
    bytes,
    x,
    y,
    z,
    tileExtent ? toExtentRadianF32Like(tileExtent) : undefined,
    compression,
    configsJson,
  );

  // Free the wasm-bindgen result even when a stream getter throws (e.g. an
  // allocation failure), or its Rust-side Vecs would leak in worker WASM memory.
  let f64_stream: Float64Array;
  let f32_stream: Float32Array;
  let u32_stream: Uint32Array;
  let u8_stream: Uint8Array;
  let meta: unknown;
  try {
    f64_stream = packed.f64_stream();
    f32_stream = packed.f32_stream();
    u32_stream = packed.u32_stream();
    u8_stream = packed.u8_stream();
    meta = packed.meta();
  } finally {
    packed.free();
  }

  return transfer({ f64_stream, f32_stream, u32_stream, u8_stream, meta }, [
    f64_stream.buffer,
    f32_stream.buffer,
    u32_stream.buffer,
    u8_stream.buffer,
  ]);
}
