// Ref: https://github.com/mrdoob/three.js/blob/10a2144d99d2138f475b9da9b268ee1ff6460403/src/renderers/shaders/ShaderLib/depth.glsl.js#L41
#ifdef USE_SHADOWMAP_DEPTH
    vHighPrecisionZW = gl_Position.zw;
#endif
