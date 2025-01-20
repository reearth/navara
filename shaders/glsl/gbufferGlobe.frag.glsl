precision highp float;
precision highp int;

layout(location = 0) out vec4 gNormal;

uniform sampler2D tDiffuse;
uniform vec2 repeat;
uniform float logDepthBufFC;

in vec3 vNormal;
in float vDepth;

#include <packing>

void main() {
    // write normals to G-Buffer
    gNormal = vec4(packNormalToRGB(normalize(vNormal)), 0.0 );

    // write depth to G-Buffer
    gl_FragDepth = log2( vDepth ) * logDepthBufFC * 0.5;
}
