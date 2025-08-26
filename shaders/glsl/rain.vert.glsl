#include <common>
#include <lights_pars_begin>

attribute float index;
attribute vec2 offset;

uniform float time;
uniform float speed;
uniform vec3 color;
uniform float areaWidth;
uniform float areaHeight;
uniform vec2 size;
uniform vec3 cameraRight;
uniform vec3 cameraUp;
uniform vec3 meshOffset;
uniform vec3 bounds;
uniform bool followCamera;
uniform float radius;

varying vec2 vUv;
varying vec3 vColor;
varying vec3 vLocalLightDirection;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vColor = color;

  vec3 transformed = position;
  transformed.y = fract(transformed.y - time * speed) - 0.5;
  transformed.xz *= areaWidth;
  transformed.y *= areaHeight;
  
  // Apply infinite scrolling when followCamera is enabled
  if (followCamera) {
    // Apply mesh offset to vertices
    vec3 offsetPos = transformed + meshOffset;
    
    // Wrap particles around the bounds
    offsetPos.x = mod(offsetPos.x + bounds.x * 0.5, bounds.x) - bounds.x * 0.5;
    offsetPos.y = mod(offsetPos.y + bounds.y * 0.5, bounds.y) - bounds.y * 0.5;
    offsetPos.z = mod(offsetPos.z + bounds.z * 0.5, bounds.z) - bounds.z * 0.5;
    
    transformed = offsetPos;
  }
  
  // TODO: Support other light types.
  // Get light direction from Three.js directional light
  vec3 lightDirection = vec3(0.0, 1.0, 0.0); // Default fallback
  #if ( NUM_DIR_LIGHTS > 0 )
    lightDirection = directionalLights[0].direction;
  #endif
  
  // Create transformation matrix from world space to billboard local space
  vLocalLightDirection = lightDirection;

  vec2 scaledSize = size;

vec3 normalizedPosition = vec3(transformed.x, 0.0, transformed.z);
  float dist = length(normalizedPosition) / length(vec3(bounds.x, 0.0, bounds.z) * 0.5);
  if (dist < 0.1) {
    scaledSize.x *= dist;
  } else {
    scaledSize.x *= dist;
  }
  
  // Create billboard quad using pre-calculated camera vectors
  vec3 worldPos = transformed + cameraRight * offset.x * scaledSize.x + cameraUp * offset.y * scaledSize.y;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

  vViewPosition = gl_Position.xyz;

  // Core idea: one billboard, two virtual sides using local X coordinate
  // Create pseudo-normal that flips based on which side of the quad we're on
  float k = 0.7; // Small tilt so normal isn't exactly forward
  vNormal = normalize(vec3(offset.x * k, 0.0, 1.0)) * normalMatrix;
}
