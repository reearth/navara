#ifdef USE_BATCH_TEXTURE
  float batchId = _batchid;

  #ifdef USE_BATCH_COLOR_SHOW
    vec4 batchColor = getBatchColorShow(batchId);
    #ifdef USE_COLOR
      vColor.rgb = batchColor.rgb;
    #endif
    // Unpack show (bit 7) and opacity (bits 0-6) from alpha channel
    float packedByte = clamp(floor(batchColor.a * 255.0 + 0.5), 0.0, 255.0);  // round-to-nearest to avoid precision issues
    nvr_vShow = step(128.0, packedByte);  // Extract bit 7: 0 or 1
    nvr_vOpacity = mod(packedByte, 128.0) / 127.0;  // Extract bits 0-6: 0.0-1.0
  #endif

  #ifdef USE_BATCH_EXTRUDED_HEIGHT
    float extrudedHeight = getBatchExtrudedHeight(batchId);
    addExtrudedHeight = extrudedHeight;
  #endif

  #ifdef USE_BATCH_HEIGHT
    float batchHeight = getBatchHeight(batchId);
    addHeight = batchHeight;
  #endif

  #ifdef USE_BATCH_LINE_WIDTH
    batchLineWidth = getBatchLineWidth(batchId);
  #endif
#endif
