// Ref: https://github.com/CesiumGS/cesium/blob/2cf09cb06e4f7ea767da39befabcfc3444b02c49/packages/engine/Source/Shaders/Builtin/Functions/metersPerPixel.glsl

/**
 * Computes the size of a pixel in meters at a distance from the eye.
 * <p>
 * Use this version when passing in a custom pixel ratio. For example, passing in 1.0 will return meters per native device pixel.
 * </p>
 * @name nvr_metersPerPixel
 * @glslFunction
 *
 * @param {vec3} positionEC The position to get the meters per pixel in eye coordinates.
 * @param {float} pixelRatio The scaling factor from pixel space to coordinate space
 *
 * @returns {float} The meters per pixel at positionEC.
 */
float nvr_metersPerPixel(vec4 positionEC, vec3 viewportAndPixelRatio, vec2 frustumNearFar, vec4 frustumRatio)
{
    float width = viewportAndPixelRatio.x * viewportAndPixelRatio.z;
    float height = viewportAndPixelRatio.y * viewportAndPixelRatio.z;
    float pixelWidth;
    float pixelHeight;

    float top = frustumRatio.x;
    float bottom = frustumRatio.y;
    float right = frustumRatio.z;
    float left = frustumRatio.w;

    // TODO: Support 2D
    // if (czm_sceneMode == czm_sceneMode2D || czm_orthographicIn3D == 1.0)
    // {
    //     // float frustumWidth = right - left;
    //     // float frustumHeight = top - bottom;
    //     // pixelWidth = frustumWidth / width;
    //     // pixelHeight = frustumHeight / height;
    // }
    // else
    // {
        float distanceToPixel = -positionEC.z;
        float inverseNear = 1.0 / frustumNearFar.x;
        float tanTheta = top * inverseNear;
        pixelHeight = 2.0 * distanceToPixel * tanTheta / height;
        tanTheta = right * inverseNear;
        pixelWidth = 2.0 * distanceToPixel * tanTheta / width;
    // }

    float pixelRatio = viewportAndPixelRatio.z;

    return max(pixelWidth, pixelHeight) * pixelRatio;
}
