#ifdef USE_ELEVATION_HEATMAP
  #include branchFreeTernary;

  uniform sampler2D uColorMapTexture;
  uniform vec3 uElevationRGBScaler;
  uniform vec3 uElevationMinMaxHeightAndBoundary;
  uniform vec4 uElevationMinMaxOffsetAndEpsilonAndOffset;
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
    if (abs(x - uElevationMinMaxHeightAndBoundary.z) > epsilon_cmp) {
      if (x > uElevationMinMaxHeightAndBoundary.z) {
        h = x + uElevationMinMaxOffsetAndEpsilonAndOffset.y;
      } else {
        h = x + uElevationMinMaxOffsetAndEpsilonAndOffset.x;
      }
    } else {
      h = 0.0;
    }

    h = h * uElevationMinMaxOffsetAndEpsilonAndOffset.z + uElevationMinMaxOffsetAndEpsilonAndOffset.w;
    if(h < 0.0) {
      h = 0.0;
    }

    // Apply logarithmic scaling if enabled
    float minHeight = nvr_branchFreeTernary(uLogarithmic, pseudoLog(uElevationMinMaxHeightAndBoundary.x), uElevationMinMaxHeightAndBoundary.x);
    float maxHeight = nvr_branchFreeTernary(uLogarithmic, pseudoLog(uElevationMinMaxHeightAndBoundary.y), uElevationMinMaxHeightAndBoundary.y);
    float value = nvr_branchFreeTernary(uLogarithmic, pseudoLog(h), h);

    h = clamp(
        (value - minHeight) / (maxHeight - minHeight),
        0.0,
        1.0
    );

    return h;
  }
#endif