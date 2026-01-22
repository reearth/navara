/*******************************************************
 * Description:
 *   Vertex shader for rendering geodesic arcs on the WGS84
 *   ellipsoid. Supports line thickness in screen space,
 *   smooth color interpolation (uniform or per-instance),
 *   and arc lifting with sine modulation.
 *
 *   Key features:
 *     - Convert lon/lat to Cartesian ellipsoid coordinates
 *     - Geodesic interpolation between source & target
 *     - Screen-space line quad expansion
 *     - Per-instance and uniform color modes
*******************************************************/

// The implementation is based on the principles of deck.gl's ArcLayer
// https://github.com/visgl/deck.gl/blob/master/modules/layers/src/arc-layer/arc-layer-vertex.glsl.ts

precision highp float;

uniform vec2  uViewport;
uniform float uA;
uniform float uE2;
uniform bool  useRTE;

// RTE uniforms - camera position encoded as high/low precision
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;
uniform mat4 modelViewMatrixRTE;

// Packed vertex attributes
attribute vec2 aVertexData; // x=aT, y=aSide

// Instance attributes - per arc instance
// RTE mode: ECEF coordinates with high/low precision encoding
attribute vec3 aInstanceSourceHigh; // High precision component of source ECEF
attribute vec3 aInstanceSourceLow;  // Low precision component of source ECEF
attribute vec3 aInstanceTargetHigh; // High precision component of target ECEF
attribute vec3 aInstanceTargetLow;  // Low precision component of target ECEF

// Non-RTE mode: lon/lat coordinates
attribute vec4 aInstanceSourceTarget; // x=srcLon, y=srcLat, z=tgtLon, w=tgtLat

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
  float t_dir2 = clamp(t + dt, 0.0, 1.0);
  float t_pos2 = min(1.0, t + dt);

  vec3 p0, p1_pos, p1_dir;
  vec4 clip0, clip1_pos, clip1_dir;

  if (useRTE) {
    // RTE mode: use high/low precision ECEF coordinates

    // Decode ECEF positions from high/low precision components (absolute world positions)
    vec3 source3D_abs = aInstanceSourceHigh + aInstanceSourceLow;
    vec3 target3D_abs = aInstanceTargetHigh + aInstanceTargetLow;

    // Apply RTE transformation: make coordinates relative to camera
    vec3 cameraPos = u_cameraPositionHigh + u_cameraPositionLow;

    // Interpolate along geodesic using absolute positions
    vec3 base0_abs = ellipsoidGeodesic(source3D_abs, target3D_abs, t, uA, uE2);
    vec3 base1_pos_abs = ellipsoidGeodesic(source3D_abs, target3D_abs, t_pos2, uA, uE2);
    vec3 base1_dir_abs = ellipsoidGeodesic(source3D_abs, target3D_abs, t_dir2, uA, uE2);

    float lift0 = aInstanceArcHeight * sin(PI * t);
    float lift1_pos = aInstanceArcHeight * sin(PI * t_pos2);
    float lift1_dir = aInstanceArcHeight * sin(PI * clamp(t_dir2, 0.0, 1.0));

    // Apply height and lift, then make relative to camera
    p0      = normalize(base0_abs)     * (length(base0_abs)     + lift0     + aInstanceHeight) - cameraPos;
    p1_pos  = normalize(base1_pos_abs) * (length(base1_pos_abs) + lift1_pos + aInstanceHeight) - cameraPos;
    p1_dir  = normalize(base1_dir_abs) * (length(base1_dir_abs) + lift1_dir + aInstanceHeight) - cameraPos;

    // Use RTE model-view matrix (rotation only, no translation)
    clip0     = projectionMatrix * modelViewMatrixRTE * vec4(p0,     1.0);
    clip1_pos = projectionMatrix * modelViewMatrixRTE * vec4(p1_pos, 1.0);
    clip1_dir = projectionMatrix * modelViewMatrixRTE * vec4(p1_dir, 1.0);
  } else {
    // Non-RTE mode: use lon/lat coordinates (original implementation)

    vec2 aInstanceSource = aInstanceSourceTarget.xy;
    vec2 aInstanceTarget = aInstanceSourceTarget.zw;

    vec3 source3D = lonLatToEllipsoid(aInstanceSource.x, aInstanceSource.y, uA, uE2);
    vec3 target3D = lonLatToEllipsoid(aInstanceTarget.x, aInstanceTarget.y, uA, uE2);

    vec3 base0 = ellipsoidGeodesic(source3D, target3D, t, uA, uE2);
    vec3 base1_pos = ellipsoidGeodesic(source3D, target3D, t_pos2, uA, uE2);
    vec3 base1_dir = ellipsoidGeodesic(source3D, target3D, t_dir2, uA, uE2);

    float lift0 = aInstanceArcHeight * sin(PI * t);
    float lift1_pos = aInstanceArcHeight * sin(PI * t_pos2);
    float lift1_dir = aInstanceArcHeight * sin(PI * clamp(t_dir2, 0.0, 1.0));

    p0      = normalize(base0)     * (length(base0)     + lift0     + aInstanceHeight);
    p1_pos  = normalize(base1_pos) * (length(base1_pos) + lift1_pos + aInstanceHeight);
    p1_dir  = normalize(base1_dir) * (length(base1_dir) + lift1_dir + aInstanceHeight);

    clip0     = projectionMatrix * modelViewMatrix * vec4(p0,     1.0);
    clip1_pos = projectionMatrix * modelViewMatrix * vec4(p1_pos, 1.0);
    clip1_dir = projectionMatrix * modelViewMatrix * vec4(p1_dir, 1.0);
  }

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