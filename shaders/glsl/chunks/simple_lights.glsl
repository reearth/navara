// Ref: https://github.com/mrdoob/three.js/blob/0eb4c7a14e23351ebdaa67eb5b5090077ba6bfed/src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js#L129
vec3 getDirLightColor() {
  vec3 lightColor = vec3(1.0);
  #if ( NUM_DIR_LIGHTS > 0 )
    DirectionalLight directionalLight;
    #pragma unroll_loop_start
	  for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		  directionalLight = directionalLights[ i ];
      lightColor *= directionalLight.color;
    }
    #pragma unroll_loop_end
  #endif
  return lightColor;
}

// Ref: https://github.com/mrdoob/three.js/blob/9d8aa5975b8d4903e27e53ba5734fbe530376945/src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js#L170C1-L194C7
vec3 getIrradiance(vec3 geometryNormal) {
  vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

  #if defined( USE_LIGHT_PROBES )

    irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );

  #endif

  #if ( NUM_HEMI_LIGHTS > 0 )

    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

      irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );

    }
    #pragma unroll_loop_end

  #endif
  return irradiance;
}
