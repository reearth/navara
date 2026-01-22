/*******************************************************
 * Geographic Utilities for GLSL Shaders
 * 
 * Common geographic and geodetic calculations for use
 * across various shaders that work with Earth coordinates.
 *******************************************************/

#include "ellipsoid.glsl"

// Constants
const float DEG_TO_RAD = 0.017453292519943295;
const float RAD_TO_DEG = 57.29577951308232;
const float PI = 3.141592653589793;

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

// Convert ECEF Cartesian coordinates to lon/lat/alt (degrees, meters)
vec3 ecefToLonLat(vec3 ecef) {
  float x = ecef.x;
  float y = ecef.y;
  float z = ecef.z;

  float lon = atan(y, x) * RAD_TO_DEG;

  float p = sqrt(x * x + y * y);
  float theta = atan(z * WGS84_A, p * WGS84_B);
  float lat = atan(z + WGS84_E2_SECOND * WGS84_B * pow(sin(theta), 3.0),
                    p - WGS84_E2 * WGS84_A * pow(cos(theta), 3.0)) * RAD_TO_DEG;
  
  float N = WGS84_A / sqrt(1.0 - WGS84_E2 * sin(lat * DEG_TO_RAD) * sin(lat * DEG_TO_RAD));
  float alt = p / cos(lat * DEG_TO_RAD) - N;

  return vec3(lon, lat, alt);
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
    // Handle nearly identical points
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