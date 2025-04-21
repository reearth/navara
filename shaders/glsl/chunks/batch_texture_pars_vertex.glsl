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

  float u = (batchId + 0.5) / texSize.x;
  float v = (rowIndex + 0.5) / texSize.y;
  
  return vec2(u, v);
}

#ifdef USE_COLOR
vec3 getBatchColor(float batchId) {
  vec2 uv = getBatchTextureCoord(batchId, BATCHED_TEXTURE_ROW_COLOR);

  vec4 data = texture2D(batchDataTexture, uv);
  return data.rgb;
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

#ifdef USE_BATCH_SHOW
float getBatchShow(float batchId) {
  vec2 uv = getBatchTextureCoord(batchId, BATCHED_TEXTURE_ROW_SHOW);
  
  vec4 data = texture2D(batchDataTexture, uv);
  return data.r;
}
#endif
#endif // USE_BATCH_TEXTURE
