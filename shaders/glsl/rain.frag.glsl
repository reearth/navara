#include <common>
#include <lights_pars_begin>

#include chunks/simple_lights;

uniform float opacity;
uniform float alphaMax;
uniform float alphaMin;
uniform vec3 color;

varying vec2 vUv;
varying vec3 vLocalLightDirection;
varying vec3 vNormal;

void main() {
  vec3 geometryNormal = vNormal;
  
  // Calculate dot product with local-space light direction
  float NL = clamp(dot(geometryNormal, normalize(vLocalLightDirection)), 0.1, 0.3);

  // Get light color from Three.js lighting system using ShaderChunk
  vec3 lightColor = NL * getDirLightColor();

  float alpha = mix(alphaMin, alphaMax, NL);

  vec3 irradiance = getIrradiance(geometryNormal);

  vec3 direct = lightColor * BRDF_Lambert(color);
  vec3 indirect = irradiance * BRDF_Lambert(color);

  vec3 finalColor = direct + indirect;

  float w = 1.0 - (abs(vUv.x - 0.5) + 0.5);
  if(w < 0.1) {
    alpha *= min(w * 10.0, 1.0); // Anti-aliasing
  }

  // Apply base opacity
  alpha = clamp(alpha * opacity, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, alpha);
}
