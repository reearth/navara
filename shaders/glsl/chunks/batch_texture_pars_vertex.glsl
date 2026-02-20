#ifdef USE_BATCH_TEXTURE
uniform sampler2D batchDataTexture;
in float _batchid;

float decodeRGBAToFloat(vec4 rgba) {
  uvec4 bytes = uvec4(rgba * 255.0);

  uint value = bytes.r | (bytes.g << 8) | (bytes.b << 16) | (bytes.a << 24);

  return uintBitsToFloat(value);
}

vec2 getBatchTextureCoord(float batchId, float rowIndex) {
  vec2 texSize = vec2(textureSize(batchDataTexture, 0));

  // 2D layout: batch IDs are arranged in a grid of width texSize.x.
  // Each "batch row" group occupies BATCHED_TEXTURE_ROW_COUNT physical rows.
  float col = mod(batchId, texSize.x);
  float batchRow = floor(batchId / texSize.x);

  float u = (col + 0.5) / texSize.x;
  float v = (batchRow * BATCHED_TEXTURE_ROW_COUNT + rowIndex + 0.5) / texSize.y;

  return vec2(u, v);
}

#ifdef USE_BATCH_COLOR_SHOW
vec4 getBatchColorShow(float batchId) {
  vec2 uv = getBatchTextureCoord(batchId, BATCHED_TEXTURE_ROW_COLOR_SHOW);

  vec4 data = texture2D(batchDataTexture, uv);
  return data;
}
#endif

#ifdef USE_BATCH_HEIGHT
float getBatchHeight(float batchId) {
  vec2 uv = getBatchTextureCoord(batchId, BATCHED_TEXTURE_ROW_HEIGHT);
  
  vec4 data = texture2D(batchDataTexture, uv);
  return decodeRGBAToFloat(data);
}
#endif

#ifdef USE_BATCH_EXTRUDED_HEIGHT
float getBatchExtrudedHeight(float batchId) {
  vec2 uv = getBatchTextureCoord(batchId, BATCHED_TEXTURE_ROW_EXTRUDED_HEIGHT);
  
  vec4 data = texture2D(batchDataTexture, uv);
  return decodeRGBAToFloat(data);
}
#endif
#endif // USE_BATCH_TEXTURE
