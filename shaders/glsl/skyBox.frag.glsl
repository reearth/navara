const float ATMOSPHERE_CUTOFF_ALTITUDE_LOW = 100000.0; // 100 km
const float ATMOSPHERE_CUTOFF_ALTITUDE_HIGH = ATMOSPHERE_CUTOFF_ALTITUDE_LOW + 90000.0; // 90 km transition

uniform vec3 uDayColor;
uniform vec3 uNightColor;
uniform vec3 uSunColor;
uniform vec3 uSunDirView;

in vec2 v_uv;
in vec3 v_posView;
flat in vec3 v_cameraPositionLLA;
flat in float v_dayNightFactor;

// High-frequency pseudo-random noise
float dither(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    float cameraAltitude = v_cameraPositionLLA.z;

    if (cameraAltitude >= ATMOSPHERE_CUTOFF_ALTITUDE_HIGH) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float cameraAltitudeFactor = clamp((cameraAltitude - ATMOSPHERE_CUTOFF_ALTITUDE_LOW) / (ATMOSPHERE_CUTOFF_ALTITUDE_HIGH - ATMOSPHERE_CUTOFF_ALTITUDE_LOW), 0.0, 1.0);

    vec3 sunDir = normalize(uSunDirView);
    vec3 pixelDir = normalize(v_posView);
    vec3 cameraDir = vec3(0.0, 0.0, -1.0);

    // 0.0: sun out of sight, 1.0: sun in sight 
    float sunInSightFactor = dot(pixelDir, sunDir) * 0.5 + 0.5;
    // float sunBlendFactor = dot(cameraDir, sunDir) * 0.5 + 0.5;

    vec3 sunColor = mix(vec3(0.0), uSunColor, pow(sunInSightFactor, 16.0));
    vec3 dayColorFinal = sunColor + uDayColor;

    vec4 color = vec4(mix(uNightColor, dayColorFinal, smoothstep(0.4, 0.6, v_dayNightFactor)), 0.3);

    vec4 result = mix(color, vec4(0.0), cameraAltitudeFactor);
    result.rgb += ((dither(v_uv) - 0.5) * (1.0 / 255.0));
    gl_FragColor = result;
}