#include "chunks/geographic.glsl"

out vec2 v_uv;
out vec3 v_cameraPositionLLA;

void main() {
    v_uv = position.xy * 0.5 + 0.5;
    v_cameraPositionLLA = ecefToLonLat(cameraPosition);

    gl_Position =  vec4( position.xyz, 1.0 );
}