// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Shaders/PolylineShadowVolumeFS.glsl

#include chunks/planeDistance;
#include chunks/windowToEyeCoordinates;
#include chunks/metersPerPixel;
#include chunks/pick;

#include <common>
#include <packing>
#include <color_pars_fragment>

#include <lights_pars_begin>
#include <lights_lambert_pars_fragment>

in vec4 v_startPlaneNormalEcAndHalfWidth;
in vec3 v_endPlaneNormalEc;
in vec4 v_rightPlaneEC; // Technically can compute distance for this here
in vec4 v_endEcAndStartEcX;
in vec4 v_texcoordNormalizationAndStartEcYZ;
in vec2 nvr_vBatchIdAndSel;

uniform vec3 color;
uniform vec3 viewportAndPixelRatio;
uniform sampler2D tGlobeDepth;
uniform sampler2D uGlobeNormal;
uniform bool useGroundNormals;
uniform vec2 frustumNearFar;
uniform vec4 frustumRatio;
uniform float logDepthBufFC;
uniform mat4 inverseProjectionMatrix;
uniform float nvr_uPickable;
uniform vec3 nvr_uHighlightColor;

float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture( depthSampler, coord ).r;
    return fragCoordZ;
}


void main() {
    vec2 viewport = (viewportAndPixelRatio.xy * viewportAndPixelRatio.z);
    float logDepthOrDepth = readDepth(tGlobeDepth, gl_FragCoord.xy / viewport.xy);

    // Discard sky
    if (logDepthOrDepth == 1.0) {
        discard;
    }
    
    vec3 ecStart = vec3(v_endEcAndStartEcX.w, v_texcoordNormalizationAndStartEcYZ.zw);

    float near = frustumNearFar.x;
    float far = frustumNearFar.y;
    float linearDepth = exp2(logDepthOrDepth / (logDepthBufFC * 0.5)) - 1.0;
    float depthFromCamera = linearDepth + near;
    float z_ndc = -1. * depthFromCamera;

    // Transform to clip coordinates
    vec4 clipCoords = vec4(
        (gl_FragCoord.xy / viewport) * 2.0 - 1.0,
        z_ndc,
        1.0
    );
    // Transform to eye coordinates
    vec4 eyeCoordinate = inverseProjectionMatrix * clipCoords;
    eyeCoordinate.w = 1.0 / depthFromCamera;
    eyeCoordinate /= eyeCoordinate.w;

    float halfMaxWidth = v_startPlaneNormalEcAndHalfWidth.w * nvr_metersPerPixel(eyeCoordinate, viewportAndPixelRatio, frustumNearFar, frustumRatio);
    // Check distance of the eye coordinate against the right-facing plane
    float widthwiseDistance = nvr_planeDistance(v_rightPlaneEC, eyeCoordinate.xyz);

    // Check eye coordinate against the mitering planes
    float distanceFromStart = nvr_planeDistance(v_startPlaneNormalEcAndHalfWidth.xyz, -dot(ecStart, v_startPlaneNormalEcAndHalfWidth.xyz), eyeCoordinate.xyz);
    float distanceFromEnd = nvr_planeDistance(v_endPlaneNormalEc.xyz, -dot(v_endEcAndStartEcX.xyz, v_endPlaneNormalEc.xyz), eyeCoordinate.xyz);

    if (abs(widthwiseDistance) > halfMaxWidth || distanceFromStart <= 0.0 || distanceFromEnd <= 0.0) {
        discard;
    }

    if(nvr_uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(nvr_vBatchIdAndSel.x);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
        return;
    }

    vec4 diffuseColor = vec4( color, 1. );

    if(nvr_vBatchIdAndSel.y > 0.0) {
        diffuseColor = vec4(nvr_uHighlightColor.xyz, 1.0);
    }


    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = vec3(1.);

    #include <color_fragment>
    #include <specularmap_fragment>
    #include <emissivemap_fragment>

    vec2 uv = gl_FragCoord.xy / vec2(textureSize(uGlobeNormal, 0));
    vec3 mapN = unpackRGBToNormal(texture2D( uGlobeNormal, uv ).xyz);
    // TODO: Support scaling normal. It's used to emphasis the shadow.
    // mapN.xy *= scaledNormal;
    vec3 normal = normalize( mapN );

    // accumulation
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

    vec3 outgoingLight; 
    if(!useGroundNormals) {
        // Without lighting
        outgoingLight = diffuseColor.xyz;
    } else {
        outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    }

    #include <opaque_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
