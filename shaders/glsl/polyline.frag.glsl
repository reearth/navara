uniform vec3 color;
uniform float pickable;
in float v_batchId;

void main() {
    gl_FragColor = vec4(color, 1.);

    if(pickable > 0.5) {
        float r = floor(v_batchId / 65536.0);
        float g = floor(mod(v_batchId / 256.0, 256.0));
        float b = floor(mod(v_batchId, 256.0));

        gl_FragColor = vec4(r/255.0, g/255.0, b/255.0, 1.0);
    }
}
