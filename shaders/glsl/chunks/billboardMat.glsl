
/**
 * get billboard matrix
 *
 * @name nvr_getBillboardMat
 * @glslFunction
 *
 * param {float} initScale - initial scale value.
 * param {float} scaleByDistance - scale by distance value.
 * returns {mat4} billboardMatrix - billboard matrix.
 */
mat4 nvr_getBillboardMat(float initScale, float scaleByDistance) {
    float scaleFactor = initScale;
    if(scaleByDistance > 0.0) {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        float distance = length(worldPosition.xyz - cameraPosition);
        scaleFactor *= 0.02 * distance;
    }

    mat4 billboardMatrix = modelViewMatrix;
    billboardMatrix[0][0] = scaleFactor;
    billboardMatrix[1][1] = scaleFactor;
    billboardMatrix[2][2] = scaleFactor;
    billboardMatrix[0][1] = 0.0;
    billboardMatrix[0][2] = 0.0;
    billboardMatrix[1][0] = 0.0;
    billboardMatrix[1][2] = 0.0;
    billboardMatrix[2][0] = 0.0;
    billboardMatrix[2][1] = 0.0;

    return billboardMatrix;
}

