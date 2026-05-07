#ifndef OCTAHEDRAL_NORMAL_SAMPLING_GLSL
#define OCTAHEDRAL_NORMAL_SAMPLING_GLSL

// Manual bilinear interpolation for octahedral-encoded normals
// Hardware bilinear filtering doesn't work correctly on encoded normals
// because the encoding is non-linear
vec3 sampleBilinearNormal(sampler2D normalMap, vec2 baseUv, vec2 texelSize, vec2 frac) {
  // Sample 4 packed normals at corners
  vec2 packed00 = texture2D(normalMap, baseUv).rg;
  vec2 packed10 = texture2D(normalMap, baseUv + vec2(texelSize.x, 0.0)).rg;
  vec2 packed01 = texture2D(normalMap, baseUv + vec2(0.0, texelSize.y)).rg;
  vec2 packed11 = texture2D(normalMap, baseUv + texelSize).rg;

  // Unpack octahedral-encoded normals
  // Input is expected to be in [0,1] range, convert to [-1,1] before unpacking
  vec3 n00 = unpackVec2ToNormal(packed00 * 2.0 - 1.0);
  vec3 n10 = unpackVec2ToNormal(packed10 * 2.0 - 1.0);
  vec3 n01 = unpackVec2ToNormal(packed01 * 2.0 - 1.0);
  vec3 n11 = unpackVec2ToNormal(packed11 * 2.0 - 1.0);

  // Bilinear interpolation in normal space
  vec3 n0 = mix(n00, n10, frac.x);
  vec3 n1 = mix(n01, n11, frac.x);
  return mix(n0, n1, frac.y);
}

#endif // OCTAHEDRAL_NORMAL_SAMPLING_GLSL
