
in float vOpacity;
in vec3 vColor;
in float vLineDistance;
in vec4 vDash; // x=dashed, y=dashSize, z=gapSize, w=dashOffset

uniform float uBloomMaskPass;
uniform float uOutlineMaskPass;

#include <logdepthbuf_pars_fragment>

void main() {
  if (vDash.x > 0.5) {
    float dashSize   = vDash.y;
    float gapSize    = vDash.z;
    float dashOffset = vDash.w;

    float unit = dashSize + gapSize;
    if (unit > 0.0) {
      float d = mod(vLineDistance + dashOffset, unit);
      if (d > dashSize) {
        discard;
      }
    }
  }

  // Calculate screen-space normal for line geometry
  vec3 fdx = dFdx(gl_FragCoord.xyz);
  vec3 fdy = dFdy(gl_FragCoord.xyz);
  vec3 normal = normalize(cross(fdx, fdy));
  
  // Ensure normal faces camera
  if (normal.z < 0.0) normal = -normal;
  
  #include <logdepthbuf_fragment>

  // Selective effect mask pass — combined bloom+outline output
  if (uBloomMaskPass > 0.5 || uOutlineMaskPass > 0.5) {
    gl_FragColor = vec4(
      vColor * uBloomMaskPass,
      uOutlineMaskPass
    );
    return;
  }

  gl_FragColor = vec4(vColor, vOpacity);
}