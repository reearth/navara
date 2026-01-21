#include "chunks/geographic.glsl"

uniform vec3 uSunDirView;

out vec2 v_uv;
out vec3 v_posView;
flat out vec3 v_cameraPositionLLA;
flat out float v_dayNightFactor;

void main() {
    v_uv = position.xy * 0.5 + 0.5;

    vec4 positionView = inverse(projectionMatrix) * vec4(position.xyz, 1.0);
    v_posView = positionView.xyz / positionView.w;

    vec4 sunPosWorld = inverse(viewMatrix) * vec4(uSunDirView, 0.0);

    v_cameraPositionLLA = ecefToLonLat(cameraPosition);

    float dayNightFactor = dot(normalize(cameraPosition), normalize(sunPosWorld.xyz )) * 0.5 + 0.5;
    v_dayNightFactor = dayNightFactor;

    gl_Position =  vec4( position.xyz, 1.0 );
}