/**
 * Pure math shared by the FogLight CPU tiling ({@link FogLightTileGrid}) and
 * mirrored by `shaders/glsl/fogLight.frag.glsl`. Keeping it here makes the
 * CPU/GPU agreement testable: the tile culling radius must always cover the
 * range the shader can produce visible output in, or fog cuts at tile edges.
 */

/**
 * Perceptual threshold below which a light's fog contribution is culled.
 * Feeds {@link effectiveRange}, whose result is baked into the light
 * texture's w channel — no matching GLSL constant needed.
 */
export const FOG_RANGE_EPSILON = 0.0001;

/**
 * Distance from a light beyond which its fog contribution falls under the
 * perceptual threshold: solves `I*D*(PI/h) / (1 + haloFalloff*h) = EPS` for
 * h, the peak brightness along a ray with closest approach h in the shader's
 * `calculateFogScattering`. Clamped by the user-provided radius.
 */
export function effectiveRange(
  intensity: number,
  fogDensity: number,
  radius: number,
  haloFalloff: number,
): number {
  const I = Math.max(intensity, 0);
  const D = Math.max(fogDensity, 0);
  if (I <= 0 || D <= 0 || radius <= 0) return 0;
  const c = (Math.PI * I * D) / FOG_RANGE_EPSILON;
  const k = haloFalloff;
  const hMax = k > 1e-6 ? (Math.sqrt(1 + 4 * k * c) - 1) / (2 * k) : c;
  return Math.min(radius, hMax);
}

/**
 * Tight NDC bounds of a sphere's perspective projection (Mara & McGuire, via
 * zeux's "approximate projected bounds"). Exact for a sphere fully in front
 * of the near plane — the caller must guarantee `cz - r > near`.
 *
 * @param cx - view-space center x
 * @param cy - view-space center y
 * @param cz - view-space center depth, positive in front of the camera
 * @param r - sphere radius
 * @param p00 - projection matrix [0][0]
 * @param p11 - projection matrix [1][1]
 * @param out - receives [minX, maxX, minY, maxY] in NDC
 * @returns false when the projection degenerates (non-finite bounds)
 */
export function projectSphereBoundsNdc(
  cx: number,
  cy: number,
  cz: number,
  r: number,
  p00: number,
  p11: number,
  out: Float32Array,
): boolean {
  const czr2 = cz * cz - r * r;
  const vx = Math.sqrt(cx * cx + czr2);
  const vy = Math.sqrt(cy * cy + czr2);
  const minX = ((vx * cx - r * cz) / (vx * cz + r * cx)) * p00;
  const maxX = ((vx * cx + r * cz) / (vx * cz - r * cx)) * p00;
  const minY = ((vy * cy - r * cz) / (vy * cz + r * cy)) * p11;
  const maxY = ((vy * cy + r * cz) / (vy * cz - r * cy)) * p11;
  if (
    !isFinite(minX) ||
    !isFinite(maxX) ||
    !isFinite(minY) ||
    !isFinite(maxY)
  ) {
    return false;
  }
  out[0] = minX;
  out[1] = maxX;
  out[2] = minY;
  out[3] = maxY;
  return true;
}

/**
 * Estimated fog contribution of a light to a ray with closest approach `h`:
 * intensity times the full-ray integral with the sphere clamp
 * (`2*atan(sMax/h)/h`, rational atan approximation with max error ~0.6% so
 * it stays trig-free), times the halo attenuation, times the same
 * outer-shell fade as the shader so estimates blend seamlessly with
 * analytically evaluated tiles. Used to rank lights per tile and to fold
 * dropped lights into the residual haze.
 */
export function tileContributionEstimate(
  h: number,
  range: number,
  intensity: number,
  haloFalloff: number,
): number {
  if (h >= range) return 0;
  const sMax = Math.sqrt(range * range - h * h);
  const ratio = sMax / h;
  const at =
    ratio <= 1
      ? ratio / (1 + 0.28 * ratio * ratio)
      : Math.PI / 2 - ratio / (ratio * ratio + 0.28);
  let est = (intensity * 2 * at) / h / (1 + haloFalloff * h);
  // 1 - smoothstep(0.85R, R, h), matching the shader's edge fade
  const tEdge = (h - 0.85 * range) / (0.15 * range);
  if (tEdge > 0) {
    const tc = tEdge < 1 ? tEdge : 1;
    est *= 1 - tc * tc * (3 - 2 * tc);
  }
  return est;
}
