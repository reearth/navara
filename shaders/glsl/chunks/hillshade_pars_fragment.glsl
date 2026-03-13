#if USE_HILLSHADE
  #include dem_util;

  // Hillshade-specific uniforms for DEM decoding
  // Note: All uniforms are declared in tile.ts
  uniform vec3 uHillshadeRGBScaler;
  uniform float uHillshadeBoundary; // Boundary value marking no-data
  uniform float uHillshadeMinOffset; // Offset for values below boundary
  uniform float uHillshadeMaxOffset; // Offset for values above boundary
  uniform float uHillshadeEpsilon; // Scale factor for height conversion
  uniform float uHillshadeOffset; // Additive offset (applied after epsilon)
  uniform float uHillshadeExaggeration; // Terrain exaggeration factor (recommended: 0.3-2.0)
  // uHillshadeZooms (array uniform) is declared in tile.ts as a global uniform

  // Decode height from RGB DEM texture
  float decodeHeightForHillshade(vec4 color) {
    return decodeDEMHeight(
      color,
      uHillshadeRGBScaler,
      uHillshadeBoundary,
      uHillshadeMinOffset,
      uHillshadeMaxOffset,
      uHillshadeEpsilon,
      uHillshadeOffset
    );
  }

  // Sample height with manual bilinear interpolation in decoded height space
  float sampleHeightBilinear(sampler2D demTexture, vec2 uv) {
    // Prepare bilinear sampling data (pixel coordinates and interpolation weights)
    DEMBilinearData data = prepareDEMBilinear(demTexture, uv);

    // Decode heights at 4 sample points
    float h00 = decodeHeightForHillshade(texelFetch(demTexture, data.p00, 0));
    float h10 = decodeHeightForHillshade(texelFetch(demTexture, data.p10, 0));
    float h01 = decodeHeightForHillshade(texelFetch(demTexture, data.p01, 0));
    float h11 = decodeHeightForHillshade(texelFetch(demTexture, data.p11, 0));

    // Perform bilinear interpolation with artifact detection
    return interpolateDEMHeights(h00, h10, h01, h11, data.frac, h00);
  }

  // Compute normal from DEM using Sobel operator (MapLibre-style)
  // Reference: maplibre-gl-js/src/shaders/hillshade_prepare.fragment.glsl
  vec3 computeNormalFromDEM(sampler2D demTexture, vec2 uv, vec2 texelSize, float layerZoom) {
    // Sample 3x3 grid of heights with bilinear interpolation
    // Grid layout:
    //   a  b  c
    //   d  e  f
    //   g  h  i
    // Texture has 1-pixel padding with backfilled neighbor data, so we can sample freely
    float a = sampleHeightBilinear(demTexture, uv + vec2(-texelSize.x,  texelSize.y));
    float b = sampleHeightBilinear(demTexture, uv + vec2(0.0,           texelSize.y));
    float c = sampleHeightBilinear(demTexture, uv + vec2( texelSize.x,  texelSize.y));
    float d = sampleHeightBilinear(demTexture, uv + vec2(-texelSize.x,  0.0));
    float e = sampleHeightBilinear(demTexture, uv);
    float f = sampleHeightBilinear(demTexture, uv + vec2( texelSize.x,  0.0));
    float g = sampleHeightBilinear(demTexture, uv + vec2(-texelSize.x, -texelSize.y));
    float h = sampleHeightBilinear(demTexture, uv + vec2(0.0,          -texelSize.y));
    float i = sampleHeightBilinear(demTexture, uv + vec2( texelSize.x, -texelSize.y));

    // Handle invalid data (ocean/no-data marked as -1.0)
    if (e < 0.0) return vec3(0.0, 0.0, 1.0); // Flat normal for invalid areas
    if (a < 0.0) a = e;
    if (b < 0.0) b = e;
    if (c < 0.0) c = e;
    if (d < 0.0) d = e;
    if (f < 0.0) f = e;
    if (g < 0.0) g = e;
    if (h < 0.0) h = e;
    if (i < 0.0) i = e;

    // Sobel operator for gradient calculation
    float dX = (c + f + f + i) - (a + d + d + g);
    float dY = (g + h + h + i) - (a + b + b + c);

    // MapLibre's zoom-based scaling formula
    // Reference: hillshade_prepare.fragment.glsl:61-67
    ivec2 texSize = textureSize(demTexture, 0);
    float tileSize = float(texSize.x) - 2.0; // Remove padding to get content size (e.g., 258 - 2 = 256)
    float exaggerationFactor = layerZoom < 2.0 ? 0.4 : layerZoom < 4.5 ? 0.35 : 0.3;
    float exaggeration = layerZoom < 15.0 ? (layerZoom - 15.0) * exaggerationFactor : 0.0;

    // Apply MapLibre's derivative calculation
    vec2 deriv = vec2(dX, dY) * tileSize / pow(2.0, exaggeration + (28.2562 - layerZoom));

    // Apply user exaggeration
    deriv *= uHillshadeExaggeration;

    float slopeX = deriv.x;
    float slopeY = deriv.y;

    // Construct normal vector
    vec3 normal = vec3(-slopeX, slopeY, 1.0);

    return normalize(normal);
  }
#endif