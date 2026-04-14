#include chunks/pick;

#include <common>
#include <packing>
#include <color_pars_fragment>

#include <lights_pars_begin>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>

uniform vec3 color;
uniform float nvr_uPickable;

in float nvr_vBatchId;
in vec3 vNormal;

#include chunks/show_pars_fragment;

layout(location = 1) out vec4 normalBuffer;
layout(location = 2) out vec4 effectIdBuffer;
layout(location = 3) out vec4 emissiveBuffer;

#ifdef USE_SELECTIVE_EFFECT
    uniform float uEffectIdsMask;
    uniform vec3 uEmissiveColor;
    uniform float uEmissiveIntensity;
#endif

void main() {
    #include chunks/show_fragment;
    
    vec4 diffuseColor = vec4(color, 1.);
    #include <clipping_planes_fragment>

    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = vec3(0.);

    #include <color_fragment>
    #include <specularmap_fragment>
    #include <normal_fragment_begin>
    #include <emissivemap_fragment>

    #include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

    vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;

    #include <opaque_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    if(nvr_uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
    }

    normalBuffer = vec4(
        packNormalToVec2(vNormal),
        0.0,
        0.0
    );
    #ifdef USE_SELECTIVE_EFFECT
        effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
        emissiveBuffer = vec4(uEmissiveColor * uEmissiveIntensity, 1.0);
    #else
        effectIdBuffer = vec4(0.0);
        emissiveBuffer = vec4(0.0);
    #endif
}
