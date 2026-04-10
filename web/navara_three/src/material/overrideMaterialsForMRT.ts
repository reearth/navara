// Ref: https://github.com/takram-design-engineering/three-geospatial/blob/main/packages/effects/src/setupMaterialsForGeometryPass.ts

import { packing } from "@takram/three-geospatial/shaders";
import { ShaderLib, ShaderMaterial, type ShaderLibShader } from "three";
import { LineMaterial } from "three-stdlib";

import { createReplacer } from "../utils";

const SETUP = Symbol("SETUP");

declare module "three" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ShaderLibShader {
    [SETUP]?: boolean;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ShaderMaterial {
    [SETUP]?: boolean;
  }
}

function injectNormal(shader: ShaderLibShader): ShaderLibShader {
  const vertexShader = createReplacer(shader.vertexShader)
    .replace(
      /* glsl */ `#include <fog_pars_vertex>`,
      /* glsl */ `
        #include <fog_pars_vertex>
        #include <normal_pars_vertex>
      `,
    )
    .replace(
      /* glsl */ `#include <defaultnormal_vertex>`,
      /* glsl */ `
        #include <defaultnormal_vertex>
        #include <normal_vertex>
      `,
    )
    .replace(
      /* glsl */ `#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )`,
      /* glsl */ `#if 1`,
    )
    .replace(
      /* glsl */ `#include <clipping_planes_vertex>`,
      /* glsl */ `
        #include <clipping_planes_vertex>
        vViewPosition = - mvPosition.xyz;
      `,
    ).source;
  shader.vertexShader = /* glsl */ `
    #undef FLAT_SHADED
    varying vec3 vViewPosition;
    ${vertexShader}
  `;

  const fragmentShader = createReplacer(shader.fragmentShader)
    .replace(
      /#ifndef FLAT_SHADED\s+varying vec3 vNormal;\s+#endif/m,
      /* glsl */ `#include <normal_pars_fragment>`,
    )
    .replace(
      /* glsl */ `#include <common>`,
      /* glsl */ `
        #include <common>
        #include <packing>
      `,
    )
    .replace(
      /* glsl */ `#include <specularmap_fragment>`,
      /* glsl */ `
        #include <specularmap_fragment>
        #include <normal_fragment_begin>
        #include <normal_fragment_maps>
      `,
    ).source;
  shader.fragmentShader = /* glsl */ `
    #undef FLAT_SHADED
    varying vec3 vViewPosition;
    ${fragmentShader}
  `;

  return shader;
}

function injectGBuffer(
  shader: ShaderLibShader,
  { type }: { type?: "basic" | "physical" } = {},
): ShaderLibShader {
  if (shader[SETUP] === true) {
    return shader;
  }
  if (type === "basic") {
    injectNormal(shader);
  }
  const normalBufferWrite =
    type === "physical"
      ? /* glsl */ `
          normalBuffer = vec4(packNormalToVec2(normal), metalnessFactor, roughnessFactor)
        `
      : /* glsl */ `
          #ifdef USE_ROUGHNESS
            float roughnessFactor = roughness;
          #else
            float roughnessFactor = 0.0;
          #endif
          normalBuffer = vec4(packNormalToVec2(normal), reflectivity, roughnessFactor);
        `;
  shader.fragmentShader = /* glsl */ `
    // MRT layout:
    //   location 0: gl_FragColor (color)
    //   location 1: normalBuffer (normal + material props)
    //   location 2: effectIdBuffer (effectIds: R=bitmask)       — SelectiveEffect only
    //   location 3: emissiveBuffer (emissive: RGB=color×intensity pre-multiplied by Three.js, A=unused) — SelectiveEffect only
    #ifndef USE_SHADOWMAP_DEPTH
      layout(location = 1) out vec4 normalBuffer;
      layout(location = 2) out vec4 effectIdBuffer;
      layout(location = 3) out vec4 emissiveBuffer;
    #endif

    #if !defined(USE_ENVMAP)
      uniform float reflectivity;
    #endif // !defined(USE_ENVMAP)

    #ifdef USE_ROUGHNESS
      uniform float roughness;
    #endif // USE_ROUGHNESS

    #ifdef USE_SELECTIVE_EFFECT
      uniform float uEffectIdsMask;
    #endif

    ${packing}
    ${
      createReplacer(shader.fragmentShader).replace(
        /}\s*$/, // Assume the last curly brace is of main()
        /* glsl */ `
          #ifndef USE_SHADOWMAP_DEPTH
            ${normalBufferWrite};

            #ifdef USE_SELECTIVE_EFFECT
              effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
              emissiveBuffer = vec4(emissive, 1.0);
            #else
              effectIdBuffer = vec4(0.0);
              emissiveBuffer = vec4(0.0);
            #endif
          #endif
        }
      `,
      ).source
    }
  `;
  shader[SETUP] = true;
  return shader;
}

function injectGBufferToSpriteMaterial(shader: ShaderLibShader) {
  if (shader[SETUP] === true) {
    return shader;
  }

  shader.vertexShader = /* glsl */ `
    varying vec3 vViewPosition;
    ${
      createReplacer(shader.vertexShader).replace(
        /}\s*$/,
        `
        vViewPosition = -mvPosition.xyz;
      }
    `,
      ).source
    }
  `;

  shader.fragmentShader = /* glsl */ `
    layout(location = 1) out vec4 normalBuffer;
    layout(location = 2) out vec4 effectIdBuffer;
    layout(location = 3) out vec4 emissiveBuffer;

    #ifdef USE_SELECTIVE_EFFECT
      uniform float uEffectIdsMask;
    #endif

    varying vec3 vViewPosition;

    ${packing}

    ${
      createReplacer(shader.fragmentShader).replace(
        /}\s*$/, // Assume the last curly brace is of main()
        /* glsl */ `
          // Flat shading
          vec3 fdx = dFdx( vViewPosition );
          vec3 fdy = dFdy( vViewPosition );
          vec3 normal = normalize( cross( fdx, fdy ) );
          normalBuffer = vec4(
            packNormalToVec2(normal),
            0.0,
            0.0
          );

          #ifdef USE_SELECTIVE_EFFECT
            effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
            emissiveBuffer = vec4(0.0);
          #else
            effectIdBuffer = vec4(0.0);
            emissiveBuffer = vec4(0.0);
          #endif
        }
      `,
      ).source
    }
  `;

  shader[SETUP] = true;

  return shader;
}

export function overrideMaterialsForMRT(): void {
  injectGBuffer(ShaderLib.lambert);
  injectGBuffer(ShaderLib.phong);
  injectGBuffer(ShaderLib.basic, { type: "basic" });
  injectGBuffer(ShaderLib.standard, { type: "physical" });
  injectGBuffer(ShaderLib.physical, { type: "physical" });
  injectGBufferToSpriteMaterial(ShaderLib.sprite);
  injectGBufferToSpriteMaterial(ShaderLib.points);
}

// TODO: Use a parser to handle this.
function injectGBufferToShaderMaterial(
  shader: ShaderMaterial,
  normalVariableName = "normal",
): ShaderLibShader {
  if (shader[SETUP] === true) {
    return shader;
  }

  // Vertex shader
  const common = "#include <common>";

  const logdepthParsVert = "#include <logdepthbuf_pars_vertex>";
  const logdepthVert = "#include <logdepthbuf_vertex>";

  shader.vertexShader = /* glsl */ `
    ${shader.vertexShader.includes(common) ? "" : common}
    ${shader.vertexShader.includes(logdepthParsVert) ? "" : logdepthParsVert}

    ${
      createReplacer(shader.vertexShader).replace(
        /}\s*$/, // Assume the last curly brace is of main()
        /* glsl */ `
          ${shader.vertexShader.includes(logdepthVert) ? "" : logdepthVert}
        }
      `,
      ).source
    }
  `;

  // Fragment shader
  const logdepthParsFrag = "#include <logdepthbuf_pars_fragment>";
  const logdepthFrag = "#include <logdepthbuf_fragment>";
  const normalBufferWrite = /* glsl */ `
          vec4(
            packNormalToVec2(${normalVariableName}),
            0.0,
            0.0
          );
        `;
  shader.fragmentShader = /* glsl */ `
    #ifndef USE_SHADOWMAP_DEPTH
      layout(location = 1) out vec4 normalBuffer;
      layout(location = 2) out vec4 effectIdBuffer;
      layout(location = 3) out vec4 emissiveBuffer;

      #ifdef USE_SELECTIVE_EFFECT
        uniform float uEffectIdsMask;
      #endif
    #endif

    ${packing}

    ${shader.fragmentShader.includes(logdepthParsFrag) ? "" : logdepthParsFrag}

    ${
      createReplacer(shader.fragmentShader).replace(
        /}\s*$/, // Assume the last curly brace is of main()
        /* glsl */ `
          ${shader.fragmentShader.includes(logdepthFrag) ? "" : logdepthFrag}

          #ifndef USE_SHADOWMAP_DEPTH
            normalBuffer = ${normalBufferWrite};

            #ifdef USE_SELECTIVE_EFFECT
              effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
              emissiveBuffer = vec4(0.0);
            #else
              effectIdBuffer = vec4(0.0);
              emissiveBuffer = vec4(0.0);
            #endif
          #endif
        }
      `,
      ).source
    }
  `;

  shader[SETUP] = true;

  return shader;
}

// NOTE that this function just overrides ShaderMaterial roughly, so it might fail.
// You must have `normal` variable in your shader.
// This function inject following things.
// - Normal buffer output.
// - `logdepthbuf` modules.
export function overrideShaderMaterialForMRT(
  material: ShaderMaterial,
  normalVariableName?: string,
) {
  injectGBufferToShaderMaterial(material, normalVariableName);
}

// LineMaterial MRT Support following injectGBufferToSpriteMaterial pattern
function injectGBufferToLineMaterial(lineMaterial: LineMaterial) {
  if (lineMaterial[SETUP] === true) {
    return lineMaterial;
  }

  // Check if this is actually a LineMaterial from three-stdlib
  if (
    !lineMaterial.fragmentShader ||
    !lineMaterial.fragmentShader.includes("vLineDistance")
  ) {
    return lineMaterial;
  }

  // LineMaterial already has proper vertex shader setup, so we only modify fragment shader

  lineMaterial.fragmentShader = /* glsl */ `
    layout(location = 1) out vec4 normalBuffer;
    layout(location = 2) out vec4 effectIdBuffer;
    layout(location = 3) out vec4 emissiveBuffer;

    #ifdef USE_SELECTIVE_EFFECT
      uniform float uEffectIdsMask;
    #endif

    ${packing}

    ${
      createReplacer(lineMaterial.fragmentShader)
        .replace(
          "void main() {",
          /* glsl */ `
          void main() {
            // Calculate screen-space normal for Line2 MRT compatibility
            vec3 fdx = dFdx(gl_FragCoord.xyz);
            vec3 fdy = dFdy(gl_FragCoord.xyz);
            vec3 normal = normalize(cross(fdx, fdy));

            // Ensure normal faces camera (positive Z in screen space)
            if (normal.z < 0.0) normal = -normal;
        `,
        )
        .replace(
          /}\s*$/, // Assume the last curly brace is of main()
          /* glsl */ `
          normalBuffer = vec4(
            packNormalToVec2(normal),
            0.0,
            0.0
          );

          #ifdef USE_SELECTIVE_EFFECT
            effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
            emissiveBuffer = vec4(0.0);
          #else
            effectIdBuffer = vec4(0.0);
            emissiveBuffer = vec4(0.0);
          #endif
        }
      `,
        ).source
    }
  `;

  lineMaterial[SETUP] = true;

  return lineMaterial;
}

// Enhanced overrideShaderMaterialForMRT that detects and handles LineMaterial
export function overrideLineMaterialForMRT(material: LineMaterial): void {
  injectGBufferToLineMaterial(material);
}
