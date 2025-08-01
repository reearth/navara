// Ref: https://github.com/mrdoob/three.js/blob/10a2144d99d2138f475b9da9b268ee1ff6460403/src/renderers/shaders/ShaderLib/depth.glsl.js#L14
#ifdef USE_SHADOWMAP_DEPTH
    // This is used for computing an equivalent of gl_FragCoord.z that is as high precision as possible.
    // Some platforms compute gl_FragCoord at a lower precision which makes the manually computed value better for
    // depth-based postprocessing effects. Reproduced on iPad with A10 processor / iPadOS 13.3.1.
    varying vec2 vHighPrecisionZW;
#endif
