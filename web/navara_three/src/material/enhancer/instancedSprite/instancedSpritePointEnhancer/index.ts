/**
 * InstancedSprite **point** material enhancer.
 *
 * The point path uses a TSL {@link NodeMaterial} that is *shared* across many
 * meshes (one per `useRTE|logDepth|transparent|depthTest` combination) to avoid
 * exhausting the WebGL UBO binding-point pool — see {@link getInstancedPointNodeMaterial}.
 *
 * Because the material is shared, this enhancer keeps a per-mesh immutable state
 * snapshot and writes it into the shared uniforms just-in-time via {@link flush},
 * which the mesh wires to its `onBeforeRender` (running immediately before that
 * mesh's UBO upload). This mirrors the billboard enhancer's `mount`/`update`/
 * `states` surface so both paths manage their state the same way; the extra
 * `flush()` exists only because the underlying material is shared rather than
 * per-mesh.
 *
 * Pipeline state (`transparent`/`depthTest`) cannot be a uniform, so changing it
 * via {@link update} re-selects a different cached material and swaps
 * {@link InstancedSpritePointEnhancer.material}; the mesh re-reads it.
 */
import invariant from "tiny-invariant";

import {
  getInstancedPointNodeMaterial,
  type InstancedPointNodeMaterial,
  type NodeMaterial,
} from "./material";
import { DEFAULT_POINT_BASE_STATE, updateState } from "./state";
import type {
  InstancedSpritePointBaseProps,
  InstancedSpritePointBaseState,
} from "./types";

/**
 * Props for the instancedSprite point material enhancer.
 * Wraps the base props, mirroring the billboard enhancer's shape.
 */
export type InstancedSpritePointMaterialProps = {
  base?: InstancedSpritePointBaseProps;
};

/** Options fixed for the lifetime of a point mesh (geometry / renderer derived). */
export type InstancedSpritePointEnhancerOptions = {
  useRTE: boolean;
  logarithmicDepthBuffer: boolean;
};

/**
 * Point enhancer instance. Shaped like {@link EnhancedMaterial} but with a live
 * `material` getter (the bound material can swap on pipeline-state changes) and
 * a `flush()` for the just-in-time per-mesh uniform write.
 */
export type InstancedSpritePointEnhancer = {
  /** The currently bound shared NodeMaterial (may change across `update`). */
  readonly material: NodeMaterial;
  /** Initialize per-mesh state and bind the matching shared material. */
  mount: (props: InstancedSpritePointMaterialProps) => void;
  /** Update per-mesh state; re-binds the shared material if pipeline state changed. */
  update: (props: InstancedSpritePointMaterialProps) => void;
  /** Current per-mesh state snapshot. */
  states: () => InstancedSpritePointBaseState;
  /** Write this mesh's state into the shared material's uniforms (call in onBeforeRender). */
  flush: () => void;
};

/**
 * Create a point material enhancer for a single mesh.
 *
 * @param opts - RTE / log-depth selection, fixed for the mesh's lifetime.
 */
export function createInstancedSpritePointMaterialEnhancer(
  opts: InstancedSpritePointEnhancerOptions,
): InstancedSpritePointEnhancer {
  const { useRTE, logarithmicDepthBuffer } = opts;

  let state: InstancedSpritePointBaseState | null = null;
  let pointMat: InstancedPointNodeMaterial | null = null;

  // (Re)bind the shared material matching the current pipeline state.
  const attach = (): void => {
    invariant(state, "mount() must be called before attaching the material");
    pointMat = getInstancedPointNodeMaterial({
      useRTE,
      logarithmicDepthBuffer,
      transparent: state.transparent,
      depthTest: state.depthTest,
    });
  };

  return {
    get material(): NodeMaterial {
      invariant(pointMat, "mount() must be called before accessing material");
      return pointMat.material;
    },

    mount: (props: InstancedSpritePointMaterialProps): void => {
      state = updateState(props.base ?? {}, DEFAULT_POINT_BASE_STATE);
      attach();
    },

    update: (props: InstancedSpritePointMaterialProps): void => {
      invariant(state, "mount() must be called before update");
      const prev = state;
      state = updateState(props.base ?? {}, state);
      // The pipeline state is baked into the material, not a uniform, so swap
      // to the matching cached material when it changes.
      if (
        state.transparent !== prev.transparent ||
        state.depthTest !== prev.depthTest
      ) {
        attach();
      }
    },

    states: (): InstancedSpritePointBaseState => {
      invariant(state, "mount() must be called before states");
      return state;
    },

    flush: (): void => {
      if (!pointMat || !state) return;
      const u = pointMat.uniforms;
      u.scale.value = state.scale;
      u.center.value.set(state.center[0], state.center[1]);
      u.sizeInMeters.value = state.sizeInMeters;
      u.offsetDepth.value = state.offsetDepth;
      u.effectIdsMask.value = state.effectIdsMask;
      u.emissiveColor.value.setHex(state.emissiveColor);
      u.emissiveIntensity.value = state.emissiveIntensity;
      u.rtcCenter.value.set(
        state.rtcCenter[0],
        state.rtcCenter[1],
        state.rtcCenter[2],
      );
      u.pickable.value = state.pickable;
    },
  };
}

// Re-export material accessors and types for consumers.
export {
  getInstancedPointNodeMaterial,
  instancedPointMaterialKey,
} from "./material";
export type {
  InstancedPointMaterialOptions,
  InstancedPointMaterialUniforms,
  InstancedPointNodeMaterial,
  NodeMaterial,
} from "./material";
export type {
  InstancedSpritePointBaseProps,
  InstancedSpritePointBaseState,
} from "./types";
