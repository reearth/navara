// ===============================================================================
//                 Fresnel Glow effect based on view angle
// -------------------------------------------------------------------------------
// Adapted from: https://stemkoski.github.io/Three.js/Shader-Glow.html
// ===============================================================================
out vec3 vNormal; // world space
out vec3 vPos; // world space

void main() {
    //mat4 modelViewMatrixNormal = transpose(inverse(modelViewMatrix));
    vNormal = normalize( normalMatrix * normal);
    vec4 worldPos = (modelMatrix * vec4( position, 1.0));
    vPos = (worldPos / worldPos.w).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}