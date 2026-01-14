import type { BaseEventMap, XYZ } from "@navara/core";
import { Mesh, Object3D, type Material } from "three";

import type { Scenes } from "../scene";
import { arraysEqual } from "../utils";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import {
  type SelectiveEffectOcclusion,
  parseSelectiveEffectOcclusion,
  getSelectiveEffectConfig,
} from "./SelectiveEffectHelper";
import {
  getMaskPassContext,
  MaskPassPhase,
  evaluateMaskPassParticipation,
  applyMaskPassSkipState,
  applyMaskPassRenderState,
  restoreMaterialState,
} from "./SelectiveEffectMaskContext";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type: "mesh";
  position?: XYZ;
  scale?: XYZ;
  rotation?: XYZ;
  effectIds?: string[];
  selectiveEffectOcclusion?: SelectiveEffectOcclusion;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "scale" | "rotation"
> &
  LayerDeclarationConfigUpdate & {
    effectIds?: string[];
    selectiveEffectOcclusion?: SelectiveEffectOcclusion;
  };

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
  private _effectIds: string[] = [];
  private _selectiveEffectOcclusion?: SelectiveEffectOcclusion;

  constructor(view: ViewContext, config: Config = {} as Config) {
    super(view, config);
    this.position = config.position;
    this.scale = config.scale;
    this.rotation = config.rotation;
    this._effectIds = config.effectIds ?? [];
    this._selectiveEffectOcclusion = config.selectiveEffectOcclusion;
  }

  protected getPassKey(): PassKey {
    // Meshes with SelectiveEffect (effectIds) need to be in MRT scene for mask rendering
    if (this._effectIds.length > 0) {
      return "mrt";
    }
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

    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds / occlusion wiring
    // ----------------------------------------------------------------------------
    if (this._effectIds.length > 0 && this.raw) {
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        this._effectIds,
        [],
        this.id,
      );
    }

    // Register initial selectiveEffectOcclusion via ViewContext (Manager is SoT)
    if (this._selectiveEffectOcclusion !== undefined) {
      const occlusion = parseSelectiveEffectOcclusion(
        this._selectiveEffectOcclusion,
      );
      if (occlusion !== undefined) {
        this.view.setLayerSelectiveEffectOcclusion(this.id, occlusion);
      }
    }

    // Setup onBeforeRender for MaskPass context-based rendering
    this.setupMeshOnBeforeRender();

    this.onPassKeyChange();
  }

  /**
   * Setup onBeforeRender callback for MaskPass context-based rendering.
   * This enables Box, Sphere, and other standard meshes to participate in mask rendering.
   */
  private setupMeshOnBeforeRender(): void {
    const raw = this.raw;
    if (!raw) return;

    // Store original onBeforeRender if exists
    const originalOnBeforeRender = raw.onBeforeRender;

    raw.onBeforeRender = (
      renderer,
      scene,
      camera,
      geometry,
      material,
      group,
    ) => {
      // Call original if exists
      if (originalOnBeforeRender) {
        originalOnBeforeRender.call(
          raw,
          renderer,
          scene,
          camera,
          geometry,
          material,
          group,
        );
      }

      // Check MaskPassContext
      const ctx = getMaskPassContext();

      // Get material from mesh (use meshMaterial to avoid conflict with callback parameter)
      if (!(raw instanceof Mesh)) return;
      const meshMaterial = raw.material as Material;
      if (!meshMaterial) return;

      if (ctx.phase !== MaskPassPhase.BaseMRT) {
        // Not in mask pass - restore normal state
        restoreMaterialState(meshMaterial);
        return;
      }

      // Evaluate mask pass participation using shared helper
      const config = getSelectiveEffectConfig(raw);
      const registry = ctx.registry ?? this.view.selectiveEffectRegistry;
      const evaluation = evaluateMaskPassParticipation(
        config,
        registry,
        this.id,
        ctx,
      );

      // Apply appropriate render state
      if (evaluation.shouldRender) {
        applyMaskPassRenderState(meshMaterial, evaluation.isSilhouette);
      } else {
        applyMaskPassSkipState(meshMaterial);
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

    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds / occlusion wiring
    // ----------------------------------------------------------------------------
    if (updates.effectIds !== undefined && this.raw) {
      const prevEffectIds = this._effectIds;
      const nextEffectIds = updates.effectIds ?? [];

      if (!arraysEqual(prevEffectIds, nextEffectIds)) {
        this.view.selectiveEffectRegistry?.updateLinksForObject(
          this.raw,
          nextEffectIds,
          prevEffectIds,
          this.id,
        );
        this._effectIds = [...nextEffectIds];
      }
    }

    // Update selectiveEffectOcclusion
    if (updates.selectiveEffectOcclusion !== undefined) {
      this._selectiveEffectOcclusion = updates.selectiveEffectOcclusion;
      const occlusion = parseSelectiveEffectOcclusion(
        updates.selectiveEffectOcclusion,
      );
      if (occlusion !== undefined) {
        this.view.setLayerSelectiveEffectOcclusion(this.id, occlusion);
      }
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
    // ----------------------------------------------------------------------------
    // SelectiveEffect: effectIds cleanup
    // ----------------------------------------------------------------------------
    if (this._effectIds.length > 0 && this.raw) {
      this.view.selectiveEffectRegistry?.updateLinksForObject(
        this.raw,
        [],
        this._effectIds,
        this.id,
      );
      this._effectIds = [];
    }

    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    super.onDestroy();
  }

  update?(time: number): void;

  onResize?(width: number, height: number): void;
}
