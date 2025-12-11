import type { BaseEventMap, XYZ } from "@navara/core";
import {
  Object3D,
  Mesh,
  type WebGLRenderer,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  MeshLambertMaterial,
} from "three";

import { setupMeshEventHandlers as setupMeshEventHandlersUtil } from "../mesh/meshEventHandlers";
import type { Scenes } from "../scene";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import {
  ensurePostEffectUserData,
  getMaskPassType,
  MaskPassTypes,
  type PostEffectConfig,
  PostEffectOcclusionMode,
  resolveActiveEffects,
  resolvePostEffectOcclusion,
} from "./PostEffectHelper";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type: "mesh";
  position?: XYZ;
  scale?: XYZ;
  rotation?: XYZ;
  effectIds?: string[];
  postEffectOcclusion?: number;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "scale" | "rotation" | "effectIds" | "postEffectOcclusion"
> & {
  emissiveColor?: number;
  emissiveIntensity?: number;
} & LayerDeclarationConfigUpdate;

type PassKey = keyof Pick<
  Scenes,
  "opaque" | "transparent" | "mrt" | "skyEnvMap"
>;

export type MeshBaseInstance<Instance extends object = object> =
  Instance extends Object3D
    ? Instance
    : Instance extends {
          raw: infer Raw extends Object3D;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : Instance & BaseInstance;

export abstract class MeshLayerDeclaration<
  Config extends MeshLayerConfig = MeshLayerConfig,
  UpdateConfig extends MeshLayerUpdate = MeshLayerUpdate,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends
    MeshBaseInstance<InstanceObj> = MeshBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance, CustomEvent> {
  public position?: XYZ;
  public scale?: XYZ;
  public rotation?: XYZ;
  private prevPassKey?: PassKey;
  private effectIds?: string[];
  private postEffectOcclusion?: number;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
    this.scale = config.scale;
    this.rotation = config.rotation;
    this.effectIds = config.effectIds;
    this.postEffectOcclusion = config.postEffectOcclusion;
  }

  protected getPassKey(): PassKey {
    return "opaque";
  }

  abstract createMesh(): Instance;

  get raw() {
    if (!this._instance) return;

    if (this._instance instanceof Object3D) {
      return this._instance as Instance extends Object3D ? Instance : never;
    }
    if ("raw" in this._instance) {
      return this._instance.raw as Instance extends {
        raw: infer Raw extends Object3D;
      }
        ? Raw
        : never;
    }
    return;
  }

  onCreate() {
    this._instance = this.createMesh();

    if (this.position) {
      this.raw?.position.copy(this.position);
    }

    if (this.scale) {
      this.raw?.scale.copy(this.scale);
    }

    if (this.rotation) {
      this.raw?.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    }

    this._instance.visible = this.visible;

    this.onPassKeyChange();

    // Register layer effects with postEffectOcclusion setting
    if (this.effectIds && this.effectIds.length > 0) {
      this.view.registerLayerEffects(
        this.id,
        this.effectIds,
        this.postEffectOcclusion,
      );
    }

    // Setup mesh event handlers for all mesh types
    this.setupMeshEventHandlers();

    // Setup onBeforeRender callback for post effect depth control
    this.setupMeshOnBeforeRender();

    // Apply initial effects
    this.applyEffects();
  }

  /**
   * Apply effects to the mesh declaratively.
   * This method dispatches events to trigger effect application through the event system.
   * It's called automatically when effects are updated via onUpdateConfig().
   *
   * Unified with model.ts: layerEffectsChanged event includes emissive info,
   * and the handler (meshEventHandlers.ts) applies emissive based on layer settings.
   */
  private applyEffects(): void {
    if (!this.raw || !this.view.postEffectRegistry) return;

    const currentEffects = this.effectIds ?? [];
    const prevEffects = (this.raw.userData.prevEffects as string[]) ?? [];

    // Dispatch layerEffectsChanged event with emissive info (same as model.ts)
    // The handler will check Bloom status and apply emissive accordingly
    // Cast needed because Three.js dispatchEvent only accepts Object3DEventMap events
    const event = {
      type: "layerEffectsChanged" as const,
      target: this.raw,
      effectIds: currentEffects,
      prevEffectIds: prevEffects,
      layerId: this.id,
      emissiveIntensity: this.view.getLayerEmissiveIntensity(this.id),
      emissiveColor: this.view.getLayerEmissiveColor(this.id),
    };
    (this.raw.dispatchEvent as (e: typeof event) => void)(event);

    // Store current effects for next update
    this.raw.userData.prevEffects = [...currentEffects];
  }

  /**
   * Setup event handlers for primitive mesh objects.
   * This enables emissive and layerEffects control via events instead of direct manipulation.
   */
  protected setupMeshEventHandlers() {
    if (!this.raw) return;
    setupMeshEventHandlersUtil(this.raw, this.view, this.id);
  }

  /**
   * Setup onBeforeRender callback for post effect depth control.
   * This enables Cube & Sphere layers to respond to postEffectOcclusion settings
   * by adjusting depth test/write during mask rendering passes, similar to ModelMesh.
   */
  private setupMeshOnBeforeRender(): void {
    if (!this.raw) return;

    // Only setup for Mesh objects (Box, Sphere, etc.)
    if (!(this.raw instanceof Mesh)) return;

    const mesh = this.raw as Mesh;

    mesh.onBeforeRender = (renderer: WebGLRenderer) => {
      // 1. Build config from layer properties (not userData - MeshLayerDeclaration doesn't use it)
      // Note: postEffectOcclusion is NOT included - SoT is registry, accessed via this.id
      const config: PostEffectConfig = {
        effectIds: this.effectIds ?? [],
      };

      // 2. Initialize Material userData for PostEffect (if material supports it)
      // Include MeshLambertMaterial for Cube/Sphere primitives
      if (
        mesh.material instanceof MeshStandardMaterial ||
        mesh.material instanceof MeshPhysicalMaterial ||
        mesh.material instanceof MeshLambertMaterial
      ) {
        ensurePostEffectUserData(mesh.material);

        const registry = this.view.postEffectRegistry;

        // 3. Determine mask pass type from RenderTarget name
        const pass = getMaskPassType(renderer.getRenderTarget());

        // 4. Resolve active effects for this pass
        const { hasBloom, activeInThisPass } = resolveActiveEffects(
          config,
          registry,
          pass,
        );

        // 5. Set Bloom enabled flag
        mesh.material.userData.uBloomEnabled ??= { value: 0.0 };
        mesh.material.userData.uBloomEnabled.value = hasBloom ? 1.0 : 0.0;

        // 5b. Set Outline mask pass flag (for future shader customization)
        // Note: MeshLambertMaterial doesn't have custom shaders yet, but flag is set for consistency
        mesh.material.userData.uOutlineMaskPass ??= { value: 0.0 };
        mesh.material.userData.uOutlineMaskPass.value =
          pass === MaskPassTypes.Outline && activeInThisPass ? 1.0 : 0.0;

        // 6. Control depth test/write and colorWrite during mask rendering passes
        if (pass !== MaskPassTypes.None) {
          if (activeInThisPass) {
            // This pass is for rendering this object
            const occlusion = resolvePostEffectOcclusion(registry, this.id);
            const isSilhouette =
              occlusion === PostEffectOcclusionMode.Silhouette;
            mesh.material.depthTest = !isSilhouette;
            mesh.material.depthWrite = !isSilhouette;
            mesh.material.colorWrite = true;
          } else {
            // This pass is not for this object - suppress drawing
            mesh.material.depthTest = true;
            mesh.material.depthWrite = true;
            mesh.material.colorWrite = false;
          }
        } else {
          // Normal rendering
          mesh.material.depthTest = true;
          mesh.material.depthWrite = true;
          mesh.material.colorWrite = true;
        }
      }
    };
  }

  removeFromScene(passKey: PassKey) {
    const scenes = this.view.scenes;

    if (scenes[passKey] && this.raw) {
      scenes[passKey].remove(this.raw);
    }
  }

  addToScene(passKey: PassKey) {
    if (!this.raw) return;

    const scenes = this.view.scenes;

    if (scenes[passKey]) {
      scenes[passKey].add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    super.onUpdateConfig(updates);

    if (updates.position !== undefined) {
      this.position = updates.position;
      this.raw?.position.copy(updates.position);
    }

    if (updates.scale !== undefined) {
      this.scale = updates.scale;
      this.raw?.scale.copy(updates.scale);
    }

    if (updates.rotation !== undefined) {
      this.rotation = updates.rotation;
      this.raw?.rotation.set(
        updates.rotation.x,
        updates.rotation.y,
        updates.rotation.z,
      );
    }

    // Handle effectIds update - delegate to ViewContext for proper cache synchronization
    if (updates.effectIds !== undefined) {
      // Update local effects cache
      this.effectIds =
        updates.effectIds.length > 0 ? updates.effectIds : undefined;

      // Update ViewContext cache
      this.view.updateLayerEffects(this.id, updates.effectIds);

      // Apply effects declaratively
      this.applyEffects();
    }

    // Handle postEffectOcclusion update - always delegate to ViewContext for consistency
    if (updates.postEffectOcclusion !== undefined) {
      this.postEffectOcclusion = updates.postEffectOcclusion;
      // Use ViewContext API to ensure all layers (including MeshLayerDeclaration) follow same pipeline:
      // 1. PostEffectRegistry settings are updated
      // 2. Existing clones are moved between sceneDepthEnabled/sceneDepthDisabled
      // This ensures Cube/Sphere behave consistently with Layer types
      this.view.setLayerPostEffectOcclusion(this.id, this.postEffectOcclusion);
    }

    if (updates.emissiveIntensity !== undefined) {
      this.view.updateLayerEffects(
        this.id,
        this.view.getLayerEffects(this.id),
        updates.emissiveIntensity,
      );
      this.applyEffects();
    }

    if (updates.emissiveColor !== undefined) {
      this.view.setLayerEmissiveColor(this.id, updates.emissiveColor);
      this.applyEffects();
    }

    this.onPassKeyChange();
  }

  onPassKeyChange() {
    const nextPassKey = this.getPassKey();
    if (this.prevPassKey === nextPassKey) return;
    if (this.prevPassKey) {
      this.removeFromScene(this.prevPassKey);
    }
    this.prevPassKey = nextPassKey;
    this.addToScene(nextPassKey);
  }

  onDestroy(): void {
    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    super.onDestroy();
  }

  update?(time: number): void;

  onResize?(width: number, height: number): void;
}
