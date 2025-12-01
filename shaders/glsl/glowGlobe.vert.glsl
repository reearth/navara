// ===============================================================================
//                 Fresnel Glow effect based on view angle
// -------------------------------------------------------------------------------
// Adapted from: https://stemkoski.github.io/Three.js/Shader-Glow.html
// ===============================================================================
out vec3 vNormal;

void main() {
    vNormal = normalize( normalMatrix * normal );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}