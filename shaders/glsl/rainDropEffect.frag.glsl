// ref: Reference URL https://www.shadertoy.com/view/ltffzl
// ref: Reference URL https://www.youtube.com/watch?v=EBrAdahFtuo

#define S(a, b, t) smoothstep(a, b, t)

uniform float time;
uniform vec2 resolution;
uniform float dropGridSize;   // grid density for raindrops (e.g., 12.0)
uniform float timeOffset;     // temporal offset for animation phase

// ------------------------------------------------------------
// Random utilities (IQ-style hash functions)
// ------------------------------------------------------------
float N21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float Saw(float b, float t) {
  return S(0.0, b, t) * S(1.0, b, t);
}

// ------------------------------------------------------------
// Procedural raindrop cell (mask + trail intensity)
// ------------------------------------------------------------
vec2 DropLayer(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 aspect = vec2(6.0, 1.0);
  vec2 grid = aspect * 2.0;
  vec2 id = floor(uv * grid);

  float colShift = N21(vec2(id.x, 0.0));
  uv.y += colShift;

  id = floor(uv * grid);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(0.5, 0.0);

  float x = n.x - 0.5;

  float y = UV.y * 20.0;
  float wiggle = sin(y + sin(y));
  x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
  x *= 0.7;
  float ti = fract(t + n.z);
  y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
  vec2 dropCenter = vec2(x, y);

  float d = length((st - dropCenter) * aspect.yx);
  float mainDrop = S(0.4, 0.0, d);

  float r = sqrt(S(1.0, y, st.y));
  float cd = abs(st.x - x);
  float trail = S(0.23 * r, 0.15 * r * r, cd);
  float trailFront = S(-0.02, 0.02, st.y - y);
  trail *= trailFront * r * r;

  float trail2 = S(0.2 * r, 0.0, cd);
  float droplets = max(0.0, (sin(UV.y * (1.0 - UV.y) * 120.0) - st.y)) * trail2 * trailFront * n.z;
  float yDroplet = fract(UV.y * 10.0) + (st.y - 0.5);
  float dd = length(st - vec2(x, yDroplet));
  droplets = S(0.3, 0.0, dd);

  float mask = mainDrop + droplets * r * trailFront;
  return vec2(mask, trail);
}

// ------------------------------------------------------------
// Static micro droplets clinging to the glass
// ------------------------------------------------------------
float StaticDrops(vec2 uv, float t) {
  uv *= 40.0;
  vec2 id = floor(uv);
  uv = fract(uv) - 0.5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - 0.5) * 0.7;
  float d = length(uv - p);
  float fade = Saw(0.025, fract(t + n.z));
  float c = S(0.3, 0.0, d) * fract(n.z * 10.0) * fade;
  return c;
}

// ------------------------------------------------------------
// Combine layer stack: static droplets + two large-drop layers
// ------------------------------------------------------------
vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer(uv, t) * l1;
  vec2 m2 = DropLayer(uv * 1.85, t) * l2;

  float c = s + m1.x + m2.x;
  c = S(0.3, 1.0, c);

  return vec2(c, max(m1.y * l0, m2.y * l1));
}

// ------------------------------------------------------------
// Finite-difference fallback for height gradients when derivatives
// are unavailable
// ------------------------------------------------------------
vec2 DropsNormal(vec2 uv, float t, float l0, float l1, float l2, vec2 pixelOffset) {
  vec2 forward = Drops(uv + pixelOffset, t, l0, l1, l2);
  vec2 backward = Drops(uv - pixelOffset, t, l0, l1, l2);
  float center = Drops(uv, t, l0, l1, l2).x;
  return vec2(forward.x - center, center - backward.x);
}

// ------------------------------------------------------------
// Main pass
// ------------------------------------------------------------
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float timeSec = time * 0.001 + timeOffset;

  vec2 uvCentered = uv - 0.5;
  float screenAspect = resolution.x / resolution.y;
  vec2 uvSquare = uvCentered * vec2(screenAspect, 1.0);

  // ------------------ Build raindrop mask ------------------
  vec2 uvRain = uvSquare * dropGridSize * 0.2;
  float rainTime = timeSec * 0.3;

  float rainAmount = 0.75;
  float staticMix = mix(0.8, 1.8, rainAmount);
  float layer1 = mix(0.4, 0.9, rainAmount);
  float layer2 = mix(0.25, 0.7, rainAmount);

  vec2 dropData = Drops(uvRain, rainTime, staticMix, layer1, layer2);
  float drop = clamp(dropData.x, 0.0, 1.0);
  float trail = clamp(dropData.y, 0.0, 1.0);
  float fogTrail = clamp(dropData.y * 0.8, 0.0, 1.0);

  float rainMask = clamp(drop + fogTrail * 0.5, 0.0, 1.0);
  float streakHighlight = clamp(trail * 1.4, 0.0, 1.0);
  vec3 rainTint = vec3(0.4, 0.55, 0.75);

  float height = drop * 0.75 + trail * 0.25;
  vec2 heightGrad = vec2(0.0);

  heightGrad = vec2(dFdx(height), dFdy(height));

  const float DISTORTION_STRENGTH = 0.045;
  vec2 distortion = vec2(-heightGrad.x, heightGrad.y) * (DISTORTION_STRENGTH * rainMask);

  vec2 jitter = vec2(N21(floor(uvRain * 64.0)), N21(floor(uvRain.yx * 64.0))) - 0.5;
  jitter *= 0.004 * rainMask;

  vec2 refractUV = clamp(uv + distortion + jitter, vec2(0.0), vec2(1.0));

  // ------------------ Sample refracted background ------------------
  vec3 sceneColor = inputColor.rgb;
  vec3 refractedColor = texture2D(inputBuffer, refractUV).rgb;

  vec2 texel = 1.0 / resolution;
  vec3 blurredColor = (
    texture2D(inputBuffer, clamp(refractUV + texel * vec2(1.0, 0.0), vec2(0.0), vec2(1.0))).rgb +
    texture2D(inputBuffer, clamp(refractUV - texel * vec2(1.0, 0.0), vec2(0.0), vec2(1.0))).rgb +
    texture2D(inputBuffer, clamp(refractUV + texel * vec2(0.0, 1.0), vec2(0.0), vec2(1.0))).rgb +
    texture2D(inputBuffer, clamp(refractUV - texel * vec2(0.0, 1.0), vec2(0.0), vec2(1.0))).rgb
  ) * 0.25;

  vec3 baseColor = mix(refractedColor, blurredColor, clamp(height * 1.2, 0.0, 1.0));
  vec3 tintedColor = mix(baseColor, baseColor * rainTint, clamp(rainMask * 0.2, 0.0, 1.0));

  // ------------------ Composite final color ------------------
  vec3 rainColor = mix(sceneColor, tintedColor, rainMask);
  vec3 highlightColor = mix(rainColor, baseColor, 0.6);
  rainColor = mix(rainColor, highlightColor, clamp(streakHighlight * 0.35, 0.0, 1.0));

  outputColor = vec4(rainColor, inputColor.a);
}
