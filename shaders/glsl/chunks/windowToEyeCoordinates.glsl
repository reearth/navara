// Ref: https://github.com/CesiumGS/cesium/blob/da804fe3c613fc6cfd047f5558fa5081d5bff3ae/packages/engine/Source/Shaders/Builtin/Functions/windowToEyeCoordinates.glsl
vec4 nvr_screenToEyeCoordinates(vec4 screenCoordinate, vec4 frustumRatio, vec2 frustumNearFar)
{
    // Reconstruct NDC coordinates
    float x = 2.0 * screenCoordinate.x - 1.0;
    float y = 2.0 * screenCoordinate.y - 1.0;
    // float z = (screenCoordinate.z - 0.5) / 0.5;
    float z = 2.0 * screenCoordinate.z - 1.0;
    vec4 q = vec4(x, y, z, 1.0);

    // Reverse the perspective division to obtain clip coordinates.
    q /= screenCoordinate.w;

    // Reverse the projection transformation to obtain eye coordinates.
    float top = frustumRatio.x;
    float bottom = frustumRatio.y;
    float right = frustumRatio.z;
    float left = frustumRatio.w;

    float near = frustumNearFar.x;
    float far = frustumNearFar.y;

    q.x = (q.x * (right - left) + left + right) * 0.5;
    q.y = (q.y * (top - bottom) + bottom + top) * 0.5;
    q.z = (q.z * (near - far) - near - far) * 0.5;
    q.w = 1.0;

    return q;
}

/**
 * Transforms a position from window to eye coordinates.
 * The transform from window to normalized device coordinates is done using components
 * of (@link czm_viewport} and {@link czm_viewportTransformation} instead of calculating
 * the inverse of <code>czm_viewportTransformation</code>. The transformation from
 * normalized device coordinates to clip coordinates is done using <code>fragmentCoordinate.w</code>,
 * which is expected to be the scalar used in the perspective divide. The transformation
 * from clip to eye coordinates is done using {@link czm_inverseProjection}.
 *
 * @name nvr_windowToEyeCoordinates
 * @glslFunction
 *
 * @param {vec4} fragmentCoordinate The position in window coordinates to transform.
 *
 * @returns {vec4} The transformed position in eye coordinates.
 *
 * @see czm_modelToWindowCoordinates
 * @see czm_eyeToWindowCoordinates
 * @see czm_inverseProjection
 * @see czm_viewport
 * @see czm_viewportTransformation
 *
 * @example
 * vec4 positionEC = nvr_windowToEyeCoordinates(gl_FragCoord);
 */
vec4 nvr_windowToEyeCoordinates(vec4 fragmentCoordinate, vec3 viewportAndPixelRatio, vec4 frustumRatio, vec2 frustumNearFar)
{
    vec2 screenCoordXY = fragmentCoordinate.xy / viewportAndPixelRatio.xy;
    return nvr_screenToEyeCoordinates(vec4(screenCoordXY, fragmentCoordinate.zw), frustumRatio, frustumNearFar);
}
