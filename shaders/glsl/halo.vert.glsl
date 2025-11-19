

void main() {
    vec4 position = vec4( position, 1.0 );
    position = projectionMatrix * modelViewMatrix * position;
    gl_Position = position;
}