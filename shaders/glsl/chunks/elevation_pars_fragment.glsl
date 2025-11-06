#ifdef USE_ELEVATION_HEATMAP
  uniform sampler2D uColorMapTexture;
  uniform float uElevationMinHeight;
  uniform float uElevationMaxHeight;
  uniform vec3 uElevationRGBScaler;
  uniform float uElevationBoundary;
  uniform float uElevationMaxOffset;
  uniform float uElevationMinOffset;
  uniform float uElevationEpsilon;
  uniform float uElevationOffset;
  uniform bool uLogarithmic; // Whether to apply logarithmic scaling
  uniform float uLogBase; // Logarithmic base
  uniform float uLogBoundary; // Boundary for pseudo-logarithmic scaling

  float pseudoLog(float value) {
    return value > uLogBoundary ? log(value) / uLogBase : value < -uLogBoundary ? -log(-value) / uLogBase : value / uLogBoundary;
  }

  float decodeElevationNormal(vec4 color) {
    vec3 rgb = color.rgb * 255.0;
    float x = dot(rgb, uElevationRGBScaler);

    float h;
    // Use epsilon-based comparison for floating point equality check
    float epsilon_cmp = 1.0; // Tolerance for boundary comparison
    if (abs(x - uElevationBoundary) > epsilon_cmp) {
      if (x > uElevationBoundary) {
        h = x + uElevationMaxOffset;
      } else {
        h = x + uElevationMinOffset;
      }
    } else {
      h = 0.0;
    }

    h = h * uElevationEpsilon + uElevationOffset;
    if(h < 0.0) {
      h = 0.0;
    }

    // Apply logarithmic scaling if enabled
    float minHeight = uLogarithmic ? pseudoLog(uElevationMinHeight) : uElevationMinHeight;
    float maxHeight = uLogarithmic ? pseudoLog(uElevationMaxHeight) : uElevationMaxHeight;
    float value = uLogarithmic ? pseudoLog(h) : h;

    h = clamp(
        (value - minHeight) / (maxHeight - minHeight),
        0.0,
        1.0
    );

    return h;
  }
#endif