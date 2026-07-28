/*******************************************************
 * Description:
 *   Vertex shader for rendering geodesic arcs on the WGS84
 *   ellipsoid using RTE (Relative-To-Eye) rendering.
 *   Supports line thickness in screen space, smooth color
 *   interpolation, and arc lifting with sine modulation.
 *
 *   Key features:
 *     - RTE rendering with high/low precision ECEF encoding
 *     - Geodesic interpolation between source & target
 *     - Screen-space line quad expansion
 *     - Per-instance color modes
 *******************************************************/

// The implementation is based on the principles of deck.gl's ArcLayer
// https://github.com/visgl/deck.gl/blob/master/modules/layers/src/arc-layer/arc-layer-vertex.glsl.ts

precision highp float;

uniform vec2  uViewport;
uniform float uA;
uniform float uE2;

// RTE uniforms - camera position encoded as high/low precision
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;
uniform mat4 modelViewMatrixRTE;

// Always 1.0. Multiplying the high-order difference by a uniform the compiler
// cannot constant-fold blocks fast-math reassociation of
// (high - camHigh) + (low - camLow) into (high + low) - (camHigh + camLow),
// which would collapse the math to absolute-ECEF f32 precision and make short
// arcs snap/flicker in ~0.25-0.5 m steps as the camera moves.
uniform float u_rteOne;

// Packed vertex attributes
attribute vec2 aVertexData; // x=aT, y=aSide

// Instance attributes - ECEF coordinates with high/low precision encoding
attribute vec3 aInstanceSourceHigh; // High precision component of source ECEF
attribute vec3 aInstanceSourceLow;  // Low precision component of source ECEF
attribute vec3 aInstanceTargetHigh; // High precision component of target ECEF
attribute vec3 aInstanceTargetLow;  // Low precision component of target ECEF

// Common instance attributes
attribute vec4 aInstanceParams1; // x=height, y=arcHeight, z=thickness, w=opacity
attribute vec3 aInstanceParams2; // x=segments, y=gradation, z=lineLength
attribute vec4 aInstanceDash;    // x=dashed, y=dashSize, z=gapSize, w=dashOffset
attribute vec3 aInstanceSrcColor;
attribute vec3 aInstanceTgtColor;

out vec3 vColor;
out float vOpacity;
out float vLineDistance;
out vec4 vDash;

#include <common>
#include <logdepthbuf_pars_vertex>

#include chunks/geographic;

// Arc angular size (radians) at which the surface-curvature "bulge" is faded
// in. Below LO the bulge is smaller than absolute-ECEF f32 cancellation noise
// (~1 m), so we render a precise eye-relative chord instead; between LO and HI
// we blend the geodesic curvature back so long arcs still hug the surface.
const float ARC_BULGE_OMEGA_LO = 5e-4; // ~3 km
const float ARC_BULGE_OMEGA_HI = 5e-3; // ~32 km

// Eye-relative position of the arc at parameter tt, precise to sub-meter near
// the camera. srcRel/tgtRel are the precise eye-relative endpoints; srcAbs/
// tgtAbs are absolute ECEF, used only for the geocentric up direction and the
// long-arc curvature bulge — both tolerate f32 magnitude.
vec3 arcPointRel(
  vec3 srcRel, vec3 tgtRel,
  vec3 srcAbs, vec3 tgtAbs,
  float bulgeWeight, float tt,
  float arcHeight, float extraHeight,
  float a, float e2
) {
  // Straight chord in precise eye-relative space (preserves tiny separations).
  vec3 chordRel = mix(srcRel, tgtRel, tt);

  // Surface point and straight chord share the same absolute f32 magnitude, so
  // their difference is the curvature bulge; trusted only for long arcs.
  vec3 geoAbs = ellipsoidGeodesic(srcAbs, tgtAbs, tt, a, e2);
  vec3 chordAbs = mix(srcAbs, tgtAbs, tt);
  vec3 baseRel = chordRel + (geoAbs - chordAbs) * bulgeWeight;

  // Lift along local geocentric up (direction stays accurate even for tiny arcs).
  vec3 upDir = normalize(geoAbs);
  float lift = arcHeight * sin(PI * tt);
  return baseRel + upDir * (lift + extraHeight);
}

void main() {
  // Unpack vertex data
  float t = aVertexData.x;
  float aSide = aVertexData.y;

  // Unpack instance params
  float aInstanceHeight = aInstanceParams1.x;
  float aInstanceArcHeight = aInstanceParams1.y;
  float aInstanceThickness = aInstanceParams1.z;
  float aInstanceOpacity = aInstanceParams1.w;
  float aInstanceSegments = aInstanceParams2.x;
  float aInstanceGradation = aInstanceParams2.y;

  float dt = 1.0 / aInstanceSegments;
  float t_dir = clamp(t + dt, 0.0, 1.0);

  // Absolute ECEF endpoints (f32) — used only for direction & curvature.
  vec3 srcAbs = aInstanceSourceHigh + aInstanceSourceLow;
  vec3 tgtAbs = aInstanceTargetHigh + aInstanceTargetLow;

  // Precise eye-relative endpoints (RTE): subtract the camera in high/low space
  // so the large ECEF magnitude cancels exactly and sub-meter separation
  // survives. u_rteOne (== 1.0) stops the compiler collapsing this back to
  // absolute-ECEF precision (see the uniform declaration above).
  vec3 srcRel = (aInstanceSourceHigh - u_cameraPositionHigh) * u_rteOne
              + (aInstanceSourceLow - u_cameraPositionLow);
  vec3 tgtRel = (aInstanceTargetHigh - u_cameraPositionHigh) * u_rteOne
              + (aInstanceTargetLow - u_cameraPositionLow);

  // Fade in surface curvature by arc angular size (robust to acos noise: short
  // arcs land below LO regardless of the noise, so bulgeWeight is exactly 0).
  float cosOmega = clamp(dot(normalize(srcAbs), normalize(tgtAbs)), -1.0, 1.0);
  float omega = acos(cosOmega);
  float bulgeWeight = smoothstep(ARC_BULGE_OMEGA_LO, ARC_BULGE_OMEGA_HI, omega);

  vec3 p0 = arcPointRel(srcRel, tgtRel, srcAbs, tgtAbs, bulgeWeight, t,
                        aInstanceArcHeight, aInstanceHeight, uA, uE2);
  vec3 p1_dir = arcPointRel(srcRel, tgtRel, srcAbs, tgtAbs, bulgeWeight, t_dir,
                            aInstanceArcHeight, aInstanceHeight, uA, uE2);

  // Use RTE model-view matrix (rotation only, no translation)
  vec4 clip0     = projectionMatrix * modelViewMatrixRTE * vec4(p0,     1.0);
  vec4 clip1_dir = projectionMatrix * modelViewMatrixRTE * vec4(p1_dir, 1.0);

  vec2 ndc0 = clip0.xy / clip0.w;
  vec2 ndc1dir = clip1_dir.xy / clip1_dir.w;

  // Construct line quad in NDC
  vec2 dir = normalize(ndc1dir - ndc0 + vec2(1e-6));
  vec2 normal = vec2(-dir.y, dir.x);
  vec2 pixel2NDC = vec2(aInstanceThickness / uViewport.x, aInstanceThickness / uViewport.y) * 2.0;
  vec2 offsetNDC = normal * aSide * pixel2NDC;

  vec4 outPos = clip0;
  outPos.xy += offsetNDC * clip0.w;
  gl_Position = outPos;

  #include <logdepthbuf_vertex>

  // Color interpolation
  vColor = mix(aInstanceSrcColor, aInstanceTgtColor, clamp(t + (0.5 - aInstanceGradation) * 2.0, 0.0, 1.0));
  vOpacity = aInstanceOpacity;

  vLineDistance = t * aInstanceParams2.z;
  vDash = aInstanceDash;
}