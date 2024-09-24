// Ref: https://github.com/CesiumGS/cesium/blob/009a66d04221f74f3f957fa7d79fe0c1b393997c/packages/engine/Source/Shaders/Builtin/Functions/branchFreeTernary.glsl

/**
 * Branchless ternary operator to be used when it's inexpensive to explicitly
 * evaluate both possibilities for a float expression.
 *
 * @name nvr_branchFreeTernary
 * @glslFunction
 *
 * @param {bool} comparison A comparison statement
 * @param {float} a Value to return if the comparison is true.
 * @param {float} b Value to return if the comparison is false.
 *
 * @returns {float} equivalent of comparison ? a : b
 */
float nvr_branchFreeTernary(bool comparison, float a, float b) {
    float useA = float(comparison);
    return a * useA + b * (1.0 - useA);
}

/**
 * Branchless ternary operator to be used when it's inexpensive to explicitly
 * evaluate both possibilities for a vec2 expression.
 *
 * @name nvr_branchFreeTernary
 * @glslFunction
 *
 * @param {bool} comparison A comparison statement
 * @param {vec2} a Value to return if the comparison is true.
 * @param {vec2} b Value to return if the comparison is false.
 *
 * @returns {vec2} equivalent of comparison ? a : b
 */
vec2 nvr_branchFreeTernary(bool comparison, vec2 a, vec2 b) {
    float useA = float(comparison);
    return a * useA + b * (1.0 - useA);
}

/**
 * Branchless ternary operator to be used when it's inexpensive to explicitly
 * evaluate both possibilities for a vec3 expression.
 *
 * @name nvr_branchFreeTernary
 * @glslFunction
 *
 * @param {bool} comparison A comparison statement
 * @param {vec3} a Value to return if the comparison is true.
 * @param {vec3} b Value to return if the comparison is false.
 *
 * @returns {vec3} equivalent of comparison ? a : b
 */
vec3 nvr_branchFreeTernary(bool comparison, vec3 a, vec3 b) {
    float useA = float(comparison);
    return a * useA + b * (1.0 - useA);
}

/**
 * Branchless ternary operator to be used when it's inexpensive to explicitly
 * evaluate both possibilities for a vec4 expression.
 *
 * @name nvr_branchFreeTernary
 * @glslFunction
 *
 * @param {bool} comparison A comparison statement
 * @param {vec3} a Value to return if the comparison is true.
 * @param {vec3} b Value to return if the comparison is false.
 *
 * @returns {vec3} equivalent of comparison ? a : b
 */
vec4 nvr_branchFreeTernary(bool comparison, vec4 a, vec4 b) {
    float useA = float(comparison);
    return a * useA + b * (1.0 - useA);
}
