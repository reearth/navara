import {
  cameraFar,
  diffuseColor,
  log2,
  normalView,
  output,
  outputStruct,
  positionView,
  vec3,
  vec4,
} from "three/tsl";
import type { Node, NodeMaterial } from "three/webgpu";

import { packNormalToVec2 } from "./normalPacking";

/**
 * Matches the ShaderChunk `logdepthbuf_fragment` formula used by non-TSL meshes
 * (`log2(1 + gl_Position.w) / log2(cameraFar + 1)`). TSL's own
 * `viewZToLogarithmicDepth` uses a different (Ulrich-style) formula and would
 * break z-order against the standard meshes sharing this depth buffer.
 * `gl_Position.w = -positionView.z` under our PerspectiveCamera.
 */
// TODO: Remove this patch if we move to WebGPURenderer.
export const logarithmicDepthNode: Node<"float"> = log2(
  positionView.z.negate().add(1),
).div(log2(cameraFar.add(1)));

/**
 * Per-component inputs for {@link setupNodeMaterialForMRT}. Callers customize
 * at the granularity of "what normal direction" / "how much roughness" so the
 * MRT slot layout (octahedral packing, slot meaning) stays under this
 * function's control.
 *
 * Exception: {@link colorNode} accepts a full vec4 because picking has to
 * swap the *entire* lit output for a batchId color.
 */
export type MRTOptions = {
  /** Full vec4 written to MRT slot 0. Default: `output` (lit fragment color). */
  colorNode?: Node<"vec4">;
  /** View-space normal; packed octahedrally into slot 1 `.xy`. Default: `normalView`. */
  normalNode?: Node<"vec3">;
  /** Roughness, written to slot 1 `.w`. Default: 0. */
  roughnessNode?: Node<"float">;
  /** Metalness/reflectivity, written to slot 1 `.z`. Default: 0. */
  metalnessNode?: Node<"float">;
  /** Additive emissive vec3 for slot 3. Default: `vec3(0)`. */
  emissiveNode?: Node<"vec3">;
  /** Multiplier on `diffuseColor.rgb` in slot 3. Default: 0. */
  emissiveIntensityNode?: Node<"float">;
  /** Selective-effect bitmask written to slot 2 `.r`. Default: 0. */
  effectIdsMaskNode?: Node<"float">;
};

/**
 * Wire a {@link NodeMaterial} into Navara's 4-attachment MRT (color, normal,
 * effectId, emissive). `GLSLNodeBuilder` emits `outputStruct` as
 * `layout(location = N) out vec4 mN;`, slotting into the framebuffer that
 * `overrideMaterialsForMRT()` already binds — so this works on
 * `WebGLNodesHandler` despite it not supporting `renderer.getMRT()`.
 *
 * `logarithmicDepthBuffer` must mirror the renderer's log-depth mode
 * (`renderer.capabilities.logarithmicDepthBuffer`). When it is off, leaving
 * `depthNode` unset keeps these meshes on hardware depth, matching the legacy
 * non-TSL meshes that share the depth buffer; forcing the log-depth formula
 * regardless would desync z-order against them.
 */
export function setupNodeMaterialForMRT(
  material: NodeMaterial,
  options: MRTOptions = {},
  logarithmicDepthBuffer = true,
): void {
  const colorSlot = options.colorNode ?? output;
  const normalSlot = vec4(
    packNormalToVec2(options.normalNode ?? normalView),
    options.metalnessNode ?? 0,
    options.roughnessNode ?? 0,
  );
  const effectIdSlot = vec4(options.effectIdsMaskNode ?? 0, 0, 0, 1);
  const emissiveSlot = vec4(
    diffuseColor.rgb
      .mul(options.emissiveIntensityNode ?? 0)
      .add(options.emissiveNode ?? vec3(0)),
    1,
  );

  // Must be the OutputStructNode directly, not wrapped in `Fn(() => ...)`:
  // the wrapper would make the builder declare a temporary `OutputType nodeVarN`
  // and skip the `layout(...) out` emission path.
  material.outputNode = outputStruct(
    colorSlot,
    normalSlot,
    effectIdSlot,
    emissiveSlot,
  );

  // NodeMaterial's automatic log-depth path checks `renderer.logarithmicDepthBuffer`,
  // which on WebGLRenderer lives on `renderer.capabilities` instead, so the
  // material would silently skip `gl_FragDepth` and desync from the standard
  // meshes that do write it. Only patch it in when the renderer has log-depth
  // enabled — otherwise both TSL and non-TSL meshes stay on hardware depth.
  if (logarithmicDepthBuffer) {
    material.depthNode = logarithmicDepthNode;
  }
}
