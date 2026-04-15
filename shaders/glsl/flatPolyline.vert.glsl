// Flat polyline vertex shader for texturized tile rendering
// Positions are in normalized [-1, 1] tile coordinates

in float attrBatchId;

#include chunks/show_pars_vertex;

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

    // Miter joint: normal direction and signed miter length are packed in the attribute
    vec2 miterNormal = right_normal_and_texture_coordinate_normalization_y.xy;
    float miterLength = right_normal_and_texture_coordinate_normalization_y.w; // signed: +/- for left/right, scaled for miter

    // Line width in normalized coordinates (width is in pixels, need to scale)
    // For a 512x512 render target, convert pixels to normalized coords
    float lineWidth = minMaxHeightAndWidth.z / 512.0;

    // Compensate for parent tile zoom-in: when a parent tile's mesh is rendered
    // for a child tile, the ortho camera narrows its bounds, magnifying the geometry.
    // projectionMatrix[0][0] = 2/(right-left); default camera (-1,1) gives 1.0,
    // parent fallback gives >1.0. Dividing cancels the magnification.
    lineWidth /= projectionMatrix[0][0];

    // Offset position by miter normal scaled by half width and miter length
    vec3 offsetPos = position + vec3(miterNormal * lineWidth * 0.5 * miterLength, 0.0);

    // Transform to clip space (modelViewMatrix should be identity for orthographic camera)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(offsetPos, 1.0);
}
