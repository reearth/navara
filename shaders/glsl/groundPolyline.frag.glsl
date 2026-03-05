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

flat in vec4 v_startPlaneNormalEcAndHalfWidth;
flat in vec3 v_endPlaneNormalEc;
flat in vec4 v_rightPlaneEC;
flat in float v_startPlaneOffsetEc;
flat in float v_endPlaneOffsetEc;
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
uniform float uBloomMaskPass;
uniform float uOutlineMaskPass;
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

    float near = frustumNearFar.x;
    float far = frustumNearFar.y;

    // For picking, the camera uses setViewOffset for a 1x1 render so the pixel is already at NDC center.
    // Use NDC (0,0) in that case; otherwise derive NDC from the full-screen fragment coordinate.
    vec2 screenCoords = usePickingCoord ? vec2(0.0) : ((sampleCoord / viewport) * 2.0 - 1.0);

    #if defined(USE_LOGDEPTHBUF) || defined(USE_LOGARITHMIC_DEPTH_BUFFER)
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

    float mpp = nvr_metersPerPixel(eyeCoordinate, viewportAndPixelRatio, frustumNearFar, frustumRatio);
    float halfMaxWidth = v_startPlaneNormalEcAndHalfWidth.w * mpp;

    // Check distance of the eye coordinate against the right-facing plane
    float widthwiseDistance = nvr_planeDistance(v_rightPlaneEC, eyeCoordinate.xyz);

    float distanceFromStart = nvr_planeDistance(v_startPlaneNormalEcAndHalfWidth.xyz, v_startPlaneOffsetEc, eyeCoordinate.xyz);
    float distanceFromEnd = nvr_planeDistance(v_endPlaneNormalEc.xyz, v_endPlaneOffsetEc, eyeCoordinate.xyz);

    if (abs(widthwiseDistance) > halfMaxWidth || distanceFromStart <= 0.0 || distanceFromEnd <= 0.0) {
        discard;
    }

    if(nvr_uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
        return;
    }

    vec4 diffuseColor = vec4( color, 1. );

    // Selective effect mask pass — combined bloom+outline output
    if (uBloomMaskPass > 0.5 || uOutlineMaskPass > 0.5) {
        gl_FragColor = vec4(
            diffuseColor.rgb * uBloomMaskPass,
            uOutlineMaskPass
        );
        return;
    }

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
