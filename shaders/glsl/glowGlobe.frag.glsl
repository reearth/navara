// ===============================================================================
//                 Fresnel Glow effect based on view angle
// -------------------------------------------------------------------------------
// Adapted from: https://stemkoski.github.io/Three.js/Shader-Glow.html
// ===============================================================================

in vec3 vNormal;
in vec3 vPos;

uniform float coefficient;
uniform float exponent;
uniform vec4 glowColor;

void main() {
    // Normalize the interpolated normal
    vec3 N = normalize(vNormal);

    // view direction in world space - from fragment to camera
    vec3 viewDir = normalize(cameraPosition - vPos);

    float facing_ratio = dot(N, viewDir);

    // 'max(..., 0.0)' clamps negative results to 0.0 to prevent visual artifacts 
    // and undefined behavior in the pow() function.
    float intensity = pow( max(coefficient - facing_ratio, 0.0), exponent );

    gl_FragColor = vec4(glowColor.rgb, glowColor.a * intensity);
}
