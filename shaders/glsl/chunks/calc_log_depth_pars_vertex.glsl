/**
 * Calculate logarithmic depth value for manual depth buffer writes in RTC/RTE mode.
 * This is used when rendering sprites/billboards with high-precision positioning
 * to ensure correct depth ordering without precision loss.
 *
 * @name nvr_calcLogDepth
 * @glslFunction
 *
 * param {vec4} worldPos - World position of the fragment in ECEF meters.
 * returns {float} Depth value for logarithmic depth buffer calculation (1.0 + w component).
 */
out float vFragDepthManual;

float nvr_calcLogDepth(vec4 worldPos) {
  vec4 viewPosForDepth = viewMatrix * worldPos;
  vec4 projPosForDepth = projectionMatrix * viewPosForDepth;
  return 1.0 + projPosForDepth.w;
}