#ifdef USE_BATCH_TEXTURE
  float batchId = _batchid;

  #ifdef USE_BATCH_SHOW
    float showFlag = getBatchShow(batchId);
    nvr_vShow = showFlag;
  #endif

  #ifdef USE_COLOR
    vec3 batchColor = getBatchColor(batchId);
    vColor.rgb = batchColor;
  #endif

  #ifdef USE_BATCH_EXTRUDED_HEIGHT
    float extrudedHeight = getBatchExtrudedHeight(batchId);
    addExtrudedHeight = extrudedHeight;
  #endif

  #ifdef USE_BATCH_HEIGHT
    float height = getBatchHeight(batchId);
    // TODO: Set height
  #endif
#endif
