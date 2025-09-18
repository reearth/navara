import {
  Group,
  Mesh,
  AnimationMixer,
  AnimationAction,
  AnimationClip,
  LoopRepeat,
  LoopOnce,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
} from "../../core";

type LayerDescription = {
  gltfModel?: {
    url: string;
    castShadow?: boolean;
    receiveShadow?: boolean;

    // Declarative animation settings - fully aligned with Rust naming
    animation_enabled?: boolean; // animation_enabled
    animation_clips?: string[]; // animation_clips (available clips list)
    animation_active_clip?: string; // animation_active_clip
    animation_speed?: number; // animation_speed (default: 1.0)
    animation_loop?: boolean; // animation_loop (default: true)
    animation_crossfade_duration?: number; // animation_crossfade_duration (default: 0.3)
    animation_auto_play?: boolean; // animation_auto_play (default: false)
  };
};

export type GLTFModelLayerConfig = MeshLayerConfig & LayerDescription;

export type GLTFModelLayerUpdate = MeshLayerUpdate & LayerDescription;

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

export type GLTFModelLayerEvent = {
  load: () => void;
  animationReady: () => void;
};

export class GLTFModelLayer extends MeshLayerDeclaration<
  GLTFModelLayerConfig,
  GLTFModelLayerUpdate,
  Group,
  GLTFModelLayerEvent
> {
  private config: GLTFModelLayerConfig;
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

  constructor(view: ViewContext, config: GLTFModelLayerConfig) {
    super(view, config);
    this.config = config;
    this.loader = new GLTFLoader();
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
          console.error("Model loading failed:", error);
          // Animation initialization is automatically skipped on error
        });
    }

    return group;
  }

  private async loadModel(url: string, targetGroup: Group): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(url);

      // Store GLTF data for animation access
      this.gltf = gltf;

      // Clear any existing children
      while (targetGroup.children.length > 0) {
        targetGroup.remove(targetGroup.children[0]);
      }

      // Add the loaded model
      targetGroup.add(gltf.scene);

      this.setupModel(targetGroup);
      this.emit("_needsUpdate");
      this.emit("load");
    } catch (error) {
      console.error("Failed to load GLTF model:", error);
      throw error; // Propagate error to caller
    }
  }

  private setupModel(model: Group): void {
    const modelConfig = this.config.gltfModel;

    if (!modelConfig) return;

    // Setup shadows
    model.traverse((child) => {
      if (child instanceof Mesh) {
        if (modelConfig.castShadow) child.castShadow = true;
        if (modelConfig.receiveShadow) child.receiveShadow = true;

        // Setup CSM for materials if shadows are enabled
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            this.view.emit("_csmMounted", mat);
          });
        } else {
          this.view.emit("_csmMounted", child.material);
        }
      }
    });
  }

  onUpdateConfig(updates: GLTFModelLayerUpdate): void {
    if (updates.gltfModel && this._instance) {
      const modelConfig = updates.gltfModel;

      // Update shadows
      if (
        modelConfig.castShadow !== undefined ||
        modelConfig.receiveShadow !== undefined
      ) {
        this._instance.traverse((child) => {
          if (child instanceof Mesh) {
            if (modelConfig.castShadow !== undefined)
              child.castShadow = modelConfig.castShadow;
            if (modelConfig.receiveShadow !== undefined)
              child.receiveShadow = modelConfig.receiveShadow;
          }
        });
      }

      // Dynamic animation settings update
      if (this.mixer && this.actions.size > 0) {
        // Speed change
        if (modelConfig.animation_speed !== undefined) {
          this.setAnimationSpeed(modelConfig.animation_speed);
        }

        // Loop setting change
        if (modelConfig.animation_loop !== undefined) {
          this.setAnimationLoop(modelConfig.animation_loop);
        }

        // Animation switching
        if (modelConfig.animation_active_clip !== undefined) {
          const duration = modelConfig.animation_crossfade_duration ?? 0.3;
          if (this.currentAction) {
            this.crossFadeAnimation(
              this.getCurrentAnimationName() ?? "",
              modelConfig.animation_active_clip,
              duration,
            );
          } else {
            this.playAnimation(modelConfig.animation_active_clip);
          }
        }

        // Animation enabled state change
        if (modelConfig.animation_enabled !== undefined) {
          if (modelConfig.animation_enabled) {
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

      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    // Clean up animation-related resources
    this.disposeAnimation();

    if (this._instance) {
      this._instance.traverse((child) => {
        if (child instanceof Mesh) {
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
      this._instance = undefined;
    }
  }

  /**
   * Dispose animation-related resources
   */
  private disposeAnimationResources(): void {
    // Stop current animation
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }

    // Clear animation actions
    this.actions.clear();

    // Clear animation clips
    this.clips.clear();

    // Dispose mixer
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    // Clear GLTF data
    this.gltf = null;
  }

  private shouldInitializeAnimation(): boolean {
    // Initialize only when GLTF data exists and has animation clips
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

    // Create AnimationMixer
    this.mixer = new AnimationMixer(this.gltf.scene);

    // Apply configuration values
    const speed = animConfig?.animation_speed ?? this.animationSpeed;
    const loop = animConfig?.animation_loop ?? this.isLooping;

    // Register animation clips
    this.gltf.animations.forEach((clip) => {
      this.clips.set(clip.name, clip);
      if (this.mixer) {
        const action = this.mixer.clipAction(clip);
        this.actions.set(clip.name, action);

        // Apply configuration values (align with three.js example semantics)
        action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
        action.setEffectiveTimeScale(speed);
        action.setEffectiveWeight(0);
        action.enabled = true;
      }
    });

    // Reflect configuration values to internal state
    this.animationSpeed = speed;
    this.isLooping = loop;

    // Handle auto-play settings
    if (animConfig?.animation_auto_play && animConfig?.animation_active_clip) {
      const clipName = animConfig.animation_active_clip;
      if (this.clips.has(clipName)) {
        this.playAnimation(clipName);

        // Set enabled state
        if (animConfig.animation_enabled === false) {
          this.pauseAnimation();
        }
      } else {
        console.warn(`Specified animation "${clipName}" not found in model`);
      }
    }

    // Notify animation initialization completion
    this.emit("animationReady");
  }

  // ========================================
  // Getter APIs (get prefix)
  // ========================================

  /**
   * Get available animation clip names
   */
  getAnimationAvailable(): string[] {
    return Array.from(this.clips.keys());
  }

  /**
   * Get animation details information
   */
  getAnimationDetails(name?: string): AnimationDetails | AnimationDetails[] {
    if (name) {
      // Get details for specific animation
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
      // Get details for all animations
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

  /**
   * Get current playback state
   */
  getAnimationCurrentState(): AnimationState {
    const isPlaying = this.currentAction
      ? !this.currentAction.paused && this.currentAction.isRunning()
      : false;
    const currentAnimation = this.getCurrentAnimationName();

    // Get blend animation states
    const blendAnimations = Array.from(
      this.activeBlendAnimations.entries(),
    ).map(([name, blendAnim]) => ({
      name,
      weight: blendAnim.weight,
      isPlaying: !blendAnim.action.paused && blendAnim.action.isRunning(),
    }));

    // Calculate playback time and progress
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

  /**
   * Get animation clip directly
   */
  getAnimationClip(name: string): AnimationClip | null {
    return this.clips.get(name) || null;
  }

  /**
   * Get animation action directly
   */
  getAnimationAction(name: string): AnimationAction | null {
    return this.actions.get(name) || null;
  }

  // ========================================
  // Control APIs (verb-based)
  // ========================================

  /**
   * Play specified animation
   */
  playAnimation(name: string): boolean {
    if (!this.mixer || !this.actions.has(name)) {
      console.warn(`Animation clip "${name}" not found`);
      return false;
    }

    // If currently in blend mode, stop all and exit blend mode
    if (this.isBlendMode) {
      this.stopAllAnimations();
      this.isBlendMode = false;
    } else if (this.currentAction) {
      // Stop current single animation
      this.currentAction.stop();
    }

    // Start new animation
    const action = this.actions.get(name);
    if (!action) {
      console.warn(`Animation action "${name}" not found`);
      return false;
    }
    this.ensureAnimationPlaying(action);

    return true;
  }

  /**
   * Cross-fade between animations
   */
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

    // Handle case where same animation is specified
    if (fromAction === toAction) {
      this.ensureAnimationPlaying(toAction);
      return true;
    }

    // If currently in blend mode, stop all and exit blend mode before crossfading
    if (this.isBlendMode) {
      this.stopAllAnimations();
      this.isBlendMode = false;
    }

    // Ensure 'from' animation is the current animation
    this.ensureFromAnimationActive(fromAction);

    // Execute crossfade
    this.executeCrossFade(fromAction, toAction, duration);

    return true;
  }

  /**
   * Ensure the specified animation is playing
   */
  private ensureAnimationPlaying(action: AnimationAction): void {
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(this.animationSpeed);
    action.reset().play();
    this.currentAction = action;
    this.emit("_needsUpdate");
  }

  /**
   * Ensure the 'from' animation is currently active
   */
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

  /**
   * Execute the actual crossfade between animations
   */
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
    this.emit("_needsUpdate");
  }

  /**
   * Play multiple animations simultaneously with weights
   */
  blendAnimations(animations: { name: string; weight: number }[]): void {
    if (!this.mixer) {
      console.warn("Animation mixer not initialized");
      return;
    }

    // Stop existing animations
    this.stopAllAnimations();

    // Switch to blend mode
    this.isBlendMode = true;
    this.currentAction = null;

    // Configure each animation
    animations.forEach(({ name, weight }) => {
      const action = this.actions.get(name);
      if (!action) {
        console.warn(`Animation "${name}" not found`);
        return;
      }

      // Start animation with effective settings
      action.enabled = true;
      action.setEffectiveTimeScale(this.animationSpeed);
      action.setEffectiveWeight(weight);
      action.play();

      // Register as blend animation
      this.activeBlendAnimations.set(name, {
        action,
        weight,
        targetWeight: weight,
      });
    });

    // Notify rendering update
    this.emit("_needsUpdate");
  }

  /**
   * Stop current animation
   */
  stopAnimation(): void {
    if (this.isBlendMode) {
      // Stop all in blend mode
      this.stopAllAnimations();
    } else if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  /**
   * Stop all animations
   */
  stopAllAnimations(): void {
    // Stop blend animations
    this.activeBlendAnimations.forEach((blendAnim) => {
      blendAnim.action.stop();
    });
    this.activeBlendAnimations.clear();

    // Stop single animation
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }

    // Also reset weights and disable actions
    this.actions.forEach((action) => {
      action.setEffectiveWeight(0);
      action.enabled = false;
    });

    // Exit blend mode
    this.isBlendMode = false;

    this.emit("_needsUpdate");
  }

  /**
   * Pause current animation
   */
  pauseAnimation(): void {
    if (this.isBlendMode) {
      this.activeBlendAnimations.forEach((blendAnim) => {
        blendAnim.action.paused = true;
      });
    } else if (this.currentAction) {
      this.currentAction.paused = true;
    }
  }

  /**
   * Resume paused animation
   */
  resumeAnimation(): void {
    if (this.isBlendMode) {
      this.activeBlendAnimations.forEach((blendAnim) => {
        blendAnim.action.paused = false;
      });
    } else if (this.currentAction) {
      this.currentAction.paused = false;
    }
  }

  // stepAnimation removed with UI pausing/stepping controls

  /**
   * Normalize all animation weights (adjust total to 1.0)
   */
  normalizeAnimationWeights(): void {
    if (!this.isBlendMode || this.activeBlendAnimations.size === 0) {
      console.warn("No blend animations to normalize");
      return;
    }

    // Calculate total weight
    const totalWeight = Array.from(this.activeBlendAnimations.values()).reduce(
      (sum, blendAnim) => sum + blendAnim.targetWeight,
      0,
    );

    if (totalWeight === 0) {
      console.warn("Total weight is 0, cannot normalize");
      return;
    }

    // Normalize each animation weight
    this.activeBlendAnimations.forEach((blendAnim) => {
      const normalizedWeight = blendAnim.targetWeight / totalWeight;
      blendAnim.action.weight = normalizedWeight;
      blendAnim.weight = normalizedWeight;
    });

    // Notify rendering update
    this.emit("_needsUpdate");
  }

  // ========================================
  // Setter APIs (set prefix)
  // ========================================

  /**
   * Set animation speed
   */
  setAnimationSpeed(speed: number): void {
    this.animationSpeed = speed;
    // Apply to all actions so both single and blend modes are covered
    this.actions.forEach((action) => {
      action.setEffectiveTimeScale(speed);
    });
  }

  /**
   * Change animation loop setting
   */
  setAnimationLoop(loop: boolean): void {
    this.isLooping = loop;
    this.actions.forEach((action) => {
      action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    });
  }

  /**
   * Set weight for specific animation
   */
  setAnimationWeight(name: string, weight: number): void {
    if (!this.mixer) {
      console.warn("Animation mixer not initialized");
      return;
    }

    // Weight adjustment in blend mode
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
      // For single animation, switch to blend mode and set weight
      const action = this.actions.get(name);
      if (!action) {
        console.warn(`Animation "${name}" not found`);
        return;
      }

      // Stop existing animations and switch to blend mode
      if (!this.isBlendMode) {
        this.stopAllAnimations();
        this.isBlendMode = true;
        this.currentAction = null;
      }

      // Start animation and set weight
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

    this.emit("_needsUpdate");
  }

  // ========================================
  // Internal Processing APIs
  // ========================================

  /**
   * Update animation mixer (needs to be called every frame)
   */
  updateAnimation(deltaTime: number): void {
    this.updateAnimationMixer(deltaTime);
  }

  /**
   * Dispose animation-related resources
   */
  disposeAnimation(): void {
    this.disposeAnimationResources();
  }

  /**
   * Internal method to update animation mixer
   */
  private updateAnimationMixer(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  // ========================================
  // Framework Integration APIs
  // ========================================

  /**
   * Update method called every frame
   * Automatically called by Three.js framework
   */
  update(time: number): void {
    // Record previous update time and calculate deltaTime
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = time;
      return;
    }

    const deltaTime = (time - this.lastUpdateTime) / 1000; // Convert milliseconds to seconds
    this.lastUpdateTime = time;

    // Update animation mixer
    this.updateAnimationMixer(deltaTime);
  }

  /**
   * Get currently playing animation name
   */
  private getCurrentAnimationName(): string | null {
    if (!this.currentAction) return null;

    for (const [name, action] of this.actions.entries()) {
      if (action === this.currentAction) {
        return name;
      }
    }
    return null;
  }

  private lastUpdateTime?: number;
}
