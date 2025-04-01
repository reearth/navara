
/**
 * get billboard matrix
 *
 * @name nvr_getBillboardMat
 * @glslFunction
 *
 * param {float} scaleFactor - scale value.
 * returns {mat4} billboardMatrix - billboard matrix.
 */
mat4 nvr_getBillboardMat(float scaleFactor) {
    // Set rotation to zero to behave like a billboard.
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