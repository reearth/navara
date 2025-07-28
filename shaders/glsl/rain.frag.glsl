#include <common>
#include <lights_pars_begin>

#include chunks/simple_lights;

uniform float opacity;
uniform float alphaMax;
uniform float alphaMin;
uniform vec3 color;

varying vec2 vUv;
varying float vLocalX;
varying vec3 vLocalLightDirection;

void main() {
  // Core idea: one billboard, two virtual sides using local X coordinate
  // Create pseudo-normal that flips based on which side of the quad we're on
  float k = 0.8; // Small tilt so normal isn't exactly forward
  vec3 geometryNormal = normalize(vec3(sin(vLocalX) * k, 0.0, 1.0));
  
  // Calculate dot product with local-space light direction
  float NL = clamp(dot(geometryNormal, normalize(vLocalLightDirection)), 0.0, 1.0);

  // Get light color from Three.js lighting system using ShaderChunk
  vec3 lightColor = getDirLightColor();

  float alpha = mix(alphaMin, alphaMax, NL);

  // Apply base opacity
  alpha = clamp(alpha * opacity, 0.0, 1.0);
  
  // Discard pixels with very low alpha for soft edges
  if (alpha < 0.001) discard;

  vec3 irradiance = getIrradiance(geometryNormal);

  lightColor += irradiance;
  lightColor *= alpha;

  vec3 finalColor = color * lightColor;

  gl_FragColor = vec4(finalColor, alpha);
}
