#ifdef USE_BATCH_TEXTURE
  float batchId = _batchid;

  #ifdef USE_BATCH_COLOR_SHOW
    vec4 batchColor = getBatchColorShow(batchId);
    vColor.rgb = batchColor.rgb;
    nvr_vShow = batchColor.a;
  #endif

  #ifdef USE_BATCH_EXTRUDED_HEIGHT
    float extrudedHeight = getBatchExtrudedHeight(batchId);
    addExtrudedHeight = extrudedHeight;
  #endif

  #ifdef USE_BATCH_HEIGHT
    float height = getBatchHeight(batchId);
    addHeight = height;
  #endif
#endif
