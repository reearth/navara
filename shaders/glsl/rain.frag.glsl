#include <common>
#include <lights_pars_begin>

#include chunks/simple_lights;

uniform float opacity;
uniform float alphaMax;
uniform float alphaMin;
uniform vec3 color;

varying vec3 vLocalLightDirection;
varying vec3 vNormal;

void main() {
  vec3 geometryNormal = vNormal;
  
  // Calculate dot product with local-space light direction
  float NL = clamp(dot(geometryNormal, normalize(vLocalLightDirection)), 0.0, 1.0);

  // Get light color from Three.js lighting system using ShaderChunk
  vec3 lightColor = NL * getDirLightColor();

  float alpha = mix(alphaMin, alphaMax, NL);

  // Apply base opacity
  alpha = clamp(alpha * opacity, 0.0, 1.0);

  vec3 irradiance = getIrradiance(geometryNormal);

  vec3 direct = lightColor * BRDF_Lambert(color);
  vec3 indirect = irradiance * BRDF_Lambert(color);

  vec3 finalColor = direct + indirect;

  gl_FragColor = vec4(finalColor, alpha);
}
