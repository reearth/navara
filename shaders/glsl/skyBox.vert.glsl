#include "chunks/geographic.glsl"

out vec2 v_uv;
out vec3 v_cameraPositionLLA;
out vec3 v_posWorld;

void main() {
    v_uv = position.xy * 0.5 + 0.5;

    v_cameraPositionLLA = ecefToLonLat(cameraPosition);

    vec4 posWorld = inverse(viewMatrix) * inverse(projectionMatrix) * vec4(position.xyz, 1.0);
    v_posWorld = posWorld.xyz / posWorld.w;
 
    gl_Position =  vec4( position.xyz, 1.0 );
}