#include chunks/pick;

uniform vec3 color;
uniform float nvr_uPickable;
uniform vec3 nvr_uHighlightColor;

in float nvr_vBatchId;
in float nvr_vIsPicked;

void main() {
    gl_FragColor = vec4(color, 1.);

    if(nvr_uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
    }

    if(v_IsPicked > 0.0) {
        gl_FragColor = vec4(nvr_uHighlightColor.xyz, 1.0);
    }
}
