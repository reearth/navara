//ref: Reference URL https://www.shadertoy.com/view/MlfBWr

// ============================================================================
// Uniforms
// ============================================================================
uniform float time;
uniform vec2 resolution;
uniform float dropGridSize;
uniform float timeOffset;

// ============================================================================
// Constants
// ============================================================================
const float TWO_PI = 6.28318530718;
const float DROP_LAYERS = 4.0;            // Number of drop layers
const float DROP_SIZE_FACTOR = 0.015;     // Drop size coefficient
const float NOISE_SCALE = 200.0;          // Noise scale
const float REFRACTION_STRENGTH = 0.3;    // Refraction strength
const float MIN_DROP_STRENGTH = 0.01;     // Minimum drop strength
const float DROP_FADE_START = 0.3;        // Fade start position
const float DROP_FADE_END = 0.8;          // Fade end position
const float DROP_THRESHOLD_FACTOR = 0.08; // Drop display threshold factor

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
  float threshold = (5.0 - layerIndex) * DROP_THRESHOLD_FACTOR;
  float probability = smoothstep(threshold + 0.05, threshold - 0.05, randomValue);
  
  // Calculate strength (with fade in/out)
  float strength = smoothstep(DROP_FADE_START, DROP_FADE_END, dropShape);
  
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
  vec2 refractedUV = uv - dropNormal.xy * REFRACTION_STRENGTH * dropStrength;
  
  // Sample background at distorted UV coordinates
  return texture2D(inputBuffer, refractedUV);
}

// ============================================================================
// Main Shader
// ============================================================================
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Calculate time (convert milliseconds to seconds and add offset)
  float timeSec = time * 0.001 + timeOffset;
  
  // Position displacement by noise (randomize drop positions)
  vec2 normalizedUV = (uv * 0.1) / (resolution / resolution.x);
  vec2 displacement = noise(normalizedUV * NOISE_SCALE);
  
  // Final color (initial value is input color)
  vec4 finalColor = inputColor;
  
  // Generate drops in multiple layers (from large to small)
  for (float layerIndex = DROP_LAYERS; layerIndex > 0.0; layerIndex -= 1.0) {
    // Calculate drop grid size
    vec2 gridSize = resolution * layerIndex * DROP_SIZE_FACTOR * (dropGridSize / 12.0);
    
    // Calculate sine wave phase (including position displacement by noise)
    vec2 phase = TWO_PI * uv * gridSize + (displacement - 0.5) * 2.0;
    vec2 sinWave = sin(phase);
    
    // Current drop coordinates (rounded to grid)
    vec2 dropCoord = round(uv * gridSize - 0.25) / gridSize;
    
    // Drop properties (get four random values)
    vec4 dropProperties = vec4(noise(dropCoord * NOISE_SCALE), noise(dropCoord));
    
    // Calculate drop shape
    float dropShape = calculateDropShape(sinWave, timeSec, dropProperties);
    
    // Calculate drop display strength
    float dropStrength = calculateDropStrength(dropShape, layerIndex, dropProperties.r);
    
    // Apply refraction effect if strength is sufficient
    if (dropStrength > MIN_DROP_STRENGTH) {
      // Calculate normal vector
      vec3 dropNormal = calculateDropNormal(phase, dropShape);
      
      // Apply refraction effect and get color
      finalColor = applyRefraction(uv, dropNormal, dropStrength);
    }
  }
  
  // Output final color
  outputColor = finalColor;
}
