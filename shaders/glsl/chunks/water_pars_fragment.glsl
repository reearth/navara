#ifndef USE_NORMALMAP_OBJECTSPACE
    uniform mat3 normalMatrix;
#endif

varying vec3 vPosition;

const float WATER_IOR = 1.333;

// ref: https://github.com/mrdoob/three.js/blob/54ac263593c81b669ca9a089491ddd9e240427d2/examples/jsm/objects/Water.js#L152-L162
vec4 getNoise( sampler2D map, vec2 uv, float time ) {
    vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
    vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
    vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
    vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
    vec4 noise = texture2D( map, uv0 ) +
        texture2D( map, uv1 ) +
        texture2D( map, uv2 ) +
        texture2D( map, uv3 );
    return noise * 0.5 - 1.0;
}

// ref: https://github.com/mrdoob/three.js/blob/8e16eaf1c2a06264e4b9edc798ffd6031d53c822/src/renderers/shaders/ShaderChunk/iridescence_fragment.glsl.js#L29
float IorToFresnel0(float ior) {
  return pow2((ior - 1.0) / (ior + 1.0));
}

vec3 getSunLightColor() {
    vec3 sunLightColor;
    #if NUM_DIR_LIGHTS > 0
    DirectionalLight sunLight = directionalLights[0]; // Assuming first light is sun light.
    sunLightColor = sunLight.color;
    #endif
    return sunLightColor;
}

// ref: https://github.com/mrdoob/three.js/blob/54ac263593c81b669ca9a089491ddd9e240427d2/examples/jsm/objects/Water.js#L165-L167
vec3 specularColor( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec) {
    vec3 sunLightColor;
    vec3 sunLightDirection;
    #if NUM_DIR_LIGHTS > 0
        DirectionalLight sunLight = directionalLights[0]; // Assuming first light is sun light.
        sunLightColor = sunLight.color;
        sunLightDirection = sunLight.direction;
    #endif

    float ndotL = max(dot(surfaceNormal, sunLightDirection), 0.0);
    if (ndotL <= 0.0) return vec3(0.0);

    vec3 reflection = normalize( reflect( -sunLightDirection, surfaceNormal ) );
    float direction = max(dot( eyeDirection, reflection ), 0.0);
    return pow( direction, shiny ) * sunLightColor * spec;
}

// Compute water Fresnel factor
float computeWaterFresnel(vec3 normal, vec3 toEye) {
    float ndotV = max(dot(normal, toEye), 0.0);
    float FO = IorToFresnel0(WATER_IOR);
    return F_Schlick(FO, 1.0, ndotV);
}

// Compute water specular reflection for tile and polygon meshes
// Returns the specular component for water surfaces
vec3 computeWaterSpecular(
    const in sampler2D waterNormalMap,
    const in vec2 uv,
    const in float speed,
    const in vec3 viewPosition,
    const in mat3 normalMatrix,
    const in vec3 origNormal,
    const in float shininess,
    const in float specStrength,
    const in vec3 diffuseColor,
    out vec3 normal
) {
    vec4 noise = getNoise(waterNormalMap, uv, speed);
    vec3 noiseNormal = normalMatrix * noise.xyz;
    normal = normalize(noiseNormal * origNormal * 1.5 + origNormal);
    
    vec3 toEye = normalize(viewPosition);
    float specularF = computeWaterFresnel(normal, toEye);

    vec3 scatter = max( 0.0, dot( normal, toEye ) ) * diffuseColor;

    return specularColor(normal, toEye, shininess, specStrength) * specularF + scatter;
}

// Simplified version for model.ts use case
vec3 computeWaterSpecularSimple(
    const in sampler2D waterNormalMap,
    const in vec2 uv,
    const in float speed,
    const in vec3 viewPosition,
    const in float shininess,
    const in float specStrength,
    const in vec3 diffuseColor,
    out vec3 normal
) {
    vec4 noise = getNoise(waterNormalMap, uv, speed);
    normal = normalize(noise.xzy * vec3(1.5, 1.0, 1.5));

    vec3 toEye = normalize(viewPosition);
    float specularF = computeWaterFresnel(normal, toEye);

    vec3 scatter = max( 0.0, dot( normal, toEye ) ) * diffuseColor;
    
    return specularColor(normal, toEye, shininess, specStrength) * specularF;
}

vec3 getSkyEnv(const in vec3 geometryNormal, const in samplerCube envMap, const in vec3 worldPosition) {
    vec3 worldNormal = inverseTransformDirection( geometryNormal, viewMatrix );
    vec3 cameraToFrag  = normalize(worldPosition - cameraPosition);

    vec3 reflectDir = reflect(cameraToFrag, worldNormal);

    return textureCube(envMap, reflectDir).rgb;
}
