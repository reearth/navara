//ref: Reference URL https://www.shadertoy.com/view/MlfBWr

uniform float time;
uniform vec2 resolution;
uniform float dropGridSize;
uniform float timeOffset;

// Random function returning vec2
vec2 rand(vec2 c) {
  mat2 m = mat2(12.9898, 0.16180, 78.233, 0.31415);
  return fract(sin(m * c) * vec2(43758.5453, 14142.1));
}

// Noise function returning vec2
vec2 noise(vec2 p) {
  vec2 co = floor(p);
  vec2 mu = fract(p);
  mu = 3.0 * mu * mu - 2.0 * mu * mu * mu;
  vec2 a = rand((co + vec2(0.0, 0.0)));
  vec2 b = rand((co + vec2(1.0, 0.0)));
  vec2 c = rand((co + vec2(0.0, 1.0)));
  vec2 d = rand((co + vec2(1.0, 1.0)));
  return mix(mix(a, b, mu.x), mix(c, d, mu.x), mu.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float timeSec = time * 0.001 + timeOffset;
  
  vec2 v = (uv * 0.1) / (resolution / resolution.x);
  vec2 n = noise(v * 200.0); // Displacement
  
  // Start with input color
  vec4 f = inputColor;
  
  // Loop through the different inverse sizes of drops
  for (float r = 4.0; r > 0.0; r -= 1.0) {
    vec2 x = resolution * r * 0.015 * (dropGridSize / 12.0); // Number of potential drops (in a grid)
    vec2 p = 6.28 * uv * x + (n - 0.5) * 2.0;
    vec2 s = sin(p);
    
    // Current drop properties. Coordinates are rounded to ensure a
    // consistent value among the fragment of a given drop.
    vec2 dropCoord = round(uv * x - 0.25) / x;
    vec4 d = vec4(noise(dropCoord * 200.0), noise(dropCoord));
    
    // Drop shape and fading
    float t = (s.x + s.y) * max(0.0, 1.0 - fract(timeSec * (d.b + 0.1) + d.g) * 2.0);
    
    // d.r -> only x% of drops are kept on, with x depending on the size of drops
    float dropThreshold = (5.0 - r) * 0.08;
    float dropProbability = smoothstep(dropThreshold + 0.05, dropThreshold - 0.05, d.r);
    float dropStrength = smoothstep(0.3, 0.8, t) * dropProbability;
    
    if (dropStrength > 0.01) {
      // Drop normal
      vec3 dropNormal = normalize(-vec3(cos(p), mix(0.2, 2.0, t - 0.5)));
      
      // Poor man's refraction (same as ShaderToy version)
      // Distort UV coordinates based on drop normal
      vec2 refractedUV = uv - dropNormal.xy * 0.3 * dropStrength;
      
      // Sample the input buffer at the distorted UV coordinates
      vec4 refractedColor = texture2D(inputBuffer, refractedUV);
      
      // Add subtle water shimmer effect (very weak)
      float shimmer = dropStrength * 0.05;
      refractedColor.rgb += vec3(shimmer * 0.5, shimmer * 0.6, shimmer * 0.7);
      
      f = vec4(mix(f.rgb, refractedColor.rgb, dropStrength), inputColor.a);
    }
  }
  
  outputColor = f;
}
