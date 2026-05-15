/**
 * Epsilon for the opaque-occlusion test, in normalized depth space [0, 1]
 * (NOT view space). Guards against precision noise from RGBA depth packing
 * (~24-bit quantization, i.e. ~6e-8 LSB) plus float arithmetic (~1e-7).
 *
 * Sized at ~170× the quantization LSB: large enough to absorb the
 * same-fragment jitter we care about, small enough not to swallow legitimate
 * near-coplanar occluders. Filter-induced noise no longer needs to be hidden
 * here — `nvrSnapUVToTexelCenter` below makes sampling effectively Nearest.
 *
 * Note: normalized depth is non-linear under a perspective projection, so a
 * fixed epsilon is tighter (in world units) near the near plane and looser
 * near the far plane. Acceptable for the current Selective Effect use case.
 */
#define SELECTIVE_EFFECT_OCCLUSION_EPSILON 0.00001

/**
 * Snap a UV coordinate to the center of its nearest texel.
 *
 * The shared MRT / final depth textures use LinearFilter (AP / Clouds depend on
 * this). Linearly interpolating RGBA-packed depth and then `unpackRGBAToDepth`
 * produces invalid values, so callers that sample at sub-texel UVs (e.g. Bloom
 * extracts at lower resolution) must snap UVs first to emulate NearestFilter.
 */
vec2 nvrSnapUVToTexelCenter(vec2 uv, vec2 resolution) {
  return (floor(uv * resolution) + 0.5) / resolution;
}

/**
 * Test whether a Selective Effect pixel is occluded by opaque rendering.
 * Used by selective effect passes (Bloom, Outline) to drop pixels that the
 * MRT scene wrote but were later covered by an opaque-scene fragment.
 *
 * Compares two RGBA-packed depth snapshots at the same screen UV:
 *   - tMrtDepth: depth right after MRT scene render (before opaque). The depth
 *     at which the effect-emitting fragment was written.
 *   - tAllDepth: final depth after opaque rendering.
 *
 * Both textures use LinearFilter; UVs are snapped to texel centers before
 * sampling so the linear interpolation degenerates to a nearest sample.
 *
 * Requires `#include <packing>` (for `unpackRGBAToDepth`) in the caller.
 *
 * @param tMrtDepth - MRT-time depth snapshot (RGBA-packed)
 * @param tAllDepth - Final post-opaque depth snapshot (RGBA-packed)
 * @param uv - Screen UV coordinate
 * @param depthResolution - Resolution of both depth textures (matched, full-res)
 * @return true if opaque rendered closer than the MRT pixel at this UV, false otherwise
 */
bool isOccludedByOpaque(
  sampler2D tMrtDepth,
  sampler2D tAllDepth,
  vec2 uv,
  vec2 depthResolution
) {
  vec2 snappedUv = nvrSnapUVToTexelCenter(uv, depthResolution);
  float mrtDepth = unpackRGBAToDepth(texture2D(tMrtDepth, snappedUv));
  float allDepth = unpackRGBAToDepth(texture2D(tAllDepth, snappedUv));
  return allDepth < mrtDepth - SELECTIVE_EFFECT_OCCLUSION_EPSILON;
}
