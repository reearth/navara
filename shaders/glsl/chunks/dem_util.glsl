#ifndef DEM_UTIL_GLSL
#define DEM_UTIL_GLSL

// Utility functions for DEM texture sampling with bilinear interpolation
// Shared between hillshade and elevation heatmap

// Check if a number is a power of 2 using bit manipulation
// For power of 2: n & (n-1) == 0
// Examples: 8 (1000) & 7 (0111) = 0, 6 (110) & 5 (101) = 4 ≠ 0
bool isPowerOfTwo(int n) {
  return n > 0 && ((n & (n - 1)) == 0);
}

// Structure to hold bilinear sampling data
struct DEMBilinearData {
  ivec2 p00, p10, p01, p11;  // Pixel coordinates for 4 samples
  vec2 frac;                  // Interpolation weights
};

// Prepare bilinear sampling data from texture and UV coordinates
// Handles both padded and non-padded textures
// Returns pixel coordinates and interpolation weights
DEMBilinearData prepareDEMBilinear(sampler2D demTexture, vec2 uv) {
  // Get actual texture size
  ivec2 actualTexSize = textureSize(demTexture, 0);
  vec2 paddedTexSize = vec2(actualTexSize);

  // Detect if texture has padding by checking if it's a power of 2
  // 256, 512, 1024, 2048 = power of 2 = no padding
  // 258, 514, 1026, 2050 = power of 2 + 2 = has padding
  bool hasPadding = !isPowerOfTwo(actualTexSize.x);

  vec2 contentSize = hasPadding ? paddedTexSize - vec2(2.0) : paddedTexSize;

  // Map UV from [0,1] content space to pixel coordinates
  // Standard UV mapping: UV [0,1] maps to pixel centers [first, last]
  // For 258x258 texture with 256 content pixels and 1px padding:
  //   uv = 0 → pixel 1 (first content pixel)
  //   uv = 1 → pixel 256 (last content pixel)
  //   uv = -1/255 → pixel 0 (left padding)
  //   uv = 256/255 → pixel 257 (right padding)
  // Formula: pixel = uv * (contentSize - 1) + paddingOffset
  vec2 pixelCoord = hasPadding
    ? uv * (contentSize - vec2(1.0)) + vec2(1.0)  // Has padding: content [1, 256]
    : uv * (contentSize - vec2(1.0));              // No padding: content [0, 255]

  vec2 pixelFloor = floor(pixelCoord);
  vec2 pixelFrac = fract(pixelCoord);

  // Sample 4 nearest pixels
  // Clamp to valid texture bounds to prevent sampling beyond the padded texture
  ivec2 maxCoord = ivec2(paddedTexSize) - ivec2(1);

  DEMBilinearData data;
  data.p00 = clamp(ivec2(pixelFloor), ivec2(0), maxCoord);
  data.p10 = clamp(ivec2(pixelFloor + vec2(1.0, 0.0)), ivec2(0), maxCoord);
  data.p01 = clamp(ivec2(pixelFloor + vec2(0.0, 1.0)), ivec2(0), maxCoord);
  data.p11 = clamp(ivec2(pixelFloor + vec2(1.0, 1.0)), ivec2(0), maxCoord);
  data.frac = pixelFrac;

  return data;
}

// Generic DEM height decoder supporting multiple encoding formats
// Parameters:
//   color: RGB color from DEM texture
//   rgbScaler: RGB to value conversion coefficients
//   boundary: Boundary value marking no-data/ocean
//   minOffset: Offset to add when value < boundary
//   maxOffset: Offset to add when value > boundary
//   epsilon: Multiplicative scaling factor
//   offset: Additive offset (applied after epsilon scaling)
// Returns: Height in meters, or -1.0 for invalid/no-data
float decodeDEMHeight(vec4 color, vec3 rgbScaler, float boundary, float minOffset, float maxOffset, float epsilon, float offset) {
  vec3 rgb = color.rgb * 255.0;
  float x = dot(rgb, rgbScaler);

  float h;
  float epsilon_cmp = 1.0; // Tolerance for boundary comparison
  if (abs(x - boundary) > epsilon_cmp) {
    if (x > boundary) {
      h = x + maxOffset;  // Add offset for values above boundary
    } else {
      h = x + minOffset;  // Add offset for values below boundary
    }
    // Apply epsilon scaling and additive offset
    h = h * epsilon + offset;
  } else {
    h = -1.0;  // At boundary = invalid/no-data
  }

  // Final check: negative heights are marked as invalid
  if (h < 0.0) {
    h = -1.0;
  }

  return h;
}

// Perform bilinear interpolation on 4 decoded height values
// Handles invalid data (negative values) and artifact detection
// Returns interpolated height or invalidValue if the base (top-left) sample is invalid
float interpolateDEMHeights(float h00, float h10, float h01, float h11, vec2 frac, float invalidValue) {
  // Handle invalid data: if the base (top-left) sample is invalid, bail out
  if (h00 < 0.0) return invalidValue;

  // Check for abnormal height jumps (RGB encoding boundary artifacts)
  // Use fixed threshold for artifact detection (~1000m is unrealistic for adjacent pixels)
  float maxReasonableDiff = 1000.0;
  
  // Replace neighbors with large jumps relative to the base sample (likely RGB artifacts)
  if (h10 > 0.0 && abs(h10 - h00) > maxReasonableDiff) h10 = h00;
  if (h01 > 0.0 && abs(h01 - h00) > maxReasonableDiff) h01 = h00;
  if (h11 > 0.0 && abs(h11 - h00) > maxReasonableDiff) h11 = h00;

  // Replace invalid neighbors with the base sample value
  if (h10 < 0.0) h10 = h00;
  if (h01 < 0.0) h01 = h00;
  if (h11 < 0.0) h11 = h00;

  // Bilinear interpolation
  float h0 = mix(h00, h10, frac.x);
  float h1 = mix(h01, h11, frac.x);
  return mix(h0, h1, frac.y);
}

#endif // DEM_UTIL_GLSL
