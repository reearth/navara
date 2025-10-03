//ref: Reference URL https://www.shadertoy.com/view/MlfBWr

// ============================================================================
// Uniforms
// ============================================================================
uniform float time;
uniform vec2 resolution;
uniform float dropGridSize;
uniform float dropDensity;
uniform float dropLayers;
uniform float dropSizeFactor;
uniform float noiseScale;
uniform float refractionStrength;
uniform float minDropStrength;
uniform float dropFadeStart;
uniform float dropFadeEnd;
uniform float dropThresholdFactor;
uniform float gridDensityLow;
uniform float gridDensityHigh;
uniform float jitterStrengthLow;
uniform float jitterStrengthHigh;

// ============================================================================
// Constants
// ============================================================================
const float TWO_PI = 6.28318530718;
const float MAX_DROP_LAYERS = 6.0;        // Upper bound for dynamic layer count
const float MIN_FADE_GAP = 0.01;          // Prevents fade range collapse

// ============================================================================
// Helper Functions
// ============================================================================

// Pseudo-random number generation (returns vec2)
vec2 rand(vec2 c) {
  return fract(sin(vec2(
    dot(c, vec2(12.9898, 78.233)),
    dot(c, vec2(0.16180, 0.31415))
  )) * vec2(43758.5453, 14142.1));
}

// Value noise generation (bilinear interpolation)
vec2 noise(vec2 p) {
  vec2 co = floor(p);
  vec2 mu = fract(p);
  // Smoothstep interpolation curve
  mu = 3.0 * mu * mu - 2.0 * mu * mu * mu;
  
  // Get random values at the four corners of the grid
  vec2 a = rand(co);
  vec2 b = rand(co + vec2(1.0, 0.0));
  vec2 c = rand(co + vec2(0.0, 1.0));
  vec2 d = rand(co + vec2(1.0, 1.0));
  
  // Bilinear interpolation
  return mix(mix(a, b, mu.x), mix(c, d, mu.x), mu.y);
}

// Calculate drop shape (approximate circle using sum of sine waves)
float calculateDropShape(vec2 sinWave, float timeSec, vec4 dropProperties) {
  // Sum of sine waves (maximum at center, minimum at edges)
  float shape = sinWave.x + sinWave.y;
  
  // Fade out over time
  float life = 1.0 - fract(timeSec * (dropProperties.b + 0.1) + dropProperties.g) * 2.0;
  float fade = max(0.0, life);
  
  return shape * fade;
}

// Calculate drop display strength
float calculateDropStrength(float dropShape, float layerIndex, float randomValue) {
  // Drop display probability (varies by layer)
  float baseThreshold = (5.0 - layerIndex) * dropThresholdFactor;

  // Density curve: <1.0 tightens threshold, >1.0 loosens it
  float densityNorm = clamp(dropDensity, 0.0, 2.0);
  float lowRange = clamp(1.0 - densityNorm, 0.0, 1.0);
  float highRange = clamp(densityNorm - 1.0, 0.0, 1.0);
  float densityScale = mix(1.0, 0.35, lowRange);
  densityScale = mix(densityScale, 1.5, highRange);

  // Keep large drops slightly easier to spawn when thinning
  float effectiveLayers = max(dropLayers, 1.0);
  float layerBias = mix(0.6, 1.0, layerIndex / effectiveLayers);
  float threshold = clamp(baseThreshold * densityScale * layerBias, 0.0, 0.95);

  float probability = smoothstep(threshold + 0.05, threshold - 0.05, randomValue);
  
  // Calculate strength (with fade in/out)
  float fadeStart = clamp(dropFadeStart, 0.0, 1.0 - MIN_FADE_GAP);
  float minFadeEnd = fadeStart + MIN_FADE_GAP;
  float fadeEnd = clamp(dropFadeEnd, minFadeEnd, 1.0);
  float strength = smoothstep(fadeStart, fadeEnd, dropShape);
  
  return strength * probability;
}

// Calculate drop normal vector
vec3 calculateDropNormal(vec2 sinWave, float dropShape) {
  // XY components: derivative of sine wave (slope)
  vec2 normalXY = cos(sinWave);
  
  // Z component: drop thickness (thick at center, thin at edges)
  float normalZ = mix(0.2, 2.0, dropShape - 0.5);
  
  // Normalize and return the normal vector
  return normalize(-vec3(normalXY, normalZ));
}

// Apply refraction effect
vec4 applyRefraction(vec2 uv, vec3 dropNormal, float dropStrength) {
  // Distort UV coordinates (in normal direction)
  vec2 refractedUV = uv - dropNormal.xy * refractionStrength * dropStrength;
  
  // Sample background at distorted UV coordinates
  return texture2D(inputBuffer, refractedUV);
}

// ============================================================================
// Main Shader
// ============================================================================
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Calculate time (convert milliseconds to seconds)
  float timeSec = time * 0.001;
  
  // Position displacement by noise (randomize drop positions)
  vec2 normalizedUV = (uv * 0.1) / (resolution / resolution.x);
  vec2 displacement = noise(normalizedUV * noiseScale);
  
  // Final color (initial value is input color)
  vec4 finalColor = inputColor;
  
  // Generate drops in multiple layers (from large to small)
  float layerCount = clamp(floor(dropLayers + 0.5), 1.0, MAX_DROP_LAYERS);

  for (float layerIndex = MAX_DROP_LAYERS; layerIndex > 0.0; layerIndex -= 1.0) {
    if (layerIndex > layerCount) {
      continue;
    }
    // Calculate drop grid size
    float densityNorm = clamp(dropDensity, 0.0, 2.0);
    float gridDensityAdjust = mix(gridDensityLow, 1.0, clamp(densityNorm, 0.0, 1.0));
    gridDensityAdjust = mix(gridDensityAdjust, gridDensityHigh, clamp(densityNorm - 1.0, 0.0, 1.0));
    vec2 gridSize = resolution * layerIndex * dropSizeFactor * (dropGridSize / 12.0) * gridDensityAdjust;
    
    // Calculate sine wave phase (including position displacement by noise)
    vec2 phase = TWO_PI * uv * gridSize + (displacement - 0.5) * 2.0;
    vec2 sinWave = sin(phase);
    
    // Current drop coordinates (rounded to grid)
    vec2 baseDropCoord = round(uv * gridSize - 0.25) / gridSize;
    float jitterStrength = mix(jitterStrengthLow, jitterStrengthHigh, clamp(densityNorm, 0.0, 1.0));
    vec2 jitter = (noise(baseDropCoord * (noiseScale * 0.37)) - 0.5) * jitterStrength / gridSize;
    vec2 dropCoord = baseDropCoord + jitter;
    
    // Drop properties (get four random values)
    vec4 dropProperties = vec4(noise(dropCoord * noiseScale), noise(dropCoord));
    
    // Calculate drop shape
    float dropShape = calculateDropShape(sinWave, timeSec, dropProperties);
    
    // Calculate drop display strength
    float dropStrength = calculateDropStrength(dropShape, layerIndex, dropProperties.r);
    
    // Apply refraction effect if strength is sufficient
    if (dropStrength > minDropStrength) {
      // Calculate normal vector
      vec3 dropNormal = calculateDropNormal(phase, dropShape);
      
      // Apply refraction effect and get color
      finalColor = applyRefraction(uv, dropNormal, dropStrength);
    }
  }
  
  // Output final color
  outputColor = finalColor;
}
