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

    // view ddirection in world space
    vec3 viewDir = cameraPosition - vPos;

    // Optimization: In View Space, the view vector is effectively (0,0,1).
    // Instead of a dot product, we just take the Z component.
    // Ideally, use: float facing_ratio = dot(N, normalize(viewVector)); if not in View Space.
    float facing_ratio = dot(N, normalize(-viewDir));

    // 'max(..., 0.0)' clamps negative results to 0.0 to prevent visual artifacts 
    // and undefined behavior in the pow() function.
    float intensity = pow( max(coefficient - facing_ratio, 0.0), exponent );

    gl_FragColor = glowColor * intensity;
}
