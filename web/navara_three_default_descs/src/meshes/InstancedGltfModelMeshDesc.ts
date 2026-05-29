import type ThreeView from "@navara/three";
import {
  Color,
  MeshDescBase,
  PickableMultiInstancedNodeMaterialWrapper,
  encodePositionRTE,
  type MeshDescBaseConfig,
  type MeshDescBaseUpdate,
  type ViewContext,
} from "@navara/three";
import {
  AnimationAction,
  AnimationMixer,
  BufferGeometry,
  Cache,
  Color as ThreeColor,
  Euler,
  Group,
  InstancedMesh,
  LoopOnce,
  LoopRepeat,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SkinnedMesh,
  Texture,
  Vector3,
  type NormalBufferAttributes,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { uniform } from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import invariant from "tiny-invariant";

import { applyRTEToNodeMaterial, convertToNodeMaterial } from "../nodes";

/**
 * Per-instance configuration for a single model instance.
 * Represents one full model; the transform is applied to every sub-mesh of that instance.
 */
export type ModelChildConfig = {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  matrix?: Matrix4;
  /** Per-instance tint multiplied into the material color. */
  color?: Color;
};

export type InstancedModelsDescription = {
  url: string;
  castShadow?: boolean;
  receiveShadow?: boolean;

  /** Emissive color written to the MRT emissive slot (shared across all instances). */
  emissiveColor?: Color;
  /** Multiplier on the emissive color (default 0 = no emission). */
  emissiveIntensity?: number;
  /** Opacity of the material (0–1). */
  opacity?: number;
  /** Enable alpha blending when true. */
  transparent?: boolean;

  /** Animation clip name to play (shared across all instances). */
  animationActiveClip?: string;
  /** Playback speed (default 1). Shared across all instances. */
  animationSpeed?: number;
  /** Whether the clip loops (default true). */
  animationLoop?: boolean;
  /** Auto-start the configured clip on load (default false). */
  animationAutoPlay?: boolean;

  children?: ModelChildConfig[];
};

type Description = {
  gltfModels?: InstancedModelsDescription;
};

type DescriptionUpdate = {
  gltfModels?: Partial<InstancedModelsDescription>;
};

export type InstancedGltfModelMeshConfig = MeshDescBaseConfig & Description;

export type InstancedGltfModelMeshUpdate = MeshDescBaseUpdate &
  DescriptionUpdate;

export type InstancedGltfModelEvent = {
  load: () => void;
  needsUpdate: () => void;
};

const DEFAULT_CAPACITY = 64;
const GROWTH_FACTOR = 2;

const TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "metalnessMap",
  "roughnessMap",
  "emissiveMap",
  "aoMap",
] as const;

function hasMissingTextureData(gltf: GLTF): boolean {
  let missing = false;
  gltf.scene.traverse((o) => {
    if (missing) return;
    const mats = (o as Mesh).material;
    if (!mats) return;
    const list = Array.isArray(mats) ? mats : [mats];
    for (const mat of list) {
      const slots = mat as unknown as Record<
        string,
        Texture | null | undefined
      >;
      for (const slot of TEXTURE_SLOTS) {
        const tex = slots[slot];
        if (tex && tex.source && tex.source.data == null) {
          missing = true;
          return;
        }
      }
    }
  });
  return missing;
}

const _position = new Vector3();
const _quaternion = new Quaternion();
const _scale = new Vector3();
const _euler = new Euler();
const _T = new Matrix4();
const _composed = new Matrix4();
const _tempColor = new ThreeColor();

/**
 * An animation "slot" — one mixer, its cached actions, and the currently
 * playing one. Non-skinned path has a single slot driving the source scene;
 * skinned path has one slot per cloned instance.
 */
type Anim = {
  mixer: AnimationMixer;
  actions: Map<string, AnimationAction>;
  currentAction: AnimationAction | null;
};

/**
 * Instanced GLTF model descriptor.
 *
 * Loads a GLTF once, then fans out every `Mesh` node into a sibling
 * `InstancedMesh` sharing one per-instance matrix slot per model instance.
 *
 * Two internal paths are selected based on the model contents:
 *
 * - **Non-skinned path (instanced):** every `Mesh` node becomes an
 *   `InstancedMesh`. All instances share one `AnimationMixer` running on the
 *   source scene; per-frame, we re-sample each source mesh's `matrixWorld` and
 *   rewrite every instance's matrix as `T_i * sourceLocal_s`. Node-TRS and
 *   morph-target animations both play back correctly.
 * - **Skinned path (per-instance clone fallback):** because three.js's core
 *   `InstancedMesh` cannot apply skinning, skinned GLTFs fall back to one
 *   `SkeletonUtils.clone` per instance, each with its own `AnimationMixer`.
 *   This gives up instanced rendering for the skinned parts, but keeps the
 *   same desc API and plays shared clips in lockstep across clones.
 *
 * Limitations:
 * - Skinned-path picking is currently unsupported (`batchIds` is empty).
 */
export class InstancedGltfModelMeshDesc extends MeshDescBase<
  InstancedGltfModelMeshConfig,
  InstancedGltfModelMeshUpdate,
  Group,
  InstancedGltfModelEvent
> {
  private config: InstancedGltfModelMeshConfig;
  private loader = new GLTFLoader();
  private gltf: GLTF | null = null;

  // Non-skinned (instanced) path
  private subMeshes: {
    inst: InstancedMesh;
    sourceMesh: Mesh;
    sourceLocal: Matrix4;
  }[] = [];
  private capacity = 0;

  // Skinned fallback path: one cloned scene per instance, parallel to `anims`.
  private hasSkinned = false;
  private skinnedScenes: Object3D[] = [];

  // Animation slots. Non-skinned: 0 or 1 entry driving gltf.scene.
  // Skinned: one per cloned instance, parallel to `skinnedScenes`.
  private anims: Anim[] = [];

  // Shared
  private configs: ModelChildConfig[] = [];
  private lastUpdateTime?: number;

  private pickWrapper?: PickableMultiInstancedNodeMaterialWrapper;

  // RTE (Relative-To-Eye) state encoded as TSL uniforms.
  // `raw.matrixWorld` carries rotation+scale only; the anchor translation is
  // encoded into `_rtePosHigh`/`_rtePosLow` uniforms consumed by
  // `applyRTEToNodeMaterial` on each material. TSL `renderGroup` uniforms in
  // `highPrecisionNode.ts` update camera state once per render call automatically,
  // so no per-frame `onBeforeRender` callback is needed.
  private readonly _rtePosHigh = uniform(new Vector3());
  private readonly _rtePosLow = uniform(new Vector3());
  // R⁻¹×ecefPos for castShadowPositionNode (f32 approx. — see TODO in applyRTEToNodeMaterial).
  private readonly _localOriginOffset = uniform(new Vector3());
  // Full-precision ECEF anchor, kept as f64 JS value for onBeforeShadow patching.
  // WebGL ignores castShadowPositionNode, so the shadow pass must receive the
  // real world position via modelViewMatrix (same trick as GLTFModelDesc).
  private readonly _originalWorldPosition = new Vector3();

  constructor(
    view: ThreeView,
    ctx: ViewContext,
    config: InstancedGltfModelMeshConfig,
  ) {
    super(view, ctx, config);
    this.config = config;

    const cfg = config.gltfModels;
    if (cfg?.emissiveColor !== undefined) this.emissive = cfg.emissiveColor;
    if (cfg?.emissiveIntensity !== undefined)
      this.emissiveIntensity = cfg.emissiveIntensity;
  }

  get batchIds(): readonly number[] {
    return this.pickWrapper?.batchIds ?? [];
  }

  get count(): number {
    return this.configs.length;
  }

  /** Names of animation clips found in the GLTF. Available after `load`. */
  get animationClips(): readonly string[] {
    return this.gltf ? this.gltf.animations.map((c) => c.name) : [];
  }

  createMesh(): Group {
    const root = new Group();
    const cfg = this.config.gltfModels;

    if (cfg?.url) {
      this.loadModel(cfg.url, root).catch((err) => {
        console.error("Failed to load instanced GLTF model:", err);
      });
    }
    return root;
  }

  override onCreate(): void {
    super.onCreate();
    // MeshDescBase.applyTransform has just populated `raw.matrixWorld` from the
    // user-supplied `matrixWorld` (and any local TRS). Decompose it so the
    // anchor translation lives in RTE uniforms instead of the world matrix.
    this.captureAnchorFromMatrixWorld();
  }

  /**
   * Pulls the translation out of `raw.matrixWorld` into RTE uniforms, and
   * rebuilds `raw.matrixWorld` with rotation+scale only. Safe to call again
   * after the user updates `matrixWorld`.
   */
  private captureAnchorFromMatrixWorld(): void {
    if (!this.raw) return;

    // `MeshDescBase.applyTransform` only writes `raw.matrixWorld` directly when
    // the descriptor's `matrixWorld` is set. For the `matrix`-only and
    // local-TRS paths it leaves matrixWorld stale, so decomposing it would
    // pull an identity anchor on the first capture. Also, after our first
    // capture we disable `matrixAutoUpdate`/`matrixWorldAutoUpdate` below,
    // so we can't rely on three.js to recompute matrixWorld on subsequent
    // captures either — refresh it explicitly from the authoritative source.
    if (this.matrixWorld) {
      // applyTransform already populated raw.matrixWorld.
    } else if (this.matrix) {
      // applyTransform already populated raw.matrix (including any local TRS).
      this.raw.matrixWorld.copy(this.raw.matrix);
    } else {
      // Local-TRS only: applyTransform set raw.position/quaternion/scale.
      this.raw.matrix.compose(
        this.raw.position,
        this.raw.quaternion,
        this.raw.scale,
      );
      this.raw.matrixWorld.copy(this.raw.matrix);
    }

    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    this.raw.matrixWorld.decompose(p, q, s);

    this._originalWorldPosition.copy(p);
    encodePositionRTE(p, this._rtePosHigh.value, this._rtePosLow.value);

    // Compute R⁻¹×ecefPos in JS f64 → f32 uniform for castShadowPositionNode.
    const rotScale = new Matrix4().compose(new Vector3(), q, s);
    this._localOriginOffset.value.copy(p).applyMatrix4(rotScale.invert());

    // Rebuild matrixWorld with translation zeroed so the shader sees a
    // modelMatrix that only carries rotation+scale. The residual rotation+
    // scale still matters for orienting the whole group (e.g. NUE frame).
    this.raw.matrixAutoUpdate = false;
    this.raw.matrixWorldAutoUpdate = false;
    this.raw.matrixWorld.compose(new Vector3(0, 0, 0), q, s);
    this.raw.position.set(0, 0, 0);
    this.raw.quaternion.copy(q);
    this.raw.scale.copy(s);
  }

  /**
   * Patch `inst.onBeforeShadow` so WebGL shadow passes use the full ECEF
   * translation rather than the RTE-stripped matrixWorld.
   *
   * `castShadowPositionNode` (set by applyRTEToNodeMaterial) is ignored under
   * WebGL — the depth material shader uses `modelViewMatrix` directly.  We
   * mirror the GLTFModelDesc fix: compute `shadowCamera.matrixWorldInverse *
   * fullMatrix` in f64 JS and write it into `inst.modelViewMatrix` before each
   * shadow draw call.  The per-instance instanceMatrix is then applied by the
   * GPU shader on top of this base, placing every instance correctly.
   */
  private setupShadowDepth(inst: Mesh): void {
    const stripped = new Vector3();
    const fullMatrix = new Matrix4();
    inst.onBeforeShadow = (
      _renderer: unknown,
      _object: unknown,
      _camera: unknown,
      shadowCamera: { matrixWorldInverse: Matrix4 },
    ) => {
      if (!inst.castShadow) return;
      stripped.setFromMatrixPosition(inst.matrixWorld);
      fullMatrix.copy(inst.matrixWorld);
      fullMatrix.setPosition(
        this._originalWorldPosition.x + stripped.x,
        this._originalWorldPosition.y + stripped.y,
        this._originalWorldPosition.z + stripped.z,
      );
      inst.modelViewMatrix.multiplyMatrices(
        shadowCamera.matrixWorldInverse,
        fullMatrix,
      );
    };
  }

  /** Walk the root Group and collect all unique NodeMaterials from sub-meshes. */
  protected override extractNodeMaterial(): NodeMaterial[] {
    if (!this.raw) return [];
    const seen = new Set<NodeMaterial>();
    this.raw.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        if (m instanceof NodeMaterial && !seen.has(m)) seen.add(m);
      }
    });
    return [...seen];
  }

  /**
   * Wire MRT output struct (via super) + TSL RTE vertex nodes on a single
   * NodeMaterial. Called by {@link MeshDescBase.onCreate} and
   * {@link MeshDescBase.refreshNodeMaterial} whenever materials need rewiring.
   */
  protected override setupNodeMaterial(material: NodeMaterial): void {
    super.setupNodeMaterial(material);
    applyRTEToNodeMaterial(material, {
      rtePosHigh: this._rtePosHigh,
      rtePosLow: this._rtePosLow,
      localOriginOffset: this._localOriginOffset,
    });
  }

  /**
   * Convert every material in the scene graph to NodeMaterial and apply shadow
   * material setup. Used for the skinned fallback path where
   * `SkeletonUtils.clone` shares materials — patching the source scene once is
   * enough. MRT + RTE wiring happens later via {@link refreshNodeMaterial}.
   */
  private patchMaterials(root: Object3D): void {
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const original = mesh.material as Material | Material[];
      const list = Array.isArray(original) ? original : [original];
      const converted = list.map((m) => {
        if (m instanceof NodeMaterial) return m;
        const n = convertToNodeMaterial(m);
        m.dispose();
        return n;
      });
      mesh.material = Array.isArray(original) ? converted : converted[0];
      const modelCfg = this.config.gltfModels;
      for (const m of converted) {
        this.ctx.applyShadowMaterial(m);
        if (modelCfg?.opacity !== undefined) m.opacity = modelCfg.opacity;
        if (modelCfg?.transparent !== undefined) {
          m.transparent = modelCfg.transparent;
          m.needsUpdate = true;
        }
      }
    });
  }

  private async loadModel(url: string, root: Group): Promise<void> {
    let gltf = await this.loader.loadAsync(url);
    // three.js's `ImageBitmapLoader` caches the in-flight fetch promise but its
    // terminal `.then` does not return the resolved bitmap (three r184,
    // src/loaders/ImageBitmapLoader.js line 181). When a second
    // `GLTFLoader.loadAsync` for the same URL subscribes to that cached
    // promise, its callback receives `undefined`, so the resulting textures
    // have `source.data === null` and render solid black. Detect that and
    // reload with `three.Cache` briefly off — by then the first load has
    // populated its real bitmaps, so the retry isn't racing anyone.
    if (hasMissingTextureData(gltf)) {
      const wasEnabled = Cache.enabled;
      Cache.enabled = false;
      try {
        gltf = await this.loader.loadAsync(url);
      } finally {
        Cache.enabled = wasEnabled;
      }
    }
    this.gltf = gltf;

    // Detect skinned meshes — if any, we fall back to per-instance clones
    gltf.scene.traverse((c) => {
      if (c instanceof SkinnedMesh) this.hasSkinned = true;
    });

    gltf.scene.updateMatrixWorld(true);

    const initialConfigs = this.config.gltfModels?.children ?? [];

    if (this.hasSkinned) {
      this.initSkinnedPath(root, initialConfigs);
    } else {
      this.initInstancedPath(root, initialConfigs);
    }

    this.configs = [...initialConfigs];

    const cfg = this.config.gltfModels;
    if (cfg?.animationAutoPlay && cfg.animationActiveClip) {
      this.playAnimation(cfg.animationActiveClip);
    }

    this.emit("needsUpdate");
    this.emit("load");
  }

  // ---------- Animation (shared) ----------

  /** Build an Anim slot whose mixer drives `target`. */
  private createAnim(target: Object3D): Anim {
    invariant(this.gltf, "GLTF must be loaded before createAnim");
    const cfg = this.config.gltfModels;
    const speed = cfg?.animationSpeed ?? 1;
    const loop = cfg?.animationLoop ?? true;

    const mixer = new AnimationMixer(target);
    const actions = new Map<string, AnimationAction>();
    for (const clip of this.gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
      action.setEffectiveTimeScale(speed);
      action.setEffectiveWeight(0);
      action.enabled = true;
      actions.set(clip.name, action);
    }
    return { mixer, actions, currentAction: null };
  }

  private playOn(anim: Anim, name: string): void {
    const action = anim.actions.get(name);
    if (!action) return;
    if (anim.currentAction && anim.currentAction !== action) {
      anim.currentAction.stop();
    }
    action.reset();
    action.setEffectiveWeight(1);
    action.play();
    anim.currentAction = action;
  }

  private stopOn(anim: Anim): void {
    if (anim.currentAction) {
      anim.currentAction.stop();
      anim.currentAction = null;
    }
  }

  playAnimation(name: string): void {
    if (this.anims.length === 0) return;
    if (!this.hasSkinned && !this.anims[0].actions.has(name)) {
      console.warn(`Animation "${name}" not found`);
      return;
    }
    for (const a of this.anims) this.playOn(a, name);
  }

  stopAnimation(): void {
    for (const a of this.anims) this.stopOn(a);
  }

  // ---------- Non-skinned (instanced) path ----------

  private initInstancedPath(
    root: Group,
    initialConfigs: ModelChildConfig[],
  ): void {
    invariant(this.gltf, "GLTF must be loaded before initInstancedPath");
    const gltf = this.gltf;
    this.capacity = Math.max(initialConfigs.length, DEFAULT_CAPACITY);
    const modelCfg = this.config.gltfModels;

    // Walk scene, spin up one InstancedMesh per source Mesh node
    gltf.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const sourceMesh = node as Mesh<BufferGeometry<NormalBufferAttributes>>;

      const sourceLocal = sourceMesh.matrixWorld.clone();

      // Convert source materials to NodeMaterials for the TSL RTE pipeline.
      // Updating sourceMesh.material here is important so `grow()` reuses the
      // already-converted material via `inst.material`.
      const originalMaterial = sourceMesh.material as Material | Material[];
      const list = Array.isArray(originalMaterial)
        ? originalMaterial
        : [originalMaterial];
      const convertedList = list.map((m) => {
        if (m instanceof NodeMaterial) return m;
        const n = convertToNodeMaterial(m);
        m.dispose();
        return n;
      });
      const material = Array.isArray(originalMaterial)
        ? convertedList
        : convertedList[0];
      sourceMesh.material = material;

      const inst = new InstancedMesh(
        sourceMesh.geometry,
        material,
        this.capacity,
      );
      inst.count = initialConfigs.length;
      inst.frustumCulled = false;
      inst.castShadow = modelCfg?.castShadow ?? false;
      inst.receiveShadow = modelCfg?.receiveShadow ?? false;

      for (const m of convertedList) {
        this.ctx.applyShadowMaterial(m);
        if (modelCfg?.opacity !== undefined) m.opacity = modelCfg.opacity;
        if (modelCfg?.transparent !== undefined) {
          m.transparent = modelCfg.transparent;
          m.needsUpdate = true;
        }
      }

      this.setupShadowDepth(inst);

      // Pre-allocate instanceColor so the program is compiled once with
      // instancingColor=true from the start. Without this, the first updateAt()
      // call that sets a per-instance color lazily creates instanceColor, which
      // changes the program cache key and forces a recompilation of every
      // sub-mesh material — consuming 4 new WebGL UBO binding points per mesh
      // and exhausting the 24-slot global limit.
      inst.setColorAt(0, _tempColor.setRGB(1, 1, 1));

      root.add(inst);
      this.subMeshes.push({ inst, sourceMesh, sourceLocal });
    });

    for (let i = 0; i < initialConfigs.length; i++) {
      this.writeInstanceAt(i, initialConfigs[i]);
    }
    this.markAllInstancesDirty();

    if (gltf.animations.length > 0) {
      this.anims.push(this.createAnim(gltf.scene));
    }

    if (this.config.pickable) {
      const meshes = this.subMeshes.map((s) => s.inst);
      this.pickWrapper = new PickableMultiInstancedNodeMaterialWrapper(
        root,
        meshes,
        initialConfigs.length,
        this.ctx,
      );
      this.ctx.registerPickableMesh(this.id, this.pickWrapper);
      // Wire picking color — the setter also calls refreshNodeMaterial() to
      // apply MRT + RTE + wrappedColor across all sub-mesh materials.
      this.colorOutputNode = this.pickWrapper.wrapColor(this.colorOutputNode);
    } else {
      this.refreshNodeMaterial();
    }
  }

  private composeInstanceTransform(
    config: ModelChildConfig,
    out: Matrix4,
  ): void {
    if (config.matrix) {
      out.copy(config.matrix);
      return;
    }
    const pos = config.position;
    _position.set(pos?.x ?? 0, pos?.y ?? 0, pos?.z ?? 0);

    const rot = config.rotation;
    if (rot) {
      _euler.set(rot.x, rot.y, rot.z);
      _quaternion.setFromEuler(_euler);
    } else {
      _quaternion.identity();
    }

    const s = config.scale;
    _scale.set(s?.x ?? 1, s?.y ?? 1, s?.z ?? 1);

    out.compose(_position, _quaternion, _scale);
  }

  /** Apply a ModelChildConfig to an Object3D via compose/decompose. */
  private applyTransformToObject(
    obj: Object3D,
    config: ModelChildConfig,
  ): void {
    this.composeInstanceTransform(config, _T);
    _T.decompose(obj.position, obj.quaternion, obj.scale);
  }

  /** Write instance slot `i` into every sub-mesh as `T_i * sourceLocal_s`. */
  private writeInstanceAt(i: number, config: ModelChildConfig): void {
    this.composeInstanceTransform(config, _T);
    for (const { inst, sourceLocal } of this.subMeshes) {
      _composed.multiplyMatrices(_T, sourceLocal);
      inst.setMatrixAt(i, _composed);
    }
    this.writeColorAt(i, config);
  }

  /**
   * Set per-instance tint on every sub-mesh. Three.js's `setColorAt` lazily
   * allocates `instanceColor` (filled white) on first call, so omitting color
   * stays free until at least one instance opts in. Once `instanceColor`
   * exists, an unset color resets the slot to white so stale colors from a
   * prior occupant (after swap-with-last removal or replaceAll) don't leak.
   */
  private writeColorAt(i: number, config: ModelChildConfig): void {
    if (config.color) {
      _tempColor.set(config.color.raw);
    } else {
      _tempColor.setRGB(1, 1, 1);
    }
    for (const { inst } of this.subMeshes) {
      if (!config.color && !inst.instanceColor) continue;
      inst.setColorAt(i, _tempColor);
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Rewrite every instance's matrix for every sub-mesh using the
   * current per-frame `sourceMesh.matrixWorld` instead of the baked local.
   * Only needed when the mixer actually moves node TRS.
   */
  private resampleAndRewriteAll(): void {
    for (const { inst, sourceMesh } of this.subMeshes) {
      for (let i = 0; i < this.configs.length; i++) {
        this.composeInstanceTransform(this.configs[i], _T);
        _composed.multiplyMatrices(_T, sourceMesh.matrixWorld);
        inst.setMatrixAt(i, _composed);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  private markAllInstancesDirty(): void {
    for (const { inst } of this.subMeshes) {
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- Skinned fallback path ----------

  private initSkinnedPath(
    root: Group,
    initialConfigs: ModelChildConfig[],
  ): void {
    invariant(this.gltf, "GLTF must be loaded before initSkinnedPath");
    // SkeletonUtils.clone shares materials — patch the source scene once.
    this.patchMaterials(this.gltf.scene);

    for (const cfg of initialConfigs) {
      this.addSkinnedInstance(root, cfg);
    }

    if (this.config.pickable) {
      console.warn(
        "InstancedGltfModelMeshDesc: picking is not supported for skinned GLTFs (fallback clone path).",
      );
    }

    // Wire MRT + RTE on all patched materials now that clones are in the group.
    this.refreshNodeMaterial();
  }

  private addSkinnedInstance(root: Group, config: ModelChildConfig): void {
    invariant(this.gltf, "GLTF must be loaded before addSkinnedInstance");
    const scene = cloneSkinned(this.gltf.scene);
    this.applyTransformToObject(scene, config);

    const modelCfg = this.config.gltfModels;
    scene.traverse((o) => {
      if (o instanceof Mesh || o instanceof SkinnedMesh) {
        o.castShadow = modelCfg?.castShadow ?? false;
        o.receiveShadow = modelCfg?.receiveShadow ?? false;
        // RTE re-projects vertices in the shader, so the CPU-side bounding
        // sphere transformed by matrixWorld doesn't match rendered position.
        // Disable frustum culling to avoid false-positive culls.
        o.frustumCulled = false;
        this.setupShadowDepth(o);
      }
    });

    root.add(scene);
    this.skinnedScenes.push(scene);
    this.anims.push(this.createAnim(scene));
  }

  // ---------- Public instance API ----------

  /** Add a new instance. Returns its index. */
  add(config: ModelChildConfig): number {
    if (this.hasSkinned) {
      const root = this.raw;
      invariant(root, "Must be created before add()");
      this.addSkinnedInstance(root, config);
      this.configs.push(config);

      const activeClip = this.config.gltfModels?.animationActiveClip;
      if (activeClip) {
        this.playOn(this.anims[this.anims.length - 1], activeClip);
      }

      this.emit("needsUpdate");
      return this.configs.length - 1;
    }

    if (this.configs.length >= this.capacity) this.grow();
    const index = this.configs.length;
    this.configs.push(config);
    for (const { inst } of this.subMeshes) inst.count = this.configs.length;
    this.writeInstanceAt(index, config);
    this.markAllInstancesDirty();
    this.pickWrapper?.addInstance();
    this.emit("needsUpdate");
    return index;
  }

  removeAt(index: number): void {
    if (index < 0 || index >= this.configs.length) {
      throw new Error(`Index ${index} out of bounds`);
    }

    if (this.hasSkinned) {
      this.anims[index].mixer.stopAllAction();
      this.raw?.remove(this.skinnedScenes[index]);

      const last = this.configs.length - 1;
      if (index !== last) {
        this.anims[index] = this.anims[last];
        this.skinnedScenes[index] = this.skinnedScenes[last];
        this.configs[index] = this.configs[last];
      }
      this.anims.pop();
      this.skinnedScenes.pop();
      this.configs.pop();
      this.emit("needsUpdate");
      return;
    }

    const last = this.configs.length - 1;
    if (index !== last) {
      this.configs[index] = this.configs[last];
      this.writeInstanceAt(index, this.configs[index]);
    }
    this.configs.pop();
    for (const { inst } of this.subMeshes) inst.count = this.configs.length;
    this.markAllInstancesDirty();
    this.pickWrapper?.removeInstanceAt(index);
    this.emit("needsUpdate");
  }

  updateAt(index: number, config: Partial<ModelChildConfig>): void {
    if (index < 0 || index >= this.configs.length) {
      throw new Error(`Index ${index} out of bounds`);
    }
    const merged = { ...this.configs[index], ...config };
    this.configs[index] = merged;

    if (this.hasSkinned) {
      this.applyTransformToObject(this.skinnedScenes[index], merged);
    } else {
      this.writeInstanceAt(index, merged);
      this.markAllInstancesDirty();
    }
    this.emit("needsUpdate");
  }

  clear(): void {
    if (this.hasSkinned) {
      for (let i = 0; i < this.anims.length; i++) {
        this.anims[i].mixer.stopAllAction();
        this.raw?.remove(this.skinnedScenes[i]);
      }
      this.anims = [];
      this.skinnedScenes = [];
      this.configs = [];
      this.emit("needsUpdate");
      return;
    }

    this.configs = [];
    for (const { inst } of this.subMeshes) {
      inst.count = 0;
      inst.instanceMatrix.needsUpdate = true;
    }
    this.pickWrapper?.clearInstances();
    this.emit("needsUpdate");
  }

  replaceAll(configs: ModelChildConfig[]): void {
    if (this.hasSkinned) {
      this.clear();
      const root = this.raw;
      invariant(root, "Must be created before replaceAll()");
      for (const c of configs) this.addSkinnedInstance(root, c);
      this.configs = [...configs];

      const activeClip = this.config.gltfModels?.animationActiveClip;
      if (activeClip) this.playAnimation(activeClip);
      this.emit("needsUpdate");
      return;
    }

    while (configs.length > this.capacity) this.grow();
    this.configs = [...configs];
    for (const { inst } of this.subMeshes) inst.count = configs.length;
    for (let i = 0; i < configs.length; i++)
      this.writeInstanceAt(i, configs[i]);
    this.markAllInstancesDirty();
    this.pickWrapper?.replaceAll(configs.length);
    this.emit("needsUpdate");
  }

  private grow(): void {
    const newCapacity = Math.max(
      this.capacity * GROWTH_FACTOR,
      DEFAULT_CAPACITY,
    );
    const oldCount = this.configs.length;
    const root = this.raw;
    invariant(root, "Must be created before growing");

    const newSubs: typeof this.subMeshes = [];
    for (const { inst, sourceMesh, sourceLocal } of this.subMeshes) {
      const newInst = new InstancedMesh(
        inst.geometry,
        inst.material,
        newCapacity,
      );
      newInst.count = oldCount;
      newInst.frustumCulled = false;
      newInst.castShadow = inst.castShadow;
      newInst.receiveShadow = inst.receiveShadow;
      this.setupShadowDepth(newInst);

      const m = new Matrix4();
      for (let i = 0; i < oldCount; i++) {
        inst.getMatrixAt(i, m);
        newInst.setMatrixAt(i, m);
      }
      newInst.instanceMatrix.needsUpdate = true;

      if (inst.instanceColor) {
        for (let i = 0; i < oldCount; i++) {
          inst.getColorAt(i, _tempColor);
          newInst.setColorAt(i, _tempColor);
        }
        if (newInst.instanceColor) newInst.instanceColor.needsUpdate = true;
      }

      root.remove(inst);
      root.add(newInst);
      inst.dispose();

      newSubs.push({ inst: newInst, sourceMesh, sourceLocal });
    }
    this.subMeshes = newSubs;
    this.capacity = newCapacity;

    this.pickWrapper?.syncMeshes(this.subMeshes.map((s) => s.inst));
  }

  /** Copy morph-target influences from each source mesh to its sub-InstancedMesh. */
  private syncMorphTargets(): void {
    for (const { inst, sourceMesh } of this.subMeshes) {
      if (sourceMesh.morphTargetInfluences) {
        inst.morphTargetInfluences = sourceMesh.morphTargetInfluences;
        inst.morphTargetDictionary = sourceMesh.morphTargetDictionary;
      }
    }
  }

  update(time: number): void {
    if (this.lastUpdateTime === undefined) {
      this.lastUpdateTime = time;
      return;
    }
    const delta = (time - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = time;

    if (this.anims.length === 0) return;

    // Only step mixers and force renders when an action is actually playing.
    // A loaded-but-idle GLTF (clips present, currentAction null) would
    // otherwise keep the render loop running every frame.
    const active = this.anims.some((a) => a.currentAction);
    if (!active) return;

    for (const a of this.anims) a.mixer.update(delta);

    if (!this.hasSkinned) {
      this.gltf?.scene.updateMatrixWorld(true);
      this.resampleAndRewriteAll();
      this.syncMorphTargets();
    }

    this.emit("needsUpdate");
  }

  onUpdateConfig(updates: InstancedGltfModelMeshUpdate): void {
    if (updates.gltfModels !== undefined) {
      const u = updates.gltfModels;

      const meshPropChanged =
        u.castShadow !== undefined ||
        u.receiveShadow !== undefined ||
        u.opacity !== undefined ||
        u.transparent !== undefined;
      if (meshPropChanged) {
        if (this.hasSkinned) {
          for (const scene of this.skinnedScenes) {
            scene.traverse((o) => {
              const mesh = o as Mesh;
              if (!mesh.isMesh) return;
              if (u.castShadow !== undefined) mesh.castShadow = u.castShadow;
              if (u.receiveShadow !== undefined)
                mesh.receiveShadow = u.receiveShadow;
              if (u.opacity !== undefined || u.transparent !== undefined) {
                const mats = Array.isArray(mesh.material)
                  ? mesh.material
                  : [mesh.material];
                for (const m of mats as Material[]) {
                  if (u.opacity !== undefined) m.opacity = u.opacity;
                  if (u.transparent !== undefined)
                    m.transparent = u.transparent;
                  m.needsUpdate = true;
                }
              }
            });
          }
        } else {
          for (const { inst } of this.subMeshes) {
            if (u.castShadow !== undefined) inst.castShadow = u.castShadow;
            if (u.receiveShadow !== undefined)
              inst.receiveShadow = u.receiveShadow;
            if (u.opacity !== undefined || u.transparent !== undefined) {
              const mats = Array.isArray(inst.material)
                ? inst.material
                : [inst.material];
              for (const m of mats as Material[]) {
                if (u.opacity !== undefined) m.opacity = u.opacity;
                if (u.transparent !== undefined) m.transparent = u.transparent;
                m.needsUpdate = true;
              }
            }
          }
        }
      }

      if (u.emissiveColor !== undefined) {
        this.emissive = u.emissiveColor;
      }
      if (u.emissiveIntensity !== undefined) {
        this.emissiveIntensity = u.emissiveIntensity;
      }

      if (u.animationSpeed !== undefined) {
        for (const anim of this.anims) {
          for (const a of anim.actions.values())
            a.setEffectiveTimeScale(u.animationSpeed);
        }
      }
      if (u.animationLoop !== undefined) {
        const mode = u.animationLoop ? LoopRepeat : LoopOnce;
        for (const anim of this.anims) {
          for (const a of anim.actions.values()) a.setLoop(mode, Infinity);
        }
      }
      if (u.animationActiveClip !== undefined) {
        this.playAnimation(u.animationActiveClip);
      }

      if (u.children !== undefined) {
        this.replaceAll(u.children);
      }

      this.config.gltfModels = {
        ...this.config.gltfModels,
        ...u,
      } as InstancedModelsDescription;
    }

    const spatialChanged =
      updates.matrix !== undefined ||
      updates.matrixWorld !== undefined ||
      updates.position !== undefined ||
      updates.scale !== undefined ||
      updates.rotation !== undefined;

    super.onUpdateConfig(updates);

    if (spatialChanged) {
      // Re-extract anchor from the freshly-applied raw.matrixWorld
      this.captureAnchorFromMatrixWorld();
    }
  }

  override onDestroy(): void {
    if (this.pickWrapper) {
      this.ctx.unregisterPickableMesh(this.id);
      this.pickWrapper = undefined;
    }

    for (const anim of this.anims) {
      anim.mixer.stopAllAction();
      anim.actions.clear();
    }
    this.anims = [];
    this.skinnedScenes = [];

    for (const { inst } of this.subMeshes) {
      const mats = Array.isArray(inst.material)
        ? inst.material
        : [inst.material];
      for (const m of mats) this.ctx.removeShadowMaterial(m as Material);
    }

    if (this.raw) {
      this.raw.traverse((o) => {
        if (o instanceof InstancedMesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) (m as Material).dispose();
          o.dispose();
        }
      });
    }

    if (this.hasSkinned && this.gltf) {
      // SkeletonUtils.clone shares geometries and materials with the source
      // gltf.scene, so dispose them from the source once — disposing on each
      // clone would double-dispose. removeShadowMaterial mirrors the one-time
      // registration done by patchMaterials on the source scene.
      this.gltf.scene.traverse((o) => {
        const mesh = o as Mesh;
        const m = mesh.material as Material | Material[] | undefined;
        if (m) {
          const mats = Array.isArray(m) ? m : [m];
          for (const mat of mats) {
            this.ctx.removeShadowMaterial(mat);
            mat.dispose();
          }
        }
        mesh.geometry?.dispose();
      });
    }

    this.subMeshes = [];
    this.configs = [];

    super.onDestroy();
  }
}
