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

precision highp float;

uniform float uThickness;
uniform vec2  uViewport;
uniform float uSegments;
uniform float uHeight;
uniform highp float uR;
uniform float uA;
uniform float uB;
uniform float uE2;
uniform vec3 uSrcColor;
uniform vec3 uTgtColor;

attribute float aT;      // Interpolation parameter along the arc
attribute float aSide;   // Line side (-1 or 1)

// Instance attributes - per arc instance (lon/lat positions)
attribute vec2 aInstanceSource; // lon, lat
attribute vec2 aInstanceTarget; // lon, lat
attribute float aInstanceHeight;

varying vec3 vColor;

#include <common>
#include <logdepthbuf_pars_vertex>

// Constants
const float DEG_TO_RAD = 0.017453292519943295;
const float RAD_TO_DEG = 57.29577951308232;

// Rotate vector v around arbitrary axis
vec3 rotateAroundAxis(vec3 v, vec3 axis, float angle) {
  float c = cos(angle); 
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

// Convert lon/lat (degrees) to Cartesian coordinates on WGS84 ellipsoid
vec3 lonLatToEllipsoid(float lon, float lat, float a, float e2) {
  float lonR = lon * DEG_TO_RAD;
  float latR = lat * DEG_TO_RAD;

  float sinLat = sin(latR);
  float cosLat = cos(latR);
  float N = a / sqrt(1.0 - e2 * sinLat * sinLat); // Radius of curvature in the prime vertical

  float x = N * cosLat * cos(lonR);
  float y = N * cosLat * sin(lonR);
  float z = N * (1.0 - e2) * sinLat;

  return vec3(x, y, z);
}

// Geodesic interpolation on ellipsoid (spherical interpolation + ellipsoid projection)
vec3 ellipsoidGeodesic(vec3 s, vec3 t, float tt, float a, float e2) {
  // Normalize start and target points
  vec3 sN = normalize(s); 
  vec3 tN = normalize(t);
  float d = clamp(dot(sN, tN), -1.0, 1.0);
  float omega = acos(d);

  // Spherical interpolation
  vec3 spherePoint;
  if (abs(omega) < 1e-6) {
    spherePoint = sN;
  } else if (abs(PI - omega) < 1e-5) {
    // Handle nearly opposite points
    vec3 aux = abs(sN.z) < 0.9 ? vec3(0.0,0.0,1.0) : vec3(0.0,1.0,0.0);
    vec3 axis = normalize(cross(sN, aux));
    spherePoint = normalize(rotateAroundAxis(sN, axis, PI * tt));
  } else {
    float sinO = sin(omega);
    vec3 dir = (sin((1.0 - tt) * omega) / sinO) * sN
              + (sin(tt * omega) / sinO) * tN;
    spherePoint = normalize(dir);
  }

  // Convert back to lon/lat and project onto ellipsoid
  float lon = atan(spherePoint.y, spherePoint.x) * RAD_TO_DEG;
  float lat = asin(clamp(spherePoint.z, -1.0, 1.0)) * RAD_TO_DEG;

  return lonLatToEllipsoid(lon, lat, a, e2);
}

void main() {
  float t = aT;
  float dt = 1.0 / uSegments;
  float t2 = min(1.0, t + dt);

  vec3 source3D = lonLatToEllipsoid(aInstanceSource.x, aInstanceSource.y, uA, uE2);
  vec3 target3D = lonLatToEllipsoid(aInstanceTarget.x, aInstanceTarget.y, uA, uE2);

  // First vertex along the arc
  vec3 base0 = ellipsoidGeodesic(source3D, target3D, t,  uA, uE2);
  float lift0 = aInstanceHeight * sin(PI * t);
  vec3 p0 = normalize(base0) * (length(base0) + lift0 + uHeight);

  // Second vertex along the arc
  vec3 base1 = ellipsoidGeodesic(source3D, target3D, t2, uA, uE2);
  float lift1 = aInstanceHeight * sin(PI * t2);
  vec3 p1 = normalize(base1) * (length(base1) + lift1 + uHeight);

  // Project to clip space
  vec4 clip0 = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);
  vec4 clip1 = projectionMatrix * modelViewMatrix * vec4(p1, 1.0);
  vec2 ndc0 = clip0.xy / clip0.w;
  vec2 ndc1 = clip1.xy / clip1.w;

  // Construct line quad in NDC
  vec2 dir = normalize(ndc1 - ndc0 + vec2(1e-6));
  vec2 normal = vec2(-dir.y, dir.x);
  vec2 pixel2NDC = vec2(uThickness / uViewport.x, uThickness / uViewport.y) * 2.0;
  vec2 offsetNDC = normal * aSide * pixel2NDC;

  vec4 outPos = clip0;
  outPos.xy += offsetNDC * clip0.w;
  gl_Position = outPos;
  
  #include <logdepthbuf_vertex>

  // Color interpolation
  vColor = mix(uSrcColor, uTgtColor, t);
}