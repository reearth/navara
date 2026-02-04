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
#include <shadowmap_pars_fragment>

in vec4 v_startPlaneNormalEcAndHalfWidth;
in vec3 v_endPlaneNormalEc;
in vec4 v_rightPlaneEC; // Technically can compute distance for this here
in vec4 v_endEcAndStartEcX;
in vec4 v_texcoordNormalizationAndStartEcYZ;
in float nvr_vBatchId;
in vec3 vNormal;

#include chunks/show_pars_fragment;

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
uniform vec2 nvr_uPickingCoord; // Screen coordinate for picking (in pixels)

layout(location = 1) out vec4 normalBuffer;

float readDepth(sampler2D depthSampler, vec2 coord) {
    float fragCoordZ = texture( depthSampler, coord ).r;
    return fragCoordZ;
}


void main() {
    #include chunks/show_fragment;

    vec2 viewport = (viewportAndPixelRatio.xy * viewportAndPixelRatio.z);

    // Use picking coordinate when provided (1x1 picking), otherwise use fragment coordinate
    // nvr_uPickingCoord is set to (-1, -1) for non-picking renders (including debug canvas)
    bool usePickingCoord = nvr_uPickable > 0.0 && nvr_uPickingCoord.x >= 0.0;
    vec2 sampleCoord = usePickingCoord ? nvr_uPickingCoord : gl_FragCoord.xy;
    float logDepthOrDepth = unpackRGBAToDepth(texture(tGlobeDepth, sampleCoord / viewport.xy));

    // Discard sky
    if (logDepthOrDepth == 1.0) {
        discard;
    }

    vec3 ecStart = vec3(v_endEcAndStartEcX.w, v_texcoordNormalizationAndStartEcYZ.zw);

    float near = frustumNearFar.x;
    float far = frustumNearFar.y;

    vec2 screenCoords = (sampleCoord / viewport) * 2.0 - 1.0;

    #ifdef USE_LOGDEPTHBUF
    float linearDepth = exp2(logDepthOrDepth / (logDepthBufFC * 0.5)) - 1.0;
    float depthFromCamera = linearDepth + near;
    float z_ndc = -1. * depthFromCamera;
    // Transform to clip coordinates
    vec4 clipCoords = vec4(
        screenCoords,
        z_ndc,
        1.0
    );
    // Transform to eye coordinates
    vec4 eyeCoordinate = inverseProjectionMatrix * clipCoords;
    eyeCoordinate.w = 1.0 / depthFromCamera;
    #else // USE_LOGDEPTHBUF
    // Transform to clip coordinates
    vec4 clipCoords = vec4(
        screenCoords,
        logDepthOrDepth * 2. - 1.,
        1.0
    );
    // Transform to eye coordinates
    vec4 eyeCoordinate = inverseProjectionMatrix * clipCoords;
    #endif // USE_LOGDEPTHBUF

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
        vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
        return;
    }

    vec4 diffuseColor = vec4( color, 1. );

    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = vec3(1.);

    #include <color_fragment>
    #include <specularmap_fragment>
    #include <emissivemap_fragment>

    vec3 normal;
    if(useGroundNormals) {
        vec2 uv = gl_FragCoord.xy / vec2(textureSize(uGlobeNormal, 0));
        vec3 mapN = unpackVec2ToNormal(texture2D( uGlobeNormal, uv ).xy);
        // TODO: Support scaling normal. It's used to emphasis the shadow.
        // mapN.xy *= scaledNormal;
        normal = normalize( mapN );
    } else {
        normal = vNormal;
    }

    // accumulation
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

    vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;

    #include <opaque_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    normalBuffer = vec4(
        packNormalToVec2(normal),
        0.0,
        0.0
    );
}
