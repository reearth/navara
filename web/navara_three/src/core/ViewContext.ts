import type { Globe } from "@navara/core";
import { EventHandler } from "@navara/core";
import type { FontManager } from "@navara/font";
import type { ConcurrencyManager } from "@navara/worker";
import {
  Mesh,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from "three";

import type { Atmosphere } from "../atmosphere";
import { Color } from "../Color";
import type { LayersManager } from "../layersManager";
import type { RenderPassOrchestrator } from "../orchestrators";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

import type { EffectSlotRegistry } from "./EffectSlotRegistry";
import {
  getSelectiveEffectConfig,
  type SelectiveEffectHelper,
} from "./SelectiveEffectHelper";

/** Default emissive intensity when Bloom is enabled */
const DEFAULT_EMISSIVE_INTENSITY = 0.3;

type LayerEffectConfig = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: Color;
};

type Private = {
  meshes: MeshCache;
};

type ViewContextEvents = {
  unstableShadowApplied: (material: Material) => void;
  unstableShadowRemoved: (material: Material) => void;
};

// Restrict public API for a layer declaration.
export class ViewContext extends EventHandler<ViewContextEvents> {
  public selectiveEffectRegistry?: SelectiveEffectHelper;
  public effectSlotRegistry?: EffectSlotRegistry;
  public globe?: Globe;
  public fontManager?: FontManager;

  // Layer-level selective effect configuration
  private readonly layerEffectConfigs = new Map<string, LayerEffectConfig>();

  constructor(
    public scenes: Scenes,
    public camera: PerspectiveCamera,
    public atmosphere: Atmosphere,
    public layersManager: LayersManager,
    public renderPassOrchestrator: RenderPassOrchestrator,
    public concurrencyManager: ConcurrencyManager,
    public _privates: Private,
    selectiveEffectHelper?: SelectiveEffectHelper,
  ) {
    super();
    this.selectiveEffectRegistry = selectiveEffectHelper;
  }

  /**
   * Recompute effectIdsMask for all meshes in the MRT scene.
   * Called when EffectSlotRegistry changes (slot register/unregister) to ensure
   * masks stay in sync regardless of layer creation order.
   *
   * Handles both non-enhanced meshes (via material.userData) and enhanced meshes
   * (via selectiveEffectConfig stored by SelectiveEffectHelper).
   */
  recomputeEffectIdsMasks(): void {
    const registry = this.effectSlotRegistry;
    if (!registry) return;

    // Non-enhanced meshes: update material.userData.uEffectIdsMask
    this.scenes.mrt.traverse((obj) => {
      if (
        obj instanceof Mesh &&
        !Array.isArray(obj.material) &&
        obj.material?.userData?.uEffectIdsMask
      ) {
        const config = getSelectiveEffectConfig(obj);
        if (config) {
          obj.material.userData.uEffectIdsMask.value = registry.computeMask(
            config.effectIds,
          );
        }
      }
    });

    // Enhanced meshes (Model/Polygon): update via MeshCache
    for (const [, mesh] of this._privates.meshes) {
      if (hasGetEffectIds(mesh)) {
        const effectIds = mesh._getEffectIds();
        const mask = effectIds.length > 0 ? registry.computeMask(effectIds) : 0;
        if (hasGetEnhancer(mesh)) {
          // Polygon: single enhancer
          mesh.getEnhancer().update({ base: { effectIdsMask: mask } });
        } else if (hasEnhancers(mesh)) {
          // Model: multiple enhancers
          for (const enhancer of mesh._enhancers.values()) {
            enhancer.update({ base: { effectIdsMask: mask } });
          }
        }
      }
    }
  }

  setGlobe(globe: Globe) {
    this.globe = globe;
  }

  setCamera(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  applyShadowMaterial(material: Material): void {
    this.emit("unstableShadowApplied", material);
  }

  removeShadowMaterial(material: Material): void {
    this.emit("unstableShadowRemoved", material);
  }

  // --- Selective Effect layer config ---

  registerLayerEffects(
    layerId: string,
    effectIds: string[],
    emissiveIntensity?: number,
  ): void {
    const config = this.ensureLayerEffectConfig(layerId);
    config.effectIds = effectIds;
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
  }

  getLayerEffects(layerId: string): string[] | undefined {
    return this.layerEffectConfigs.get(layerId)?.effectIds;
  }

  setLayerEmissiveColor(
    layerId: string,
    emissiveColor: Color | undefined,
  ): void {
    const config = this.ensureLayerEffectConfig(layerId);
    config.emissiveColor = emissiveColor;
  }

  unregisterLayerEffects(layerId: string): void {
    this.layerEffectConfigs.delete(layerId);
  }

  updateLayerEffects(
    layerId: string,
    effectIds: string[] | undefined,
    emissiveIntensity?: number,
  ): void {
    const config = this.ensureLayerEffectConfig(layerId);
    config.effectIds = effectIds ?? [];
    if (emissiveIntensity !== undefined) {
      config.emissiveIntensity = emissiveIntensity;
    }
  }

  private ensureLayerEffectConfig(layerId: string): LayerEffectConfig {
    let config = this.layerEffectConfigs.get(layerId);
    if (!config) {
      config = {
        effectIds: [],
        emissiveIntensity: DEFAULT_EMISSIVE_INTENSITY,
      };
      this.layerEffectConfigs.set(layerId, config);
    }
    return config;
  }

  // --- Selective Effect object management ---

  /**
   * Apply selective effects to a specific Object3D.
   * Useful for pick-based effect application where you have a reference to the object.
   *
   * @param object - The Object3D to apply effects to
   * @param effectIds - Effect IDs to apply
   * @param layerId - Optional layer ID. Resolution order: argument > existing config > empty string
   */
  applyEffectToObject(
    object: Object3D,
    effectIds: string[],
    layerId?: string,
  ): void {
    const resolvedLayerId =
      layerId ?? getSelectiveEffectConfig(object)?.layerId;

    const prevEffectIds = getSelectiveEffectConfig(object)?.effectIds ?? [];
    this.selectiveEffectRegistry?.updateLinksForObject(
      object,
      effectIds,
      prevEffectIds,
      resolvedLayerId ?? "",
    );
  }
}

// --- Type guards for enhanced mesh duck-typing ---

type EffectIdsMesh = { _getEffectIds(): readonly string[] };
type EnhancerUpdatable = {
  update(p: { base: { effectIdsMask: number } }): void;
};
type PolygonLikeMesh = EffectIdsMesh & {
  getEnhancer(): EnhancerUpdatable;
};
type ModelLikeMesh = EffectIdsMesh & {
  _enhancers: Map<unknown, EnhancerUpdatable>;
};

function hasGetEffectIds(obj: unknown): obj is EffectIdsMesh {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Record<string, unknown>)._getEffectIds === "function"
  );
}

function hasGetEnhancer(obj: unknown): obj is PolygonLikeMesh {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).getEnhancer === "function"
  );
}

function hasEnhancers(obj: unknown): obj is ModelLikeMesh {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as Record<string, unknown>)._enhancers instanceof Map
  );
}
