import { EventHandler } from "@navara/core";
import {
  CascadedShadowMaps,
  CSMHelper,
  CSMShadowNodeForWebGL,
  attachShadowNodeToLight,
} from "@navara/three_csm";
import { SunDirectionalLight } from "@takram/three-atmosphere";
import {
  Color,
  Texture,
  Vector3,
  Material,
  PerspectiveCamera,
  WebGLRenderer,
} from "three";
import { vec4 } from "three/tsl";
import { NodeMaterial } from "three/webgpu";

export type SunLightEvents = {
  needsUpdate: () => void;
  _csmChanged: () => void;
};

export type ShadowMode = "uniform" | "logarithmic" | "practical";

export type SunLightOptions = {
  /**
   * Distance of the sun light from the target position.
   * @default 300
   */
  distance?: number;
  /**
   * Color of the sun light.
   * @default new Color(0xffffff)
   */
  color?: Color;
  /**
   * Whether to apply the color directly or use atmospheric scattering calculations.
   * @default false
   */
  applyColor?: boolean;
  /**
   * Intensity of the sun light.
   * @default 1
   */
  intensity?: number;
  /**
   * Whether to cast shadows using Cascaded Shadow Maps (CSM).
   * @default true
   */
  castShadow?: boolean;
  /**
   * Number of shadow cascades. More cascades provide better shadow quality
   * distribution but require more GPU resources.
   * @default 4
   */
  shadowCascadeCount?: number;
  /**
   * Resolution of shadow maps (one per cascade). Higher values provide better
   * shadow quality but require more GPU memory.
   * @default 2048
   */
  shadowMapSize?: number;
  /**
   * Maximum distance from the camera where shadows are rendered.
   * Shadows will not be visible farther than this distance.
   * @default 50000
   */
  shadowFar?: number;
  /**
   * Defines the split scheme for the camera frustum:
   * - "uniform": Linear split distribution
   * - "logarithmic": Logarithmic split distribution (better for large scenes)
   * - "practical": Hybrid approach balancing quality and performance (recommended)
   * @default "practical"
   */
  shadowMode?: ShadowMode;
  /**
   * Lambda parameter for "practical" split mode. Controls the blend between
   * uniform (0.0) and logarithmic (1.0) split schemes.
   * @default 0.8
   */
  shadowLambda?: number;
  /**
   * Defines how far the shadow camera is positioned behind the cascade frustum.
   * Larger values help prevent shadow clipping but may reduce precision.
   * @default 5000
   */
  shadowMargin?: number;
  /**
   * Enables smooth transitions between shadow cascades to reduce visible seams.
   * @default true
   */
  shadowFade?: boolean;
  /**
   * Intensity of the shadows (0 = no shadows, 1 = full shadows).
   * @default 1
   */
  shadowIntensity?: number;
  /**
   * Shadow map bias to reduce shadow acne. Similar to THREE.LightShadow.bias.
   * @default 0.0001
   */
  shadowBias?: number;
  /**
   * Normal-based shadow bias to reduce shadow acne on surfaces at glancing angles.
   * @default 0
   */
  shadowNormalBias?: number;
  /**
   * Whether to show debug visualization of shadow cascades.
   * @default false
   */
  debugCSMHelper?: boolean;
};

const DEFAULT_SUN_LIGHT_OPTIONS: Required<SunLightOptions> = {
  distance: 300,
  color: new Color(0xffffff),
  applyColor: false,
  intensity: 1,
  castShadow: true,
  shadowMapSize: 2048,
  shadowCascadeCount: 4,
  shadowFar: 5e4,
  shadowMode: "practical",
  shadowLambda: 0.8,
  shadowMargin: 5000,
  shadowFade: true,
  shadowIntensity: 1,
  shadowBias: 0.0001,
  shadowNormalBias: 0,
  debugCSMHelper: false,
};

export class SunLight extends EventHandler<SunLightEvents> {
  raw: SunDirectionalLight;
  private transmittanceTexture: Texture | null = null;
  private options: SunLightOptions;

  // CSM integration properties
  private csm!: CascadedShadowMaps;
  private csmHelper: CSMHelper | null = null;
  private camera: PerspectiveCamera;

  // TSL CSM — drives shadows for NodeMaterial meshes. Runs alongside the
  // legacy `csm` above which still serves the GLSL `onBeforeCompile` path
  // for materials that have not yet been migrated to NodeMaterial.
  // Both render their own cascade depth maps each frame (2× cost) during
  // the migration period; one will be retired once every mesh is on TSL.
  private csmNode: CSMShadowNodeForWebGL | null = null;

  constructor(camera: PerspectiveCamera, options: SunLightOptions = {}) {
    super();

    this.camera = camera;
    this.options = { ...DEFAULT_SUN_LIGHT_OPTIONS, ...options };

    this.raw = new SunDirectionalLight({
      distance: this.options.distance,
    });

    this.initializeCSM();

    this.raw.intensity = this.intensity;
    this.raw.color.copy(this.color);

    this.castShadow = !!this.options.castShadow;
  }

  updateSunDirection(sunDirection: Vector3) {
    this.raw.sunDirection.copy(sunDirection);
  }

  updateTargetPosition(position: Vector3) {
    if (this.applyColor) {
      return;
    }
    this.raw.target.position.copy(position);
  }

  update() {
    this.raw.update();

    // Sync CSM light direction with sun direction
    if (this.castShadow) {
      this.csm.directionalLights.direction.copy(this.raw.sunDirection.negate());

      if (!this.applyColor) {
        // Sync sun light color calculated dynamically.
        this.csm.color = this.color;
      }
    }

    // Update CSM if enabled
    this.updateCSM();

    this.raw.updateMatrixWorld(true);
    this.raw.target.updateMatrixWorld(true);
  }

  setTransmittanceTexture(texture: Texture) {
    this.transmittanceTexture = texture;
    this.raw.transmittanceTexture = texture;
  }

  clearTransmittanceTexture() {
    this.raw.transmittanceTexture = null;
  }

  // Private CSM Lifecycle Methods

  /**
   * Initialize CSM with current options
   */
  private initializeCSM(): void {
    if (!this.camera) {
      return;
    }

    this.csm = new CascadedShadowMaps(this.camera, {
      cascadeCount: this.options.shadowCascadeCount,
      mapSize: this.options.shadowMapSize,
      far: this.options.shadowFar,
      mode: this.options.shadowMode,
      lambda: this.options.shadowLambda,
      margin: this.options.shadowMargin,
      fade: this.options.shadowFade,
    });

    // Set light direction to match sun direction
    this.csm.directionalLights.direction.copy(this.raw.sunDirection);

    // Set light properties to match current sun light
    this.csm.intensity =
      this.options.intensity ?? DEFAULT_SUN_LIGHT_OPTIONS.intensity;
    this.csm.shadowIntensity =
      this.options.shadowIntensity ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowIntensity;
    this.csm.color.copy(this.options.color ?? DEFAULT_SUN_LIGHT_OPTIONS.color);

    // Setup CSM helper for debug visualization
    if (this.options.debugCSMHelper) {
      this.csmHelper = new CSMHelper(this.csm);
    }

    // Eagerly populate cascade ranges. `CascadedShadowMaps` allocates the
    // `Vector2` entries in `cascades[]` lazily on its first `update()`,
    // but the TSL graph (which shares this array by reference, below)
    // builds during the first render pass and `UniformArrayNode.update`
    // reads `cascades[i].x` / `.y` at setup time. If the array were still
    // empty at that point we'd dereference `undefined.x` and crash.
    this.csm.updateFrusta();

    // Construct the TSL CSM and share legacy CSM's cascade lights with
    // it. Sharing keeps the total shadow-map count at the cascade count
    // (instead of doubling under WebGL's tight MAX_TEXTURE_IMAGE_UNITS=16
    // budget), and the TSL graph reads cascade boundaries through the
    // same `Vector2[]` that `CascadedShadowMaps.update()` mutates each
    // frame. Anchor `csmNode` on `cascadedLights[0]` (which IS in the
    // scene with an up-to-date `matrixWorld`) rather than on `this.raw`,
    // which `getSceneLights` excludes from the scene when castShadow is
    // enabled.
    const cascadeLights = this.csm.directionalLights.cascadedLights;
    this.csmNode = new CSMShadowNodeForWebGL(cascadeLights[0], {
      cascades: this.options.shadowCascadeCount,
      maxFar: this.options.shadowFar,
      mode: this.options.shadowMode,
      lightMargin: this.options.shadowMargin,
    });
    this.csmNode.fade = this.options.shadowFade ?? true;
    this.csmNode.useSharedCascade(cascadeLights, this.csm.cascades);
    attachShadowNodeToLight(cascadeLights[0], this.csmNode);

    // Cascade clones `[1..N-1]` are shadow-only casters. Zero their
    // intensity (so TSL's `AnalyticLightNode` doesn't accumulate N×
    // direct light), and attach a `vec4(1)` no-op shadowNode (so it
    // doesn't construct a default `ShadowNode` whose extra samplers
    // bloat the TSL fragment shader's texture-unit count).
    for (let i = 1; i < cascadeLights.length; ++i) {
      cascadeLights[i].intensity = 0;
      attachShadowNodeToLight(cascadeLights[i], vec4(1));
    }
  }

  /**
   * Eagerly init the TSL CSM so its `_shadowNodes` are populated before TSL
   * graph compilation reads them. Cascade lights are owned by
   * `CascadedDirectionalLights` (added to the scene via
   * `SunLightDesc.updateSceneLights`), so this call does not parent any
   * objects itself. Idempotent — `CSMShadowNodeForWebGL.attachToScene`
   * self-guards.
   */
  attachToScene(renderer: WebGLRenderer): void {
    this.csmNode?.attachToScene(this.camera, renderer);
  }

  /**
   * Update CSM (call this in render loop)
   */
  private updateCSM(): void {
    // Update CSM
    this.csm.update();

    // Update helper if visible
    if (this.csmHelper) {
      this.csmHelper.update();
    }
  }

  // CSM Integration Methods

  /**
   * Set the camera for CSM calculations
   */
  setCamera(camera: PerspectiveCamera): void {
    this.camera = camera;
  }

  /**
   * Setup a material for CSM.
   *
   * For legacy `Material` (e.g. `MeshLambertMaterial` with custom
   * `onBeforeCompile`), the GLSL injection path is applied. For
   * `NodeMaterial` (TSL), the shadow is driven by
   * `light.shadow.shadowNode = csmNode` set up during construction —
   * `AnalyticLightNode.setupShadow` picks it up automatically at material
   * build time, so this method is a no-op for that path.
   */
  setupMaterialForCSM(material: Material): void {
    if (material instanceof NodeMaterial) return;
    this.csm.setupMaterial(material);
  }

  /**
   * Remove a material from CSM.
   *
   * NodeMaterials had nothing registered in `setupMaterialForCSM`, so
   * removal is also a no-op for them.
   */
  removeMaterialFromCSM(material: Material): void {
    if (material instanceof NodeMaterial) return;
    this.csm.rollbackMaterial(material);
  }

  /**
   * Get CSM instance for advanced usage
   */
  getCSM(): CascadedShadowMaps {
    return this.csm;
  }

  /**
   * Get CSM helper for debug visualization
   */
  getCSMHelper(): CSMHelper | null {
    return this.csmHelper;
  }

  /**
   * Get the lights that should be added to the scene
   * Returns CSM lights if enabled, otherwise the standard sun light
   */
  getSceneLights() {
    if (this.castShadow) {
      return this.csm.directionalLights;
    }
    return this.raw;
  }

  /**
   * Get the helper that should be added to the scene for debug visualization
   */
  getSceneHelper() {
    return this.csmHelper;
  }

  get visible() {
    return this.raw.visible;
  }
  set visible(v: boolean) {
    this.raw.visible = v;
    this.csm.directionalLights.visible = v;
    this.emit("needsUpdate");
  }

  get intensity() {
    return this.raw.intensity;
  }
  set intensity(v: number) {
    this.raw.intensity = v;
    this.csm.intensity = this.intensity;
    this.emit("needsUpdate");
  }

  get shadowIntensity() {
    return this.csm.shadowIntensity;
  }
  set shadowIntensity(v: number) {
    this.csm.shadowIntensity = v;
    this.emit("needsUpdate");
  }

  get color() {
    return this.raw.color;
  }
  set color(v: Color) {
    this.options.color = v;
    this.raw.color.copy(v);
    this.csm.color.copy(this.color);
    this.emit("needsUpdate");
  }

  get applyColor() {
    return this.options.applyColor ?? DEFAULT_SUN_LIGHT_OPTIONS.applyColor;
  }
  set applyColor(v: boolean) {
    this.options.applyColor = v;
    this.raw.transmittanceTexture = v ? null : this.transmittanceTexture;
    if (v) {
      this.color = this.options.color ?? DEFAULT_SUN_LIGHT_OPTIONS.color;
    }
    this.emit("needsUpdate");
  }

  get target() {
    return this.raw.target;
  }

  get castShadow() {
    return !!this.options.castShadow;
  }
  set castShadow(v: boolean) {
    this.options.castShadow = v;
    // No need to set `this.raw.castShadow = v` here — `this.raw` is not in
    // the scene tree when castShadow is enabled (see `getSceneLights`),
    // and the TSL CSM `shadowNode` is attached to `cascadedLights[0]`
    // (the cascade light that actually drives illumination in scene).
    this.emit("_csmChanged");
    this.emit("needsUpdate");
  }

  get shadowMapSize() {
    return (
      this.options.shadowMapSize ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowMapSize
    );
  }
  set shadowMapSize(v: number) {
    this.options.shadowMapSize = v;
    this.csm.mapSize = v;

    this.emit("needsUpdate");
  }

  get shadowFar() {
    return this.options.shadowFar ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowFar;
  }
  set shadowFar(v: number) {
    this.options.shadowFar = v;
    this.csm.far = v;
    if (this.csmNode) {
      this.csmNode.maxFar = v;
      this.csmNode.updateFrustums();
    }

    this.emit("needsUpdate");
  }

  get shadowCascadeCount() {
    return (
      this.options.shadowCascadeCount ??
      DEFAULT_SUN_LIGHT_OPTIONS.shadowCascadeCount
    );
  }
  set shadowCascadeCount(v: number) {
    this.options.shadowCascadeCount = v;
    this.csm.cascadeCount = v;
    // TSL CSM cascade count is fixed at construction (the internal
    // `_shadowNodes` / `_cascades` arrays are built once in `_init`).
    // TODO: support dynamic cascade count by disposing + recreating csmNode.

    this.emit("needsUpdate");
  }
  get shadowMode() {
    return this.options.shadowMode ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowMode;
  }
  set shadowMode(v: ShadowMode) {
    this.options.shadowMode = v;
    this.csm.mode = v;
    if (this.csmNode) {
      this.csmNode.mode = v;
      this.csmNode.updateFrustums();
    }

    this.emit("needsUpdate");
  }
  get shadowLambda() {
    return this.options.shadowLambda ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowLambda;
  }
  set shadowLambda(v: number) {
    this.options.shadowLambda = v;
    this.csm.lambda = v;
    // Upstream `CSMShadowNode` hardcodes the practical-split lambda to 0.5
    // (no public setter). Custom split via `customSplitsCallback` is the
    // available override path. For now this setter only updates the legacy
    // CSM; the TSL CSM stays at lambda=0.5 for practical mode.

    this.emit("needsUpdate");
  }
  get shadowMargin() {
    return this.options.shadowMargin ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowMargin;
  }
  set shadowMargin(v: number) {
    this.options.shadowMargin = v;
    this.csm.margin = v;
    if (this.csmNode) {
      this.csmNode.lightMargin = v;
      this.csmNode.updateFrustums();
    }

    this.emit("needsUpdate");
  }
  get shadowFade() {
    return this.options.shadowFade ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowFade;
  }
  set shadowFade(v: boolean) {
    this.options.shadowFade = v;
    this.csm.fade = v;
    if (this.csmNode) {
      this.csmNode.fade = v;
    }

    this.emit("needsUpdate");
  }
  get shadowBias() {
    return this.options.shadowBias ?? DEFAULT_SUN_LIGHT_OPTIONS.shadowBias;
  }
  set shadowBias(v: number) {
    this.options.shadowBias = v;
    this.csm.bias = v;

    this.emit("needsUpdate");
  }
  get shadowNormalBias() {
    return (
      this.options.shadowNormalBias ??
      DEFAULT_SUN_LIGHT_OPTIONS.shadowNormalBias
    );
  }
  set shadowNormalBias(v: number) {
    this.options.shadowNormalBias = v;
    this.csm.normalBias = v;

    this.emit("needsUpdate");
  }
  get debugCSMHelper() {
    return (
      this.options.debugCSMHelper ?? DEFAULT_SUN_LIGHT_OPTIONS.debugCSMHelper
    );
  }
  set debugCSMHelper(v: boolean) {
    this.options.debugCSMHelper = v;

    this.emit("needsUpdate");
  }
}
