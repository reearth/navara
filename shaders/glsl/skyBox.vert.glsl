#include "chunks/geographic.glsl"

out vec2 v_uv;
out vec3 v_posView;
out vec3 v_cameraPositionLLA;

void main() {
    v_uv = position.xy * 0.5 + 0.5;

    v_cameraPositionLLA = ecefToLonLat(cameraPosition);

    vec4 positionView = inverse(projectionMatrix) * vec4(position.xyz, 1.0);
    v_posView = positionView.xyz / positionView.w;

    gl_Position =  vec4( position.xyz, 1.0 );
}