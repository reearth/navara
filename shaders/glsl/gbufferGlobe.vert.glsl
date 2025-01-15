in vec3 position;
in vec3 normal;

out vec3 vNormal;
out float vDepth;
out vec4 vPosition;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    vec3 transformedNormal = normalMatrix * normal;
    vNormal = normalize(transformedNormal);

    gl_Position = projectionMatrix * mvPosition;

    vPosition = gl_Position;

    vDepth = 1.0 + gl_Position.w;
}
