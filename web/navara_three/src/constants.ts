import { ElevationDecoder } from "@navara/engine";

// Evaluate them lazily because we need to wait until WASM module is ready.
// If we can use top-level-await, we don't need to do it.
export const JAPAN_GSI_ELEVATION_DECODER = () => ElevationDecoder.japanGSI();
export const MAPBOX_ELEVATION_DECODER = () => ElevationDecoder.mapbox();
