// Ref: https://github.com/mrdoob/three.js/blob/10a2144d99d2138f475b9da9b268ee1ff6460403/src/renderers/shaders/ShaderLib/depth.glsl.js#L83
#ifdef USE_SHADOWMAP_DEPTH
    // Higher precision equivalent of gl_FragCoord.z

	#ifdef USE_REVERSEDEPTHBUF

		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];

	#else

		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;

	#endif

	#if DEPTH_PACKING == 3200

		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );

	#elif DEPTH_PACKING == 3201

		gl_FragColor = packDepthToRGBA( fragCoordZ );

	#elif DEPTH_PACKING == 3202

		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );

	#elif DEPTH_PACKING == 3203

		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );

	#endif
	return;
#endif