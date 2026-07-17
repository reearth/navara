/**
 * Solve `dot(rgb, scaler) == boundary` for RGB bytes: the color a DEM texel
 * must hold so the shader's `decodeDEMHeight` classifies it as no-data. The
 * raster bake paints a baked heatmap render target with this color before
 * drawing sources, so uncovered regions decode as "no elevation here" —
 * entirely inside the encoded-elevation domain, leaving the alpha channel
 * untouched (it is not part of any encoding and stays reserved for future
 * RGBA ones).
 *
 * Solved by greedy positional decomposition (largest scaler first), which is
 * exact for the positional presets (GSI, Mapbox, Terrarium). Returns null when
 * the decoder has no byte-representable boundary color (an exotic custom
 * decoder) — callers then skip the no-data underlay and uncovered regions
 * decode as whatever black decodes to, matching the pre-bake behavior for
 * such decoders.
 */
export function demNoDataColorBytes(
  scaler: { x: number; y: number; z: number },
  boundary: number,
): [number, number, number] | null {
  const channels: { scaler: number; index: number }[] = [
    { scaler: scaler.x, index: 0 },
    { scaler: scaler.y, index: 1 },
    { scaler: scaler.z, index: 2 },
  ]
    .filter((c) => c.scaler > 0)
    .sort((a, b) => b.scaler - a.scaler);

  const rgb: [number, number, number] = [0, 0, 0];
  let rest = boundary;
  for (const { scaler: s, index } of channels) {
    // The epsilon guards float division just below an integer (e.g. 0.999…).
    const v = Math.min(255, Math.max(0, Math.floor(rest / s + 1e-9)));
    rgb[index] = v;
    rest -= v * s;
  }

  // The shader flags |x - boundary| <= 1 as no-data; require an exact-enough
  // decomposition so the painted color cannot leak into the valid range.
  return Math.abs(rest) <= 0.5 ? rgb : null;
}
