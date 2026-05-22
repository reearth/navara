import {
  DirectionalLight,
  Vector2,
  WebGLCoordinateSystem,
  type Camera,
  type WebGLRenderer,
} from "three";
import { CSMFrustum } from "three/examples/jsm/csm/CSMFrustum.js";
import { CSMShadowNode } from "three/examples/jsm/csm/CSMShadowNode.js";
import { shadow } from "three/tsl";
import type { Node } from "three/webgpu";

// Module augmentation: expose upstream `CSMShadowNode`'s private-by-convention
// internals on the type so this subclass can manipulate them cast-free. The
// underlying instance properties exist at runtime — @types/three just doesn't
// declare them because they're prefixed with `_`.
type ShadowNodeRef = ReturnType<typeof shadow>;
declare module "three/examples/jsm/csm/CSMShadowNode.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface CSMShadowNode {
    /** Per-cascade TSL shadow nodes built in `_init`. */
    _shadowNodes: ShadowNodeRef[];
    /** Per-cascade linear-depth ranges (`splits[i-1]`, `splits[i]`). */
    _cascades: Vector2[];
  }
}

/**
 * `CSMShadowNode` subclass that works under `WebGLRenderer + WebGLNodesHandler`.
 *
 * The upstream class is documented as WebGPU-only. Three problems prevent
 * it from running under WebGL:
 *
 * 1. Per-cascade shadow casters are created as `LwLight extends Object3D`.
 *    `WebGLRenderer` collects lights for the shadow pass by
 *    `object.isLight`, which `LwLight` does not set, so `WebGLShadowMap`
 *    never allocates `lwLight.shadow.map`.
 * 2. `WebGLNodesHandler` patches `ShadowNode.setupRenderTarget` to read
 *    `shadow.map.depthTexture` directly. With `shadow.map === null` this
 *    crashes with `Cannot read properties of null (reading 'depthTexture')`.
 * 3. `WebGLNodesHandler` also no-ops `ShadowNode.updateBefore`, and the
 *    framework does not invoke `updateBefore` on the outer `CSMShadowNode`
 *    automatically, so cascade light positions never track the camera.
 *
 * This subclass fixes all three by overriding `_init` to use real
 * `DirectionalLight` instances. It also supports a **shared** mode where
 * the cascade lights and cascade ranges are owned by an external CSM
 * orchestrator (e.g. `CascadedShadowMaps` from this package); see
 * {@link useSharedCascade}. Sharing keeps the total shadow-map count at
 * 4 (or N cascades) instead of doubling under WebGL's tight
 * `MAX_TEXTURE_IMAGE_UNITS` budget.
 *
 * --- WebGPU migration notes ---
 * This class is a WebGL-specific workaround. When navara migrates to
 * `WebGPURenderer`, delete this file entirely and replace usages in
 * `sunLight.ts` with upstream `CSMShadowNode`
 * (`three/examples/jsm/csm/CSMShadowNode.js`) directly. Shared-cascade
 * mode (`useSharedCascade`) is itself transitional and will not be
 * needed after the GLSL→TSL migration completes, so do NOT migrate it
 * to WebGPU.
 *
 * What MUST be kept across the migration:
 * - `StableDirectionalLightNode` (renderer-agnostic precision fix,
 *   located at `@navara/three/src/nodes/`)
 * - {@link attachShadowNodeToLight} utility (just assigns
 *   `light.shadow.shadowNode`, works for any renderer)
 *
 * What gets DELETED:
 * - The entire `_init` / `attachToScene` / `useSharedCascade` machinery
 *   here (upstream's `LwLight` + lazy `updateBefore` on WebGPU is fine)
 */
export class CSMShadowNodeForWebGL extends CSMShadowNode {
  // Refine inherited types. Upstream declares `light: Light` and
  // `lights: LwLight[]`, but in this subclass we always pass a
  // `DirectionalLight` to `super()` and `_init` populates `lights` with
  // real `DirectionalLight` instances.
  declare light: DirectionalLight;
  declare lights: DirectionalLight[];

  private _initialized = false;
  private _externalLights: DirectionalLight[] | null = null;
  private _externalCascades: Vector2[] | null = null;

  /**
   * Share cascade lights and cascade ranges with an external CSM orchestrator
   * (typically `CascadedShadowMaps`). `_init` reuses those lights instead of
   * creating new `DirectionalLight` instances, and the TSL graph reads
   * cascade boundaries through the same `Vector2[]` (so the external
   * orchestrator's frame-by-frame mutation is automatically visible to the
   * TSL graph).
   *
   * MUST be called BEFORE {@link attachToScene} (or the framework's lazy
   * first-frame setup). Both arrays must have at least `this.cascades`
   * entries.
   */
  useSharedCascade(lights: DirectionalLight[], cascades: Vector2[]): void {
    this._externalLights = lights;
    this._externalCascades = cascades;
  }

  /**
   * Force lazy `_init` to run now. Must be called before the first
   * `renderer.render(scene, camera)` so `_shadowNodes` is populated
   * before TSL graph compilation reads it via `_setupStandard` /
   * `_setupFade`. Cascade lights are owned and parented by the external
   * orchestrator, so this method does not add anything to `parent`.
   */
  attachToScene(camera: Camera, renderer: WebGLRenderer): void {
    if (this._initialized) return;
    // Upstream `setup(builder)` guards re-init via `this.camera === null`,
    // so calling `_init` here will be idempotent with the framework's
    // own lazy invocation later.
    this._init({ camera, renderer });
    this._initialized = true;
  }

  /**
   * Replace upstream's `LwLight` with real `DirectionalLight` so WebGL
   * recognizes it. Reuses cascade lights / cascade ranges supplied via
   * {@link useSharedCascade}; cascade positioning, shadow camera bounds,
   * and `cascades`/`splits` math are owned by the external orchestrator
   * and not duplicated here. {@link useSharedCascade} must have been
   * called first.
   * Ref: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/csm/CSMShadowNode.js#L158
   */
  _init(builder: { camera: Camera; renderer: WebGLRenderer }): void {
    if (this.camera !== null) return;
    if (this._externalLights === null || this._externalCascades === null) {
      throw new Error(
        "CSMShadowNodeForWebGL._init: useSharedCascade() must be called before _init runs.",
      );
    }
    this.camera = builder.camera;
    const data = {
      webGL: builder.renderer.coordinateSystem === WebGLCoordinateSystem,
    };
    this.mainFrustum = new CSMFrustum(data);

    for (let i = 0; i < this.cascades; ++i) {
      const cascadeLight = this._externalLights[i];
      this.lights.push(cascadeLight);
      // Each cascade `shadow()` produces a TSL ShadowNode whose
      // `setupRenderTarget` is patched by WebGLNodesHandler to read
      // `cascadeLight.shadow.map.depthTexture` — populated by
      // WebGLShadowMap because the cascade light is a real
      // DirectionalLight with castShadow=true.
      this._shadowNodes.push(shadow(cascadeLight, cascadeLight.shadow));
      // Push the same Vector2 instance the external orchestrator owns
      // and mutates in-place each frame. `UniformArrayNode` reads
      // `.x` / `.y` per render, so as long as the underlying object is
      // shared, the external mutation propagates automatically. This
      // requires that `csm.updateFrusta()` has run before construction
      // so the entries exist (sunLight.ts handles this).
      this._cascades.push(this._externalCascades[i]);
    }
  }
}

/**
 * Set `light.shadow.shadowNode` so `AnalyticLightNode.setupShadow` wires
 * the given node into the lighting graph at material build time. The
 * value can be any TSL `Node` that produces a vec4 — typically a
 * `CSMShadowNode` for cascaded shadow, or a constant `vec4(1)` to
 * suppress shadow processing on a light that should not contribute.
 *
 * `light.shadow.shadowNode` is typed via `@types/three`'s module
 * augmentation in `nodes/lighting/AnalyticLightNode.d.ts`, so no cast
 * is required.
 */
export function attachShadowNodeToLight(
  light: DirectionalLight,
  shadowNode: Node,
): void {
  light.shadow.shadowNode = shadowNode;
}
