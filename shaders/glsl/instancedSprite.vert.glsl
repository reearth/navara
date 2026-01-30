attribute vec3 instancePosition; 
attribute float instanceScale;
// attribute float instanceLayer; // Which texture layer to use

varying vec2 vUv;
// varying float vLayer;

uniform vec3 uRTCCenter;

void main() {
    vUv = uv;
    // vLayer = instanceLayer;

    // Adjust view matrix for RTC
    vec4 centerMV = viewMatrix * vec4(uRTCCenter, 1.0);
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(centerMV.xyz, 1.0);

    vec4 mvPosition = viewMatrixRTC * vec4(instancePosition, 1.0);

    // This makes it always face the camera
    mvPosition.xy += (position.xy * instanceScale);

    gl_Position = projectionMatrix * mvPosition;
}
        