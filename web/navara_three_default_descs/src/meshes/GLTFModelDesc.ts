import type ThreeView from "@navara/three";
import {
  Color,
  NewMeshDesc,
  encodePositionRTE,
  composeWorldMatrixForRTE,
  type MeshDescConfig,
  type MeshDescUpdate,
  type ViewContext,
} from "@navara/three";
import {
  Group,
  Matrix4,
  Mesh,
  AnimationMixer,
  AnimationAction,
  AnimationClip,
  LoopRepeat,
  LoopOnce,
  Material,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { uniform } from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { applyRTEToNodeMaterial, convertToNodeMaterial } from "../nodes";

type Description = {
  gltfModel?: {
    url?: string;
    castShadow?: boolean;
    receiveShadow?: boolean;

    // Declarative animation settings
    animationEnabled?: boolean;
    animationClips?: string[];
    animationActiveClip?: string;
    animationSpeed?: number; // default: 1.0
    animationLoop?: boolean; // default: true
    animationCrossfadeDuration?: number; // default: 0.3
    animationAutoPlay?: boolean; // default: false

    // MRT emissive uniforms — drive additive glow on top of the model's
    // own material emissive (e.g. for picking highlight).
    emissiveColor?: Color;
    emissiveIntensity?: number;
  };
};

export const DEFAULT_GLTF_MODEL_DESCRIPTION: NonNullable<
  Description["gltfModel"]
> = {
  url: "",
  animationSpeed: 1,
  animationLoop: true,
  animationCrossfadeDuration: 0.3,
};

export type GLTFModelConfig = MeshDescConfig & Description;

export type GLTFModelUpdate = MeshDescUpdate & Description;

// Type definition for animation details
export type AnimationDetails = {
  name: string;
  duration: number;
  tracks: number;
  isLooping: boolean;
  timeScale: number;
};

// Type definition for current playback state
export type AnimationState = {
  isPlaying: boolean;
  currentAnimation: string | null;
  isBlendMode: boolean;
  blendAnimations: {
    name: string;
    weight: number;
    isPlaying: boolean;
  }[];
  playbackTime: number;
  progress: number; // 0-1
};

export type GLTFModelEvent = {
  load: () => void;
  animationReady: () => void;
  needsUpdate: () => void;
};

export class GLTFModelDesc extends NewMeshDesc<
  GLTFModelConfig,
  GLTFModelUpdate,
  Group,
  GLTFModelEvent
> {
  private config: GLTFModelConfig;
  private loader: GLTFLoader;

  // Animation related fields
  private gltf: GLTF | null = null;
  private mixer: AnimationMixer | null = null;
  private clips = new Map<string, AnimationClip>();
  private actions = new Map<string, AnimationAction>();
  private currentAction: AnimationAction | null = null;
  private animationSpeed = 1.0;
  private isLooping = true;

  // Multiple animation management
  private activeBlendAnimations = new Map<
    string,
    {
      action: AnimationAction;
      weight: number;
      targetWeight: number;
    }
  >();
  private isBlendMode = false;

  // RTE (Relative-To-Eye) state
  private originalWorldPosition: Vector3 = new Vector3();
  private readonly _rtePosHigh = uniform(new Vector3());
  private readonly _rtePosLow = uniform(new Vector3());
  // f32 uniform holding R⁻¹×ecefPos (origin in local space) for castShadowPositionNode.
  // Updated in applyRTETransform. See the TODO in setupNodeMaterial for precision caveats.
  private readonly _localOriginOffset = uniform(new Vector3());
  private castShadow = false;

  constructor(view: ThreeView, ctx: ViewContext, config: GLTFModelConfig) {
    super(view, ctx, config);
    this.config = {
      ...config,
      gltfModel: {
        ...DEFAULT_GLTF_MODEL_DESCRIPTION,
        ...config.gltfModel,
      },
    };
    this.loader = new GLTFLoader();

    if (config.gltfModel?.emissiveColor !== undefined) {
      this.emissive = config.gltfModel.emissiveColor;
    }
    if (config.gltfModel?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.gltfModel.emissiveIntensity;
    }
  }

  override onCreate() {
    super.onCreate();
    this.applyRTETransform();

    if (this._instance) {
      this._instance.visible = this.visible;
    }

    this.onPassKeyChange();
  }

  createMesh(): Group {
    const modelConfig = this.config.gltfModel;

    // Create a placeholder group that will be populated async
    const group = new Group();

    if (modelConfig?.url) {
      this.loadModel(modelConfig.url, group)
        .then(() => {
          // Initialize animations if conditions are met
          if (this.shouldInitializeAnimation()) {
            this.initAnimation();
          }
        })
        .catch((error) => {
          console.error("Failed to initialize GLTF model layer:", error);
        });
    }

    return group;
  }

  /**
   * Override the base extractor — our `raw` is a {@link Group} that contains
   * child {@link Mesh}es with their own materials. Walk the tree and collect
   * every {@link NodeMaterial} so `MeshDescBase` can wire MRT/picking slots
   * to all of them.
   */
  protected override extractNodeMaterial(): NodeMaterial[] {
    const result: NodeMaterial[] = [];
    const raw = this.raw;
    if (!raw) return result;
    raw.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const m of mats) {
        if (m instanceof NodeMaterial) result.push(m);
      }
    });
    return result;
  }

  /**
   * Compose MRT slots (via super) + the RTE vertex transform. Every loaded
   * GLTF material receives the same per-instance `rtePosHigh/Low` uniforms,
   * and the global camera uniforms in `highPrecisionNode` provide the
   * eye-relative offset.
   */
  protected override setupNodeMaterial(material: NodeMaterial): void {
    super.setupNodeMaterial(material);
    applyRTEToNodeMaterial(material, {
      rtePosHigh: this._rtePosHigh,
      rtePosLow: this._rtePosLow,
      localOriginOffset: this._localOriginOffset,
    });
  }

  private async loadModel(url: string, targetGroup: Group): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(url);

      this.gltf = gltf;

      // Clear any existing children
      while (targetGroup.children.length > 0) {
        targetGroup.remove(targetGroup.children[0]);
      }

      targetGroup.add(gltf.scene);
      this.setupModel(targetGroup);

      // Materials only exist after the GLTF loads, so MRT/picking/RTE
      // wiring done in `super.onCreate()` was a no-op. Re-run it now that
      // `extractNodeMaterial()` will actually return materials.
      this.refreshNodeMaterial();

      this.emit("needsUpdate");
      this.emit("load");
    } catch (error) {
      console.warn("Failed to load GLTF model:", error);
    }
  }

  private setupModel(model: Group): void {
    const modelConfig = this.config.gltfModel;

    if (!modelConfig) return;

    this.convertMaterialsToTSL(model);

    this.castShadow = !!modelConfig.castShadow;

    model.traverse((child) => {
      if (child instanceof Mesh) {
        if (modelConfig.castShadow) child.castShadow = true;
        if (modelConfig.receiveShadow) child.receiveShadow = true;
        // RTE-encoded positions sit far away from the camera in world space,
        // so frustum culling against the original mesh AABB is unreliable.
        child.frustumCulled = false;

        this._setupShadowDepth(child);

        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of mats) {
          this.ctx.applyShadowMaterial(mat);
        }
      }
    });
  }

  // TODO(webgpu-migration): remove once on WebGPU.
  // WebGL ignores castShadowPositionNode, so this hook patches modelViewMatrix
  // directly with the full ECEF position (CPU f64) to prevent the shadow from
  // rendering at the globe origin (where the RTE-stripped matrixWorld points).
  private _setupShadowDepth(mesh: Mesh): void {
    const stripped = new Vector3();
    const fullMatrix = new Matrix4();
    mesh.onBeforeShadow = (
      _renderer: unknown,
      _object: unknown,
      _camera: unknown,
      shadowCamera: { matrixWorldInverse: Matrix4 },
    ) => {
      if (!this.castShadow) return;
      stripped.setFromMatrixPosition(mesh.matrixWorld);
      fullMatrix.copy(mesh.matrixWorld);
      fullMatrix.setPosition(
        this.originalWorldPosition.x + stripped.x,
        this.originalWorldPosition.y + stripped.y,
        this.originalWorldPosition.z + stripped.z,
      );
      mesh.modelViewMatrix.multiplyMatrices(
        shadowCamera.matrixWorldInverse,
        fullMatrix,
      );
    };
  }

  /**
   * Replace each loaded Three.js Material with its NodeMaterial counterpart
   * so the rest of the TSL pipeline (`MeshDescBase` MRT slots,
   * `highPrecisionUniformLocalVertexNode` RTE transform, picking wrap) can
   * attach. We invoke the base material's `copy()` (not `NodeMaterial.copy()`)
   * because the latter clobbers `vertexNode` / `fragmentNode` / `outputNode`
   * with `undefined` when the source isn't a NodeMaterial — which then trips
   * `NodeMaterial.setup()`'s `if (this.fragmentNode === null)` check (it's a
   * strict null compare; undefined falls through to the else branch and
   * crashes reading `.isOutputStructNode`).
   */
  private convertMaterialsToTSL(group: Group): void {
    group.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const list = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const converted: Material[] = list.map((original) => {
        if (original instanceof NodeMaterial) return original;
        const next = convertToNodeMaterial(original);
        original.dispose();
        return next;
      });
      child.material = Array.isArray(child.material) ? converted : converted[0];
    });
  }

  private setPositionRTE(worldPosition: Vector3): void {
    this.originalWorldPosition.copy(worldPosition);
    encodePositionRTE(
      worldPosition,
      this._rtePosHigh.value,
      this._rtePosLow.value,
    );
  }

  /**
   * Decompose the effective world transform (matrixWorld * T*R*S) into:
   * - Translation → encoded into the per-instance RTE uniforms
   * - Rotation/scale → kept on `raw.matrixWorld` so the RTE vertex node's
   *   `modelViewMatrixRTEUniform * modelWorldMatrix` (mat4×mat4) can rotate
   *   and scale `positionLocal` correctly — the earlier mat3()-based approach
   *   caused camera-move jitter and was replaced with this single mat4 multiply
   *
   * MeshDescBase.onCreate / onUpdateConfig already wrote a full transform
   * (including translation) into matrixWorld; this overwrites it.
   */
  private applyRTETransform(): void {
    if (!this.raw) return;

    const { position, rotationScale } = composeWorldMatrixForRTE(
      this.matrixWorld ?? this.matrix ?? new Matrix4(),
      this.composeLocalTransform(),
    );
    this.setPositionRTE(position);

    // WebGPU castShadowPositionNode: R⁻¹ × ecefPos computed in JS f64 → f32 uniform
    const invRotScale = rotationScale.clone().invert();
    this._localOriginOffset.value.copy(position).applyMatrix4(invRotScale);

    this.raw.matrixAutoUpdate = false;
    this.raw.matrixWorldAutoUpdate = false;
    this.raw.matrixWorld.copy(rotationScale);
    rotationScale.decompose(new Vector3(), this.raw.quaternion, this.raw.scale);
    this.raw.updateMatrixWorld();
  }

  onUpdateConfig(updates: GLTFModelUpdate): void {
    if (updates.gltfModel && this._instance) {
      const modelConfig = updates.gltfModel;

      // Update shadows
      if (
        modelConfig.castShadow !== undefined ||
        modelConfig.receiveShadow !== undefined
      ) {
        this.castShadow = !!modelConfig.castShadow;

        this._instance.traverse((child) => {
          if (child instanceof Mesh) {
            if (modelConfig.castShadow !== undefined) {
              child.castShadow = modelConfig.castShadow;
            }
            if (modelConfig.receiveShadow !== undefined)
              child.receiveShadow = modelConfig.receiveShadow;
          }
        });
      }

      // Dynamic animation settings update
      if (this.mixer && this.actions.size > 0) {
        if (modelConfig.animationSpeed !== undefined) {
          this.setAnimationSpeed(modelConfig.animationSpeed);
        }

        if (modelConfig.animationLoop !== undefined) {
          this.setAnimationLoop(modelConfig.animationLoop);
        }

        if (modelConfig.animationActiveClip !== undefined) {
          const duration = modelConfig.animationCrossfadeDuration ?? 0.3;
          if (this.currentAction) {
            this.crossFadeAnimation(
              this.getCurrentAnimationName() ?? "",
              modelConfig.animationActiveClip,
              duration,
            );
          } else {
            this.playAnimation(modelConfig.animationActiveClip);
          }
        }

        if (modelConfig.animationEnabled !== undefined) {
          if (modelConfig.animationEnabled) {
            this.resumeAnimation();
          } else {
            this.pauseAnimation();
          }
        }
      }

      // If URL changes, reload the model
      if (modelConfig.url && modelConfig.url !== this.config.gltfModel?.url) {
        this.loadModel(modelConfig.url, this._instance);
        if (this.config.gltfModel) {
          this.config.gltfModel.url = modelConfig.url;
        }
      }

      if (modelConfig.emissiveColor !== undefined) {
        this.emissive = modelConfig.emissiveColor;
      }
      if (modelConfig.emissiveIntensity !== undefined) {
        this.emissiveIntensity = modelConfig.emissiveIntensity;
      }

      this.emit("needsUpdate");
    }

    const hasSpatialChange =
      updates.matrixWorld !== undefined ||
      updates.position !== undefined ||
      updates.scale !== undefined ||
      updates.rotation !== undefined;

    if (hasSpatialChange) {
      if (updates.matrixWorld !== undefined)
        this.matrixWorld = updates.matrixWorld;
      if (updates.position !== undefined) this.position = updates.position;
      if (updates.scale !== undefined) this.scale = updates.scale;
      if (updates.rotation !== undefined) this.rotation = updates.rotation;

      this.applyRTETransform();

      // Strip spatial keys so super.onUpdateConfig() skips its own applyTransform()
      const { position, matrixWorld, scale, rotation, ...restUpdates } =
        updates;
      super.onUpdateConfig(restUpdates as GLTFModelUpdate);
    } else {
      super.onUpdateConfig(updates);
    }
  }

  override onDestroy(): void {
    this.disposeAnimation();

    if (this._instance) {
      this._instance.traverse((child) => {
        if (child instanceof Mesh) {
          this.ctx.removeShadowMaterial(child.material);

          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }

    super.onDestroy();
  }

  /**
   * Dispose animation-related resources
   */
  private disposeAnimationResources(): void {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
    this.actions.clear();
    this.clips.clear();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.gltf = null;
  }

  private shouldInitializeAnimation(): boolean {
    return (
      this.gltf !== null &&
      this.gltf.animations &&
      this.gltf.animations.length > 0
    );
  }

  private initAnimation(): void {
    if (
      !this.gltf ||
      !this.gltf.animations ||
      this.gltf.animations.length === 0
    ) {
      console.warn("No animations found in GLTF model");
      return;
    }

    const animConfig = this.config.gltfModel;

    this.mixer = new AnimationMixer(this.gltf.scene);

    const speed = animConfig?.animationSpeed ?? this.animationSpeed;
    const loop = animConfig?.animationLoop ?? this.isLooping;

    this.gltf.animations.forEach((clip) => {
      this.clips.set(clip.name, clip);
      if (this.mixer) {
        const action = this.mixer.clipAction(clip);
        this.actions.set(clip.name, action);

        action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
        action.setEffectiveTimeScale(speed);
        action.setEffectiveWeight(0);
        action.enabled = true;
      }
    });

    this.animationSpeed = speed;
    this.isLooping = loop;

    if (animConfig?.animationAutoPlay && animConfig?.animationActiveClip) {
      const clipName = animConfig.animationActiveClip;
      if (this.clips.has(clipName)) {
        this.playAnimation(clipName);

        if (animConfig.animationEnabled === false) {
          this.pauseAnimation();
        }
      } else {
        console.warn(`Specified animation "${clipName}" not found in model`);
      }
    }

    this.emit("animationReady");
  }

  // ========================================
  // Getter APIs (get prefix)
  // ========================================

  getAnimationAvailable(): string[] {
    return Array.from(this.clips.keys());
  }

  getAnimationDetails(name?: string): AnimationDetails | AnimationDetails[] {
    if (name) {
      const clip = this.clips.get(name);
      const action = this.actions.get(name);
      if (!clip || !action) {
        throw new Error(`Animation "${name}" not found`);
      }

      return {
        name: clip.name,
        duration: clip.duration,
        tracks: clip.tracks.length,
        isLooping: action.loop === LoopRepeat,
        timeScale: action.timeScale,
      };
    } else {
      return Array.from(this.clips.entries()).map(([name, clip]) => {
        const action = this.actions.get(name);
        if (!action) {
          throw new Error(`Animation action "${name}" not found`);
        }
        return {
          name: clip.name,
          duration: clip.duration,
          tracks: clip.tracks.length,
          isLooping: action.loop === LoopRepeat,
          timeScale: action.timeScale,
        };
      });
    }
  }

  getAnimationCurrentState(): AnimationState {
    const isPlaying = this.currentAction
      ? !this.currentAction.paused && this.currentAction.isRunning()
      : false;
    const currentAnimation = this.getCurrentAnimationName();

    const blendAnimations = Array.from(
      this.activeBlendAnimations.entries(),
    ).map(([name, blendAnim]) => ({
      name,
      weight: blendAnim.weight,
      isPlaying: !blendAnim.action.paused && blendAnim.action.isRunning(),
    }));

    let playbackTime = 0;
    let progress = 0;
    if (this.currentAction) {
      playbackTime = this.currentAction.time;
      const clip = this.clips.get(currentAnimation || "");
      if (clip && clip.duration > 0) {
        progress = Math.min(playbackTime / clip.duration, 1);
      }
    }

    return {
      isPlaying,
      currentAnimation,
      isBlendMode: this.isBlendMode,
      blendAnimations,
      playbackTime,
      progress,
    };
  }

  getAnimationClip(name: string): AnimationClip | null {
    return this.clips.get(name) || null;
  }

  getAnimationAction(name: string): AnimationAction | null {
    return this.actions.get(name) || null;
  }

  // ========================================
  // Control APIs (verb-based)
  // ========================================

  playAnimation(name: string): boolean {
    if (!this.mixer || !this.actions.has(name)) {
      console.warn(`Animation clip "${name}" not found`);
      return false;
    }

    if (this.isBlendMode) {
      this.stopAllAnimations();
      this.isBlendMode = false;
    } else if (this.currentAction) {
      this.currentAction.stop();
    }

    const action = this.actions.get(name);
    if (!action) {
      console.warn(`Animation action "${name}" not found`);
      return false;
    }
    this.ensureAnimationPlaying(action);

    return true;
  }

  crossFadeAnimation(from: string, to: string, duration: number): boolean {
    if (!this.mixer) {
      console.warn("Animation mixer not initialized");
      return false;
    }

    if (!this.actions.has(from)) {
      console.warn(`Animation clip "${from}" not found`);
      return false;
    }

    if (!this.actions.has(to)) {
      console.warn(`Animation clip "${to}" not found`);
      return false;
    }

    const fromAction = this.actions.get(from);
    const toAction = this.actions.get(to);

    if (!fromAction || !toAction) {
      console.warn("Animation actions not found for crossfade");
      return false;
    }

    if (fromAction === toAction) {
      this.ensureAnimationPlaying(toAction);
      return true;
    }

    if (this.isBlendMode) {
      this.stopAllAnimations();
      this.isBlendMode = false;
    }

    this.ensureFromAnimationActive(fromAction);

    this.executeCrossFade(fromAction, toAction, duration);

    return true;
  }

  private ensureAnimationPlaying(action: AnimationAction): void {
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(this.animationSpeed);
    action.reset().play();
    this.currentAction = action;
    this.emit("needsUpdate");
  }

  private ensureFromAnimationActive(fromAction: AnimationAction): void {
    if (this.currentAction !== fromAction) {
      // Ensure the source action is actively contributing before crossfade
      fromAction.enabled = true;
      fromAction.setEffectiveTimeScale(this.animationSpeed);
      fromAction.setEffectiveWeight(1);
      fromAction.reset().play();
      this.currentAction = fromAction;
    }
  }

  private executeCrossFade(
    fromAction: AnimationAction,
    toAction: AnimationAction,
    duration: number,
  ): void {
    // Prepare target action following three.js example semantics
    toAction.enabled = true;
    toAction.setEffectiveTimeScale(this.animationSpeed);
    toAction.setEffectiveWeight(1);
    toAction.time = 0; // restart target action
    fromAction.crossFadeTo(toAction, duration, true);
    toAction.play();
    this.currentAction = toAction;
    this.emit("needsUpdate");
  }

  blendAnimations(animations: { name: string; weight: number }[]): void {
    if (!this.mixer) {
      console.warn("Animation mixer not initialized");
      return;
    }

    this.stopAllAnimations();

    this.isBlendMode = true;
    this.currentAction = null;

    animations.forEach(({ name, weight }) => {
      const action = this.actions.get(name);
      if (!action) {
        console.warn(`Animation "${name}" not found`);
        return;
      }

      action.enabled = true;
      action.setEffectiveTimeScale(this.animationSpeed);
      action.setEffectiveWeight(weight);
      action.play();

      this.activeBlendAnimations.set(name, {
        action,
        weight,
        targetWeight: weight,
      });
    });

    this.emit("needsUpdate");
  }

  stopAnimation(): void {
    if (this.isBlendMode) {
      this.stopAllAnimations();
    } else if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  stopAllAnimations(): void {
    this.activeBlendAnimations.forEach((blendAnim) => {
      blendAnim.action.stop();
    });
    this.activeBlendAnimations.clear();

    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }

    this.actions.forEach((action) => {
      action.setEffectiveWeight(0);
      action.enabled = false;
    });

    this.isBlendMode = false;

    this.emit("needsUpdate");
  }

  pauseAnimation(): void {
    if (this.isBlendMode) {
      this.activeBlendAnimations.forEach((blendAnim) => {
        blendAnim.action.paused = true;
      });
    } else if (this.currentAction) {
      this.currentAction.paused = true;
    }
  }

  resumeAnimation(): void {
    if (this.isBlendMode) {
      this.activeBlendAnimations.forEach((blendAnim) => {
        blendAnim.action.paused = false;
      });
    } else if (this.currentAction) {
      this.currentAction.paused = false;
    }
  }

  normalizeAnimationWeights(): void {
    if (!this.isBlendMode || this.activeBlendAnimations.size === 0) {
      console.warn("No blend animations to normalize");
      return;
    }

    const totalWeight = Array.from(this.activeBlendAnimations.values()).reduce(
      (sum, blendAnim) => sum + blendAnim.targetWeight,
      0,
    );

    if (totalWeight === 0) {
      console.warn("Total weight is 0, cannot normalize");
      return;
    }

    this.activeBlendAnimations.forEach((blendAnim) => {
      const normalizedWeight = blendAnim.targetWeight / totalWeight;
      blendAnim.action.weight = normalizedWeight;
      blendAnim.weight = normalizedWeight;
    });

    this.emit("needsUpdate");
  }

  // ========================================
  // Setter APIs (set prefix)
  // ========================================

  setAnimationSpeed(speed: number): void {
    this.animationSpeed = speed;
    // Apply to all actions so both single and blend modes are covered
    this.actions.forEach((action) => {
      action.setEffectiveTimeScale(speed);
    });
  }

  setAnimationLoop(loop: boolean): void {
    this.isLooping = loop;
    this.actions.forEach((action) => {
      action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    });
  }

  setAnimationWeight(name: string, weight: number): void {
    if (!this.mixer) {
      console.warn("Animation mixer not initialized");
      return;
    }

    if (this.isBlendMode && this.activeBlendAnimations.has(name)) {
      const blendAnim = this.activeBlendAnimations.get(name);
      if (!blendAnim) {
        console.warn(`Blend animation "${name}" not found`);
        return;
      }
      blendAnim.action.enabled = weight > 0;
      blendAnim.action.setEffectiveWeight(weight);
      blendAnim.weight = weight;
      blendAnim.targetWeight = weight;
    } else {
      const action = this.actions.get(name);
      if (!action) {
        console.warn(`Animation "${name}" not found`);
        return;
      }

      if (!this.isBlendMode) {
        this.stopAllAnimations();
        this.isBlendMode = true;
        this.currentAction = null;
      }

      action.enabled = true;
      action.setEffectiveTimeScale(this.animationSpeed);
      action.setEffectiveWeight(weight);
      action.play();

      this.activeBlendAnimations.set(name, {
        action,
        weight,
        targetWeight: weight,
      });
    }

    this.emit("needsUpdate");
  }

  // ========================================
  // Internal Processing APIs
  // ========================================

  updateAnimation(deltaTime: number): void {
    this.updateAnimationMixer(deltaTime);
  }

  disposeAnimation(): void {
    this.disposeAnimationResources();
  }

  private updateAnimationMixer(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  // ========================================
  // Framework Integration APIs
  // ========================================

  update(time: number): void {
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = time;
      return;
    }

    const deltaTime = (time - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = time;

    this.updateAnimationMixer(deltaTime);
  }

  private getCurrentAnimationName(): string | null {
    if (!this.currentAction) return null;

    for (const [name, action] of this.actions.entries()) {
      if (action === this.currentAction) {
        return name;
      }
    }
    return null;
  }

  getWorldPosition(): Vector3 {
    return this.originalWorldPosition;
  }

  private lastUpdateTime?: number;
}
