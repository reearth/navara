#include chunks/pick;

uniform vec3 color;
uniform float uPickable;
uniform vec3 uHighlightColor;

in float v_batchId;
in float v_IsPicked;

void main() {
    gl_FragColor = vec4(color, 1.);

    if(uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(v_batchId);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
    }

    if(v_IsPicked > 0.0) {
        gl_FragColor = vec4(uHighlightColor.x, uHighlightColor.y, uHighlightColor.z, 1.0);
    }
}
