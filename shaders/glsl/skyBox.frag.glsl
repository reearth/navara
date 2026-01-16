#include "chunks/geographic.glsl"

const float ATMOSPHERE_CUTOFF_ALTITUDE_LOW = 100000.0; // 100 km
const float ATMOSPHERE_CUTOFF_ALTITUDE_HIGH = ATMOSPHERE_CUTOFF_ALTITUDE_LOW + 90000.0; // 90 km transition

uniform vec3 dayColor;
uniform vec3 nightColor;
uniform vec3 sunDirection;

const vec3 sunsetColor = vec3(1.0, 0.8666666666666667, 0.6823529411764706); // 0xFFDDAE

in vec2 v_uv;

// High-frequency pseudo-random noise
float dither(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec3 cameraPositionLLA = ecefToLonLat(cameraPosition);
    
    if (cameraPositionLLA.z >= ATMOSPHERE_CUTOFF_ALTITUDE_HIGH) {
        discard;
    }

    float cameraAltitudeFactor = clamp((cameraPositionLLA.z - ATMOSPHERE_CUTOFF_ALTITUDE_LOW) / (ATMOSPHERE_CUTOFF_ALTITUDE_HIGH - ATMOSPHERE_CUTOFF_ALTITUDE_LOW), 0.0, 1.0);

    vec3 cameraDir = normalize(cameraPosition);
    vec3 lightDir = normalize(sunDirection);

    float sunBlendFactor = dot(cameraDir, lightDir) * 0.5 + 0.5;

    vec3 dayColorFinal = mix(sunsetColor, dayColor, pow(v_uv.y, 2.5));

    vec4 color = vec4(mix(nightColor, dayColorFinal, sunBlendFactor), 0.4);
    gl_FragColor = mix(color, vec4(0.0), cameraAltitudeFactor) + ((dither(v_uv) - 0.5) * (1.0 / 255.0));
}
