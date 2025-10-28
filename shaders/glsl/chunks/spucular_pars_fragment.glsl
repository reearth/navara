vec3 computeSpecular(
    const in vec3 viewPosition,
    const in vec3 normal,
    const in float shininess,
    const in float specStrength,
    const in float ior
) {
    vec3 toEye = normalize(viewPosition);
    float ndotV = max(dot(normal, toEye), 0.0);
    float FO = IorToFresnel0(ior);
    float specularF = F_Schlick(FO, 1.0, ndotV);
    
    return specularColor(normal, toEye, shininess, specStrength) * specularF;
}
