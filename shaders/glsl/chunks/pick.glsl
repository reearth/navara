
/**
 * convert batchId to a vec3 color
 *
 * @name nvr_batchIdToColor
 * @glslFunction
 *
 * param {float} batchId
 * returns {vec3} color value.
 */
vec3 nvr_batchIdToColor(float batchId) {
    float r = floor(batchId / 65536.0);
    float g = floor(mod(batchId / 256.0, 256.0));
    float b = floor(mod(batchId, 256.0));

    return vec3(r/255.0, g/255.0, b/255.0);
}

