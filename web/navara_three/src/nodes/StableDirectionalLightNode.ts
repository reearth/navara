import { Vector3 } from "three";
import {
  cameraViewMatrix,
  normalize,
  renderGroup,
  uniform,
  vec4,
} from "three/tsl";
import { DirectionalLightNode, type NodeBuilder } from "three/webgpu";

/**
 * `DirectionalLightNode` subclass that avoids GPU-side precision loss in
 * the light-direction computation.
 *
 * Upstream `DirectionalLightNode.setupDirect` calls
 * `lightTargetDirection(light)` which is
 *
 *     cameraViewMatrix.transformDirection(
 *       lightPosition(light).sub(lightTargetPosition(light))
 *     )
 *
 * The two `Vector3` uniforms (`lightPosition` / `lightTargetPosition`) hold
 * the light's and target's WORLD positions. With geospatial-scale scenes
 * (millions of meters from origin), the difference of two large FP32 values
 * loses precision — and when `CascadedShadowMaps.update()` re-positions the
 * cascade lights every frame to track the camera frustum, the precision-loss
 * "bucket" shifts per frame, jittering the light direction and producing
 * visible brightness flicker on TSL meshes lit by these cascade lights.
 * (The legacy GLSL path is unaffected because `WebGLRenderer.WebGLLights`
 * performs the same subtraction on the CPU in JS's 64-bit doubles before
 * uploading the small direction vector.)
 *
 * This subclass replaces `lightDirection` with a CPU-computed uniform:
 * each render, we subtract `light.position - light.target.position` on the
 * CPU (where JS uses 64-bit doubles) and upload the resulting small
 * direction vector. The shader then only transforms this short, precise
 * vector through the camera view matrix — no large-magnitude subtraction
 * happens on the GPU. `lightColor` is left to the upstream implementation.
 *
 * NOTE: This class is renderer-agnostic. The same precision issue occurs
 * under `WebGPURenderer` because GPU shaders use FP32 regardless of the
 * rendering backend. When migrating to WebGPU, keep this file and register
 * it against the WebGPU `NodeLibrary` the same way
 * `setupWebGLNodesHandler` does for WebGL — that is, by setting
 * `library.lightNodes.set(DirectionalLight, StableDirectionalLightNode)`.
 */
export class StableDirectionalLightNode extends DirectionalLightNode {
  // Mirror upstream's `static get type()` declaration shape — a readonly
  // field can't override a parent's static getter under TypeScript's
  // ECMAScript-class-fields target, so the lint rule has to be silenced.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  static get type(): string {
    return "StableDirectionalLightNode";
  }

  override setupDirect(builder: NodeBuilder) {
    const upstream = super.setupDirect(builder);
    const light = this.light;
    if (upstream === undefined || light === null) return upstream;

    // Subtract `position - target.position` on the CPU each render. The
    // values may be large (geospatial scale) but JS does this in 64-bit
    // doubles, so the small direction vector that ends up uploaded keeps
    // its precision. `onRenderUpdate` binds `this` to the UniformNode so
    // we can write `this.value` from the callback. `light` is captured
    // by closure so the callback always reads the live positions legacy
    // CSM has written.
    const directionUniform = uniform(new Vector3())
      .setGroup(renderGroup)
      .onRenderUpdate(function () {
        this.value.subVectors(light.position, light.target.position);
      });

    const lightDirection = normalize(
      cameraViewMatrix.mul(vec4(directionUniform, 0)).xyz,
    );

    return {
      lightColor: upstream.lightColor,
      lightDirection,
    };
  }
}
