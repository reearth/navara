import {
  AlwaysStencilFunc,
  BackSide,
  DecrementWrapStencilOp,
  FrontSide,
  IncrementWrapStencilOp,
  KeepStencilOp,
  Mesh,
  NotEqualStencilFunc,
  ZeroStencilOp,
  type BufferGeometry,
  type Material,
  type NormalBufferAttributes,
  type Object3DEventMap,
  type Texture,
} from "three";

import { createReplacer } from "../utils";

const DRAPE_SETUP = Symbol("DRAPE_SETUP");

/**
 * Shades a draped material with the terrain's normal instead of its own. The
 * visible fragments are the back faces of a volume clipped to the ground by
 * {@link DrapedMesh.process}, so the mesh's own normals point in an arbitrary
 * direction while the ground's normal is what the lighting should use.
 *
 * The decoder (`unpackVec2ToNormal`) comes from the packing helpers that
 * `overrideMaterialsForMRT` puts in every `ShaderLib` material, so a custom
 * `ShaderMaterial` in the draped scene needs to bring its own. Idempotent.
 *
 * @param globeNormal - Uniform ref for the globe normal copy, kept alive by
 *   the caller (see `CustomRenderPass`).
 */
export function setupMaterialForDrape(
  material: Material,
  globeNormal: { value: Texture | null },
): void {
  const target = material as Material & { [DRAPE_SETUP]?: boolean };
  if (target[DRAPE_SETUP]) return;
  target[DRAPE_SETUP] = true;

  // Draped and undraped materials must not share a compiled program.
  const previousCacheKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () =>
    `${previousCacheKey ? previousCacheKey.call(material) : ""}_NvrDraped`;

  const previousOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    // Runs BEFORE the previous handler on purpose: navara_three_csm swaps
    // `#include <lights_fragment_begin>` for its cascaded-lights chunk, so
    // delegating first would leave nothing to anchor to. The include survives
    // this replacement, so the CSM swap still finds it afterwards.
    const hook = "#include <lights_fragment_begin>";
    // Absent from unlit materials, where drape shading is moot.
    if (shader.fragmentShader.includes(hook)) {
      shader.uniforms.uGlobeNormal = globeNormal;
      shader.fragmentShader = createReplacer(
        `uniform sampler2D uGlobeNormal;\n${shader.fragmentShader}`,
      ).replace(
        hook,
        `
          {
            vec2 nvrDrapeUv = gl_FragCoord.xy / vec2(textureSize(uGlobeNormal, 0));
            normal = normalize(unpackVec2ToNormal(texture2D(uGlobeNormal, nvrDrapeUv).xy));
          }
          ${hook}
        `,
      ).source;
    }

    previousOnBeforeCompile?.call(material, shader, renderer);
  };

  material.needsUpdate = true;
}

export class DrapedMesh<
  TGeometry extends BufferGeometry = BufferGeometry<NormalBufferAttributes>,
  TMaterial extends Material | Material[] = Material | Material[],
  TEventMap extends Object3DEventMap = Object3DEventMap,
> extends Mesh<TGeometry, TMaterial, TEventMap> {
  drapedEnable: boolean;

  constructor(geometry?: TGeometry, material?: TMaterial, enable = true) {
    super(geometry, material);
    this.drapedEnable = enable;

    // Shadows are forced off while draped: see process() for why the shading
    // must not depend on world position. Installed as an own accessor because
    // Object3D declares `receiveShadow` as a plain property, which TypeScript
    // refuses to let a subclass override with a getter/setter (TS2611).
    let receiveShadow = false;
    Object.defineProperty(this, "receiveShadow", {
      get: () => (this.drapedEnable ? false : receiveShadow),
      set: (value: boolean) => {
        receiveShadow = value;
      },
      configurable: true,
      enumerable: true,
    });
  }

  enabled() {
    return this.drapedEnable && this.visible;
  }

  /**
   * Run the stencil-test draping passes for this mesh.
   * The caller supplies a `render` callback that performs the actual draw call
   * (e.g. `renderer.render(scene, camera)`).
   *
   * The final pass draws every back face with the depth test off, so a pixel
   * can be covered several times where the volume folds over a peak. The
   * shading must therefore not depend on world position, or the far face
   * shows through the near one — hence the screen-space normal from
   * {@link setupMaterialForDrape} and the forced-off `receiveShadow`. The
   * terrain underneath keeps its own shadows; only the drape stays lit.
   */
  process(render: () => void): void {
    if (!this.enabled()) return;

    const run = (m: Material) => {
      // Save original material state
      const origStencilFunc = m.stencilFunc;
      const origStencilFail = m.stencilFail;
      const origStencilZPass = m.stencilZPass;
      const origStencilZFail = m.stencilZFail;
      const origSide = m.side;
      const origColorWrite = m.colorWrite;
      const origDepthWrite = m.depthWrite;
      const origStencilWrite = m.stencilWrite;
      const origDepthTest = m.depthTest;

      // Back face pass
      m.stencilFunc = AlwaysStencilFunc;
      m.stencilFail = KeepStencilOp;
      m.stencilZPass = KeepStencilOp;
      m.stencilZFail = IncrementWrapStencilOp;
      m.side = BackSide;
      m.colorWrite = false;
      m.depthWrite = false;
      m.stencilWrite = true;
      m.depthTest = true;

      render();

      // Front face pass
      m.side = FrontSide;
      m.stencilZFail = DecrementWrapStencilOp;

      render();

      // Final pass
      m.stencilFunc = NotEqualStencilFunc;
      m.stencilFail = ZeroStencilOp;
      m.stencilZFail = ZeroStencilOp;
      m.stencilZPass = ZeroStencilOp;
      m.side = BackSide;
      m.colorWrite = true;
      m.depthTest = false;

      render();

      // Restore original material state
      m.stencilFunc = origStencilFunc;
      m.stencilFail = origStencilFail;
      m.stencilZPass = origStencilZPass;
      m.stencilZFail = origStencilZFail;
      m.side = origSide;
      m.colorWrite = origColorWrite;
      m.depthWrite = origDepthWrite;
      m.stencilWrite = origStencilWrite;
      m.depthTest = origDepthTest;
    };

    if (Array.isArray(this.material)) {
      this.material.map(run);
    } else {
      run(this.material);
    }
  }
}
