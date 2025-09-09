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
uniform highp float uR;
uniform float uA;
uniform float uB;
uniform float uE2;

// Packed vertex attributes  
attribute vec2 aVertexData; // x=aT, y=aSide 

// Instance attributes - per arc instance
attribute vec4 aInstanceSourceTarget; // x=srcLon, y=srcLat, z=tgtLon, w=tgtLat
attribute vec4 aInstanceParams; // x=height, y=arcHeight, z=thickness, w=opacity
attribute float aInstanceSegments; // Number of segments
attribute vec3 aInstanceSrcColor;
attribute vec3 aInstanceTgtColor;

out vec3 vColor;
out float vOpacity;

#include <common>
#include <logdepthbuf_pars_vertex>

#include chunks/geographic;

void main() {
  // Unpack vertex data
  float aT = aVertexData.x;
  float aSide = aVertexData.y;
  
  // Unpack instance params
  float aInstanceHeight = aInstanceParams.x;
  float aInstanceArcHeight = aInstanceParams.y;
  float aInstanceThickness = aInstanceParams.z;
  float aInstanceOpacity = aInstanceParams.w;
  
  // Unpack source/target coordinates
  vec2 aInstanceSource = aInstanceSourceTarget.xy;
  vec2 aInstanceTarget = aInstanceSourceTarget.zw;
  
  float t = aT;
  float dt = 1.0 / aInstanceSegments;
  float t2 = min(1.0, t + dt);

  vec3 source3D = lonLatToEllipsoid(aInstanceSource.x, aInstanceSource.y, uA, uE2);
  vec3 target3D = lonLatToEllipsoid(aInstanceTarget.x, aInstanceTarget.y, uA, uE2);

  // First vertex along the arc
  vec3 base0 = ellipsoidGeodesic(source3D, target3D, t,  uA, uE2);
  float lift0 = aInstanceArcHeight * sin(PI * t);
  vec3 p0 = normalize(base0) * (length(base0) + lift0 + aInstanceHeight);

  // Second vertex along the arc
  vec3 base1 = ellipsoidGeodesic(source3D, target3D, t2, uA, uE2);
  float lift1 = aInstanceArcHeight * sin(PI * t2);
  vec3 p1 = normalize(base1) * (length(base1) + lift1 + aInstanceHeight);

  // Project to clip space
  vec4 clip0 = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);
  vec4 clip1 = projectionMatrix * modelViewMatrix * vec4(p1, 1.0);
  vec2 ndc0 = clip0.xy / clip0.w;
  vec2 ndc1 = clip1.xy / clip1.w;

  // Construct line quad in NDC
  vec2 dir = normalize(ndc1 - ndc0 + vec2(1e-6));
  vec2 normal = vec2(-dir.y, dir.x);
  vec2 pixel2NDC = vec2(aInstanceThickness / uViewport.x, aInstanceThickness / uViewport.y) * 2.0;
  vec2 offsetNDC = normal * aSide * pixel2NDC;

  vec4 outPos = clip0;
  outPos.xy += offsetNDC * clip0.w;
  gl_Position = outPos;
  
  #include <logdepthbuf_vertex>

  // Color interpolation
  vColor = mix(aInstanceSrcColor, aInstanceTgtColor, t);
  vOpacity = aInstanceOpacity;
}