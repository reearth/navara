#if USE_ELEVATION_HEATMAP
  #include "branchFreeTernary.glsl"
  #include "dem_util.glsl"

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

  // Decode raw height from RGB DEM texture for elevation heatmap
  float decodeRawHeightForElevation(vec4 color) {
    return decodeDEMHeight(
      color,
      uElevationRGBScaler,
      uElevationMinMaxHeightAndBoundary.z,  // boundary
      uElevationMinMaxOffsetAndEpsilonAndOffset.x,  // minOffset
      uElevationMinMaxOffsetAndEpsilonAndOffset.y,  // maxOffset
      uElevationMinMaxOffsetAndEpsilonAndOffset.z,  // epsilon
      uElevationMinMaxOffsetAndEpsilonAndOffset.w   // offset
    );
  }

  // Normalize raw height to [0, 1] range with optional logarithmic scaling
  float normalizeElevationHeight(float h) {
    // Apply logarithmic scaling if enabled
    float minHeight = nvr_branchFreeTernary(uLogarithmic, pseudoLog(uElevationMinMaxHeightAndBoundary.x), uElevationMinMaxHeightAndBoundary.x);
    float maxHeight = nvr_branchFreeTernary(uLogarithmic, pseudoLog(uElevationMinMaxHeightAndBoundary.y), uElevationMinMaxHeightAndBoundary.y);
    float value = nvr_branchFreeTernary(uLogarithmic, pseudoLog(h), h);

    return clamp(
        (value - minHeight) / (maxHeight - minHeight),
        0.0,
        1.0
    );
  }

  // Sample elevation with bilinear interpolation in decoded height space
  float sampleElevationBilinear(sampler2D demTexture, vec2 uv) {
    // Prepare bilinear sampling data (pixel coordinates and interpolation weights)
    DEMBilinearData data = prepareDEMBilinear(demTexture, uv);

    // Decode heights at 4 sample points
    float h00 = decodeRawHeightForElevation(texelFetch(demTexture, data.p00, 0));
    float h10 = decodeRawHeightForElevation(texelFetch(demTexture, data.p10, 0));
    float h01 = decodeRawHeightForElevation(texelFetch(demTexture, data.p01, 0));
    float h11 = decodeRawHeightForElevation(texelFetch(demTexture, data.p11, 0));

    // Perform bilinear interpolation with artifact detection
    float h = interpolateDEMHeights(h00, h10, h01, h11, data.frac, 0.0);

    // Handle invalid data
    if (h < 0.0) {
      return 0.0;
    }

    // Normalize the interpolated height
    return normalizeElevationHeight(h);
  }
#endif