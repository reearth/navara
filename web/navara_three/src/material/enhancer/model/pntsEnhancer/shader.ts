import type { WebGLProgramParametersWithUniforms } from "three";
import { ShaderChunk } from "three";

import { createReplacer } from "../../../../utils";

import type { PntsMutates, PntsState } from "./types";

const COLOR_DIVISOR = 65535.0;

/**
 * Transform shader with PNTS-specific modifications.
 *
 * Vertex shader changes:
 * - Adds uAddHeight and uGeodeticNormal uniforms
 * - Scales vertex colors by 1/65535 (PNTS color range normalization)
 * - Offsets vertex position along geodetic normal by uAddHeight
 */
export const transformShader = (
  shader: WebGLProgramParametersWithUniforms,
  _state: PntsState,
  mutates: PntsMutates,
): void => {
  shader.defines ??= {};

  mutates.updateUniforms(shader.uniforms, _state);

  shader.vertexShader = createReplacer(shader.vertexShader)
    .replace(
      "#include <color_vertex>",
      createReplacer(ShaderChunk.color_vertex).replace(
        "vColor = vec4( 1.0 );",
        `vColor = vec4( 1.0 / ${COLOR_DIVISOR}.0 );`,
      ).source,
    )
    .replace(
      "#include <common>",
      `#include <common>
uniform float uAddHeight;
uniform vec3 uGeodeticNormal;`,
    )
    .replace(
      "#include <project_vertex>",
      createReplacer(ShaderChunk.project_vertex)
        .replace(
          "vec4 mvPosition = vec4( transformed, 1.0 );",
          `vec4 mvPosition = vec4( transformed, 1.0 );
vec4 mvNormal = viewMatrix * vec4(uGeodeticNormal, 0.0);`,
        )
        .replace(
          "gl_Position = projectionMatrix * mvPosition;",
          `mvPosition += mvNormal * uAddHeight;
gl_Position = projectionMatrix * mvPosition;`,
        ).source,
    ).source;
};
