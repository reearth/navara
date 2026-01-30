
precision highp sampler2DArray; // Important for WebGL 2

#ifndef USE_SHADOWMAP_DEPTH
    layout(location = 1) out vec4 outputBuffer1;
#endif

uniform sampler2DArray uTexture;

varying vec2 vUv;
varying float vLayer;

#ifndef USE_SHADOWMAP_DEPTH
    // Pack normal to vec2 for MRT
    vec2 packNormalToVec2(vec3 normal) {
        return normal.xy * 0.5 + 0.5;
    }

    vec3 screenSpaceNormal() {
        vec3 fdx = dFdx(gl_FragCoord.xyz);
        vec3 fdy = dFdy(gl_FragCoord.xyz);
        vec3 normal = normalize(cross(fdx, fdy));
        if (normal.z < 0.0) normal = -normal;
        return normal;
    }
#endif


void main() {
    // Sample the specific layer from the Texture Array
    vec4 color = texture(uTexture, vec3(vUv, vLayer));
    // vec4 color = vec4(1.0, 0.0, 0.0, 1.0); // Placeholder color

    if (color.a < 0.1) discard; // Alpha test
    gl_FragColor = color;

    #ifndef USE_SHADOWMAP_DEPTH
        // Calculate screen-space normal for MRT compatibility
        vec3 normal = screenSpaceNormal();
        outputBuffer1 = vec4(packNormalToVec2(normal), 0.0, 0.0);
    #endif
}