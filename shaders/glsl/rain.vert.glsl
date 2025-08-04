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
uniform vec3 xAxisBase;
uniform vec3 yAxisBase;
uniform vec3 meshOffset;
uniform vec3 bounds;
uniform bool followCamera;

varying vec3 vColor;
varying float vLocalX;
varying vec3 vLocalLightDirection;

void main() {
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
  
  // Pass local X coordinate to fragment shader for side determination
  vLocalX = offset.x;
  
  // Transform light direction to billboard local space using Three.js lighting
  // Use xAxisBase and yAxisBase for accurate light transformation (updated with camera movement)
  vec3 zAxisBase = normalize(cross(xAxisBase, yAxisBase));
  
  // Get light direction from Three.js directional light
  vec3 lightDirection = vec3(0.0, 1.0, 0.0); // Default fallback
  #if ( NUM_DIR_LIGHTS > 0 )
    lightDirection = directionalLights[0].direction;
  #endif
  
  // Create transformation matrix from world space to billboard local space
  vLocalLightDirection = vec3(
    dot(lightDirection, xAxisBase),    // X component in local space
    dot(lightDirection, yAxisBase),    // Y component in local space
    dot(lightDirection, zAxisBase)     // Z component in local space
  );
  
  // Create billboard quad using pre-calculated camera vectors
  vec3 worldPos = transformed + cameraRight * offset.x * size.x + cameraUp * offset.y * size.y;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
