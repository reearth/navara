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

varying vec2 vUv;
varying vec3 vColor;

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
  
  // Create billboard quad using pre-calculated camera vectors
  vec3 worldPos = transformed + cameraRight * offset.x * size.x + cameraUp * offset.y * size.y;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
