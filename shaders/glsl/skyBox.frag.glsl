#include "chunks/geographic.glsl"

uniform vec3 dayColor;
uniform vec3 nightColor;
uniform vec3 sunDirection;

void main() {
    vec3 cameraPositionLLA = ecefToLonLat(cameraPosition);
    
    const float ATMOSPHERE_CUTOFF_ALTITUDE_LOW = 100000.0; // 100 km
    const float ATMOSPHERE_CUTOFF_ALTITUDE_HIGH = ATMOSPHERE_CUTOFF_ALTITUDE_LOW + 90000.0; // 90 km transition
    
    if (cameraPositionLLA.z >= ATMOSPHERE_CUTOFF_ALTITUDE_HIGH) {
        discard;
    }

    float altitudeFactor = clamp((cameraPositionLLA.z - ATMOSPHERE_CUTOFF_ALTITUDE_LOW) / (ATMOSPHERE_CUTOFF_ALTITUDE_HIGH - ATMOSPHERE_CUTOFF_ALTITUDE_LOW), 0.0, 1.0);

    vec3 cameraDir = normalize(cameraPosition);
    vec3 lightDir = normalize(sunDirection);

    float blendFactor = dot(cameraDir, lightDir) * 0.5 + 0.5;

    vec4 color = vec4(mix(nightColor, dayColor, blendFactor), 0.4);
    gl_FragColor = mix(color, vec4(0.0), altitudeFactor);
}
