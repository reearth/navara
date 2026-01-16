const float ATMOSPHERE_CUTOFF_ALTITUDE_LOW = 100000.0; // 100 km
const float ATMOSPHERE_CUTOFF_ALTITUDE_HIGH = ATMOSPHERE_CUTOFF_ALTITUDE_LOW + 90000.0; // 90 km transition

uniform vec3 uDayColor;
uniform vec3 uNightColor;
uniform vec3 uSunsetColor;
uniform vec3 uSunDirection;

in vec2 v_uv;
in vec3 v_cameraPositionLLA;

// High-frequency pseudo-random noise
float dither(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    if (v_cameraPositionLLA.z >= ATMOSPHERE_CUTOFF_ALTITUDE_HIGH) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float cameraAltitudeFactor = clamp((v_cameraPositionLLA.z - ATMOSPHERE_CUTOFF_ALTITUDE_LOW) / (ATMOSPHERE_CUTOFF_ALTITUDE_HIGH - ATMOSPHERE_CUTOFF_ALTITUDE_LOW), 0.0, 1.0);

    vec3 cameraDir = normalize(cameraPosition);
    vec3 sunDir = normalize(uSunDirection);

    float sunBlendFactor = dot(cameraDir, sunDir) * 0.5 + 0.5;

    vec3 dayColorFinal = mix(uSunsetColor, uDayColor, pow(v_uv.y, 2.5));

    vec4 color = vec4(mix(uNightColor, dayColorFinal, sunBlendFactor), 0.4);
    gl_FragColor = mix(color, vec4(0.0), cameraAltitudeFactor) + ((dither(v_uv) - 0.5) * (1.0 / 255.0));
}
