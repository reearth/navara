/**
 * Epsilon for the opaque-occlusion test, in normalized depth space [0, 1]
 * (NOT view space). Guards against precision noise from RGBA depth packing
 * (~24-bit quantization + filter rounding + floating-point arithmetic).
 *
 * Note: normalized depth is non-linear under a perspective projection, so a
 * fixed epsilon is tighter (in world units) near the near plane and looser
 * near the far plane. For the current Selective Effect use case the goal is
 * just to suppress equal-depth jitter, so this is acceptable.
 */
#define SELECTIVE_EFFECT_OCCLUSION_EPSILON 0.001

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
 * Requires `#include <packing>` (for `unpackRGBAToDepth`) in the caller.
 *
 * @param tMrtDepth - MRT-time depth snapshot (RGBA-packed)
 * @param tAllDepth - Final post-opaque depth snapshot (RGBA-packed)
 * @param uv - Screen UV coordinate
 * @return true if opaque rendered closer than the MRT pixel at this UV, false otherwise
 */
bool isOccludedByOpaque(sampler2D tMrtDepth, sampler2D tAllDepth, vec2 uv) {
  float mrtDepth = unpackRGBAToDepth(texture2D(tMrtDepth, uv));
  float allDepth = unpackRGBAToDepth(texture2D(tAllDepth, uv));
  return allDepth < mrtDepth - SELECTIVE_EFFECT_OCCLUSION_EPSILON;
}
