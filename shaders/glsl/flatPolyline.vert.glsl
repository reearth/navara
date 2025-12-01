// Flat polyline vertex shader for texturized tile rendering
// Positions are in normalized [-1, 1] tile coordinates

in float attrBatchId;

#include chunks/show_pars_vertex;

in vec3 start;
in vec3 forward_offset;
in vec3 start_normal;
in vec4 end_normal_and_texture_coordinate_normalization_x;
in vec4 right_normal_and_texture_coordinate_normalization_y;

#include <common>
#include <color_pars_vertex>
#include chunks/batch_texture_pars_vertex;

uniform vec3 minMaxHeightAndWidth;

out float nvr_vBatchId;

void main() {
    #include <begin_vertex>
    #include <color_vertex>

    #include chunks/batch_texture_vertex;

    nvr_vBatchId = attrBatchId;

    // Apply line width offset using the right normal stored in the attribute
    vec3 rightNormal = right_normal_and_texture_coordinate_normalization_y.xyz;
    float side = right_normal_and_texture_coordinate_normalization_y.w; // 1.0 for left, -1.0 for right

    // Line width in normalized coordinates (width is in pixels, need to scale)
    // For a 512x512 render target, convert pixels to normalized coords
    float lineWidth = minMaxHeightAndWidth.z / 512.0;

    // Offset position by half width in the direction of the right normal
    vec3 offsetPos = position + rightNormal * lineWidth * 0.5 * side;

    // Transform to clip space (modelViewMatrix should be identity for orthographic camera)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(offsetPos, 1.0);
}
