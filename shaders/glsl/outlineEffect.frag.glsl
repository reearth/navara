// Research and development by https://github.com/takram-design-engineering
// Ref: https://www.vertexfragment.com/ramblings/unity-postprocessing-sobel-outline

#include "core/depth"
#include "core/packing"
#include "core/math"

uniform sampler2D normalBuffer;
uniform float opacity;
uniform float depthOutlineThickness;
uniform float depthBias;
uniform float normalOutlineThickness;
uniform float normalBias;

vec3 readNormal(const vec2 uv) {
  return unpackVec2ToNormal(texture2D(normalBuffer, uv).xy);
}

float blendColorDodge(float base, float blend) {
  return blend == 1.0
    ? blend
    : base / (1.0 - blend);
}

vec3 blendColorDodge(vec3 base, vec3 blend) {
  return vec3(
    blendColorDodge(base.r, blend.r),
    blendColorDodge(base.g, blend.g),
    blendColorDodge(base.b, blend.b)
  );
}

vec3 blendColorDodge(vec3 base, vec3 blend, float opacity) {
  return blendColorDodge(base, blend) * opacity + base * (1.0 - opacity);
}

void mainImage(const vec4 inputColor, const vec2 uv, out vec4 outputColor) {
  vec3 offset;

  offset = vec3(depthOutlineThickness / resolution, 0.0);
  float depth = getViewZ(readDepth(uv));
  float depthUp = getViewZ(readDepth(uv + offset.zy));
  float depthDn = getViewZ(readDepth(uv - offset.zy));
  float depthRt = getViewZ(readDepth(uv + offset.xz));
  float depthLf = getViewZ(readDepth(uv - offset.xz));

  float depthResult =
    abs(depth - depthUp) +
    abs(depth - depthDn) +
    abs(depth - depthLf) +
    abs(depth - depthRt) -
    depthBias;

  offset = vec3(normalOutlineThickness / resolution, 0.0);
  vec3 normal = readNormal(uv);
  vec3 normalUp = readNormal(uv + offset.zy);
  vec3 normalDn = readNormal(uv - offset.zy);
  vec3 normalRt = readNormal(uv + offset.xz);
  vec3 normalLf = readNormal(uv - offset.xz);

  vec3 normalResult =
    abs(normal - normalUp) +
    abs(normal - normalDn) +
    abs(normal - normalRt) +
    abs(normal - normalLf);
  float normalScalar = normalResult.x + normalResult.y + normalResult.z - normalBias;

  float result = saturate(max(depthResult, normalScalar));
  result = pow(result, 4.0);

  outputColor = vec4(
      blendColorDodge(
          inputColor.rgb,
          vec3(result * saturate(remap(-depth, 0.0, 5e3, 1.0, 0.0))),
          opacity
      ),
      1.0
  );
}
