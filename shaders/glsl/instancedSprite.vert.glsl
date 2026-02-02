#ifdef USE_RTE
    attribute vec3 instancePositionLOW; 
    attribute vec3 instancePositionHIGH; 
#else
    attribute vec3 instancePosition; 
#endif

#ifdef BILLBOARD
    attribute float instanceLayer; // Which texture layer to use
    varying float vLayer;
#endif

attribute float instanceScale;
uniform vec3 uRTCCenter;

varying vec2 vUv;

void main() {
    vUv = uv;
#ifdef BILLBOARD
    vLayer = instanceLayer;
#endif

    vec4 mvPosition;
#ifdef USE_RTE
    // TODO: Adjust view matrix for RTE
#else
    // Adjust view matrix for RTC
    vec4 centerMV = viewMatrix * vec4(uRTCCenter, 1.0);
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(centerMV.xyz, 1.0);

    mvPosition = viewMatrixRTC * vec4(instancePosition, 1.0);
#endif

    // This makes it always face the camera
    mvPosition.xy += (position.xy * instanceScale);

    gl_Position = projectionMatrix * mvPosition;
}
        