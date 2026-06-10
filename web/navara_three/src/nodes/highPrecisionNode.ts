import { calcCameraPosition, calcModelMatrixRTE } from "@navara/three_api";
import { Matrix4, Vector3 } from "three";
import {
  attribute,
  cameraProjectionMatrix,
  modelWorldMatrix,
  positionLocal,
  renderGroup,
  uniform,
  vec4,
} from "three/tsl";
import type { Node, NodeFrame } from "three/webgpu";

const _identityMatrix = new Matrix4();
const _tempCamHigh = new Vector3();
const _tempCamLow = new Vector3();
const _tempViewMatrixRTE = new Matrix4();

let _lastSyncedRenderId = -1;

/**
 * Recompute the RTE camera state once per render call.
 *
 * Both the high/low encoded camera position **and** the view matrix's
 * translation-zeroed copy (`modelViewMatrixRTE`) are derived from the same
 * `frame.camera` snapshot so the three uniforms below never disagree about
 * which camera state they represent — that matches what the legacy GLSL path
 * does in `setupRTEBeforeRender` (see `web/navara_three/src/mesh/rtcRteHelper.ts`).
 *
 * `frame.renderId` is bumped once per `updateNodes()` call, so the three
 * uniforms' `onRenderUpdate` callbacks for the *same* material render share
 * the same renderId — the second and third callers hit the guard and reuse
 * the values written by the first.
 */
function syncRTEPerRender(frame: NodeFrame): void {
  if (frame.renderId === _lastSyncedRenderId) return;
  _lastSyncedRenderId = frame.renderId;

  const cam = frame.camera;
  if (!cam) return;

  // Encode the camera world position once; both high and low temps come from
  // this single call so they're always consistent.
  const encoded = calcCameraPosition(cam.position, _identityMatrix);
  _tempCamHigh.copy(encoded.high);
  _tempCamLow.copy(encoded.low);

  // Pre-compute the view matrix with translation zeroed — equivalent to
  // legacy's `calcModelMatrixRTE(IDENTITY, matrixWorldInverse)`. Doing this
  // on the CPU (f64) and uploading a single mat4 mirrors the legacy GLSL
  // chunk and avoids any GPU-side rounding from `mat3(cameraViewMatrix)`
  // extraction.
  calcModelMatrixRTE(
    _identityMatrix,
    cam.matrixWorldInverse,
    _tempViewMatrixRTE,
  );
}

/**
 * Camera world position split into high/low f32 pairs for RTE
 * (Relative-To-Eye) rendering. The renderGroup binding fires this uniform's
 * update once per render pass; the shared {@link syncRTEPerRender} ensures
 * it stays in lockstep with {@link cameraPositionLowUniform} and
 * {@link modelViewMatrixRTEUniform}.
 *
 * `frame.camera` is the shadow camera during shadow passes — which is fine,
 * the sync helper does the same encoding regardless of pass.
 */
export const cameraPositionHighUniform = uniform(new Vector3())
  .setGroup(renderGroup)
  .onRenderUpdate(function (frame) {
    syncRTEPerRender(frame);
    this.value.copy(_tempCamHigh);
  });

export const cameraPositionLowUniform = uniform(new Vector3())
  .setGroup(renderGroup)
  .onRenderUpdate(function (frame) {
    syncRTEPerRender(frame);
    this.value.copy(_tempCamLow);
  });

/**
 * The view matrix (`camera.matrixWorldInverse`) with its translation column
 * zeroed — uploaded as a precomputed mat4 so the GPU shader doesn't have to
 * synthesize the rotation portion via `mat3(cameraViewMatrix)`. Matches the
 * legacy GLSL `modelViewMatrixRTE` uniform exactly.
 *
 * Use as `modelViewMatrixRTEUniform.mul(vec4(worldOffset, 0.0))` to project a
 * world-space eye-relative offset into view space — equivalent to
 * `mat3(cameraViewMatrix) * worldOffset` but emitted as a single mat4 *
 * vec4 instruction.
 */
export const modelViewMatrixRTEUniform = uniform(new Matrix4())
  .setGroup(renderGroup)
  .onRenderUpdate(function (frame) {
    syncRTEPerRender(frame);
    this.value.copy(_tempViewMatrixRTE);
  });

/**
 * Decode one high/low attribute pair into a world-space eye-relative offset.
 *
 * `(positionHigh - cameraHigh) + (positionLow - cameraLow)` reconstructs
 * `position - camera` in the small-magnitude eye-relative frame, preserving
 * f32 precision near the camera regardless of how far the world origin is.
 *
 * Use multiple times when a single mesh carries several encoded positions
 * — e.g. polyline geometry encodes `position_3d_*`, `start_3d_*`, and
 * `end_3d_*` and the vertex shader combines all three.
 *
 * **Why `.toVar()`:** the two subtractions are pinned to named GLSL variables
 * (`highDiff`, `lowDiff`) so the compiler can't algebraically reorder this
 * into `(high + low) - (cameraHigh + cameraLow)` — that form sums the
 * ECEF-scale halves before subtracting, triggering catastrophic cancellation
 * in f32 and producing the camera-move jitter we saw. The legacy
 * `shaders/glsl/chunks/rte_vertex.glsl` chunk relies on the same intermediate
 * variables for the same reason (and calls it out explicitly).
 */
export function highPrecisionOffsetFromAttributes(
  highAttributeName: string,
  lowAttributeName: string,
): Node<"vec3"> {
  const high = attribute<"vec3">(highAttributeName, "vec3");
  const low = attribute<"vec3">(lowAttributeName, "vec3");
  const highDiff = high.sub(cameraPositionHighUniform).toVar("rteHighDiff");
  const lowDiff = low.sub(cameraPositionLowUniform).toVar("rteLowDiff");
  return highDiff.add(lowDiff);
}

/**
 * Decode one high/low uniform pair into a world-space eye-relative offset.
 * Use this for meshes that carry their origin in `rtePosHigh/Low` uniforms
 * (typically a single point per mesh; the geometry itself stays in local
 * space and gets rotated separately — see
 * {@link highPrecisionUniformLocalVertexNode}).
 *
 * Pins each subtraction to its own GLSL local via `.toVar()` for the same
 * compiler-reorder reason documented on
 * {@link highPrecisionOffsetFromAttributes}.
 */
export function highPrecisionOffsetFromUniforms(
  posHigh: Node<"vec3">,
  posLow: Node<"vec3">,
): Node<"vec3"> {
  const highDiff = posHigh.sub(cameraPositionHighUniform).toVar("rteHighDiff");
  const lowDiff = posLow.sub(cameraPositionLowUniform).toVar("rteLowDiff");
  return highDiff.add(lowDiff);
}

/**
 * Project a world-space eye-relative offset into a clip-space `gl_Position`.
 *
 * Uses `modelViewMatrixRTEUniform * vec4(worldOffset, 0.0)` — `w=0` skips
 * the translation column (which is already zero) and matches the legacy
 * GLSL chunk's `modelViewMatrixRTE * vec4(modelCenterOffset, 0.0)`. The
 * single CPU-precomputed mat4 avoids any GPU-side `mat3()` extraction.
 *
 * This only applies the view rotation. If the caller needs the mesh's own
 * world rotation/scale applied to a local position, they must do that before
 * adding it to the world-offset (see
 * {@link highPrecisionUniformLocalVertexNode}).
 */
export function highPrecisionVertexNode(
  worldOffset: Node<"vec3">,
): Node<"vec4"> {
  const mvOffset = modelViewMatrixRTEUniform.mul(vec4(worldOffset, 0.0));
  return cameraProjectionMatrix.mul(mvOffset);
}

/**
 * Build the **view-space eye-relative position** for the uniform-local RTE
 * pattern (same input shape as {@link highPrecisionUniformLocalVertexNode}).
 *
 * Override `material.setupPositionView = (builder) => highPrecisionViewPositionNode({...})`
 * on a `NodeMaterial` whose `vertexNode` is also set via this module — that
 * makes TSL's `v_positionView` varying (and the downstream
 * `v_positionViewDirection`) carry the small-magnitude eye-relative value
 * instead of the default `cameraViewMatrix * modelWorldMatrix * positionLocal`
 * formulation, which evaluates to `~|cameraWorldPos|` (≈ 6.4M at geospatial
 * scale) when `modelWorldMatrix` has its translation stripped for RTE. That
 * large magnitude is what causes f32 round noise in the view-direction
 * varying, and hence visible specular jitter as the camera moves.
 *
 * The returned node is mathematically `gl_Position / projection` — same math
 * as the legacy chunk's `mvPosition` (pre-projection), which the legacy GLSL
 * mesh material also used for `vViewPosition`.
 */
export function highPrecisionViewPositionNode(options: {
  rtePosHigh: Node<"vec3">;
  rtePosLow: Node<"vec3">;
  positionLocal?: Node<"vec3">;
}): Node<"vec3"> {
  const local = options.positionLocal ?? positionLocal;
  const mvMatrixLocal = modelViewMatrixRTEUniform.mul(modelWorldMatrix);
  const mvLocalPos = mvMatrixLocal.mul(vec4(local, 1.0));
  const originOffset = highPrecisionOffsetFromUniforms(
    options.rtePosHigh,
    options.rtePosLow,
  );
  const mvOriginOffset = modelViewMatrixRTEUniform.mul(vec4(originOffset, 0.0));
  return mvLocalPos.add(mvOriginOffset).xyz;
}

/**
 * Build the world-space position for the "uniform-local" RTE pattern.
 *
 * `modelWorldMatrix` contains rotation/scale only, while the per-instance
 * translation lives in the encoded `rtePosHigh/Low` uniforms. This helper
 * reconstructs the full world-space position so downstream nodes (for example
 * shadow lookup) can share the exact same formula.
 */
export function highPrecisionWorldPositionNode(options: {
  rtePosHigh: Node<"vec3">;
  rtePosLow: Node<"vec3">;
  positionLocal?: Node<"vec3">;
}): Node<"vec3"> {
  const local = options.positionLocal ?? positionLocal;
  const worldLocal = modelWorldMatrix
    .mul(vec4(local, 1.0))
    .xyz.toVar("rteWorldLocal");
  const lowLocal = options.rtePosLow.add(worldLocal).toVar("rteLowLocal");
  return options.rtePosHigh.add(lowLocal);
}

/**
 * Convenience wrapper for the "uniform-local" RTE pattern: the mesh's
 * geometry stays in local space and its world origin is supplied as high/low
 * uniforms (`rtePosHigh` + `rtePosLow`).
 *
 * Pre-condition: the mesh's `matrixWorld` must have its translation stripped
 * (rotation/scale only). `composeWorldMatrixForRTE` in `@navara/three_api`
 * is the existing helper for that decomposition.
 *
 * Math mirrors the legacy GLSL chunk `project_vertex_rte_model.glsl`:
 *
 *     modelViewMatrixRTE_Local = modelViewMatrixRTE * modelMatrix
 *     mvLocalPosition          = modelViewMatrixRTE_Local * vec4(positionLocal, 1.0)
 *     mvCenterOffset           = modelViewMatrixRTE * vec4(modelCenterOffset, 0.0)
 *     gl_Position              = projectionMatrix * (mvLocalPosition + mvCenterOffset)
 *
 * Combining the model and view rotation as one mat4*mat4 multiplication on
 * the GPU (rather than two sequential vec ops) is what avoids the camera-move
 * jitter we hit with the earlier `mat3()`-based formulation.
 *
 * Pass a non-default `positionLocal` Node to apply vertex-level displacement
 * — the equivalent of setting `material.positionNode` on a vanilla
 * `NodeMaterial`. The latter is unreachable here because assigning
 * `material.vertexNode` (which this returns) bypasses the standard position
 * pipeline; this parameter is the explicit injection point.
 */
export function highPrecisionUniformLocalVertexNode(options: {
  rtePosHigh: Node<"vec3">;
  rtePosLow: Node<"vec3">;
  positionLocal?: Node<"vec3">;
}): Node<"vec4"> {
  const viewPos = highPrecisionViewPositionNode(options);
  return cameraProjectionMatrix.mul(vec4(viewPos, 1.0));
}
