
/**
 * pixel to world space conversion
 *
 * @name nvr_pxToWorld
 * @glslFunction
 *
 * param {px} px - pixel value.
 * param {float} fov - field of view in radians.
 * param {float} screenHeight - height of the screen in pixels.
 * param {vec3} worldPosition - world position of the object.
 * param {vec3} cameraPosition - world position of the camera.
 * returns {float} world space value.
 */
float nvr_pxToWorld(float px, float fov, float screenHeight, vec3 worldPosition, vec3 cameraPosition) {
    float distance = length(cameraPosition - worldPosition.xyz);
    float world_screen_height = tan(fov / 2.0) * distance * 2.0;
    float world_per_pixel = world_screen_height / screenHeight;

    return px * world_per_pixel;
}