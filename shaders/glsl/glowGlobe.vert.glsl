// ===============================================================================
//                 Fresnel Glow effect based on view angle
// -------------------------------------------------------------------------------
// Adapted from: https://stemkoski.github.io/Three.js/Shader-Glow.html
// ===============================================================================
out vec3 vNormal; // world space
out vec3 vPos; // world space

void main() {
    vNormal = normalize( mat3(modelMatrix) * normal );
    vec4 worldPos = modelMatrix * vec4( position, 1.0);
    vPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}