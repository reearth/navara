
in float vOpacity;
in vec3 vColor;
in float vLineDistance;
in vec4 vDash; // x=dashed, y=dashSize, z=gapSize, w=dashOffset

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
  
  gl_FragColor = vec4(vColor, vOpacity);
  
  #include <logdepthbuf_fragment>
}