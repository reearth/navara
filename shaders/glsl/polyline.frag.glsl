#include chunks/pick;

uniform vec3 color;
uniform float nvr_uPickable;
uniform vec3 nvr_uHighlightColor;

in vec2 nvr_vBatchIdAndSel;

void main() {
    gl_FragColor = vec4(color, 1.);

    if(nvr_uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(nvr_vBatchIdAndSel.x);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
    }

    if(nvr_vBatchIdAndSel.y > 0.0) {
        gl_FragColor = vec4(nvr_uHighlightColor.xyz, 1.0);
    }
}
