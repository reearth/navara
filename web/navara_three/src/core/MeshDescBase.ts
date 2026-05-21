import type { BaseEventMap, XYZ } from "@navara/core";
import {
  Color as ThreeColor,
  type ColorRepresentation,
  Euler,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import { normalView, output, uniform } from "three/tsl";
import { NodeMaterial, type Node } from "three/webgpu";
import invariant from "tiny-invariant";

import { Color } from "../Color";
import type ThreeView from "../index";
import { setupNodeMaterialForMRT } from "../nodes/setupNodeMaterialForMRT";
import { arraysEqual } from "../utils";

import {
  BaseDesc,
  type BaseInstance,
  type BaseDescConfig,
  type BaseDescConfigUpdate,
} from "./BaseDesc";
import type { PassKey } from "./MeshDesc";
import type { ViewContext } from "./ViewContext";

/** Constructor-time config accepted by {@link MeshDescBase} subclasses. */
export type MeshDescBaseConfig = {
  type?: "mesh";
  /** Local translation. */
  position?: XYZ;
  /** Local scale. */
  scale?: XYZ;
  /** Local rotation (Euler XYZ). */
  rotation?: XYZ;
  /** Local matrix; replaces position/scale/rotation if set. */
  matrix?: Matrix4;
  /** World matrix; overrides local transform entirely. */
  matrixWorld?: Matrix4;
  /** When true, the mesh joins the picking pass. */
  pickable?: boolean;
  /** Selective-effect IDs (bloom/outline) this mesh contributes to. */
  effectIds?: string[];
} & BaseDescConfig;

/** Subset of {@link MeshDescBaseConfig} that can be applied after creation. */
export type MeshDescBaseUpdate = Pick<
  MeshDescBaseConfig,
  "position" | "scale" | "rotation" | "matrix" | "matrixWorld" | "effectIds"
> &
  BaseDescConfigUpdate;

/** Underlying Three.js instance shape returned by `createMesh()`. */
export type MeshDescBaseInstance<Instance extends object = object> =
  Instance extends Object3D
    ? Instance
    : Instance extends {
          raw: infer Raw extends Object3D;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : Instance & BaseInstance;

/**
 * TSL-only base for mesh descriptors. Replaces
 * {@link MeshDesc} / {@link MeshDescWithSelectiveEffect} for NodeMaterial
 * meshes. Owns the per-MRT-slot inputs and rewires every NodeMaterial it
 * finds on the mesh into Navara's outputStruct.
 */
export abstract class MeshDescBase<
  Config extends MeshDescBaseConfig = MeshDescBaseConfig,
  UpdateConfig extends MeshDescBaseUpdate = MeshDescBaseUpdate,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends MeshDescBaseInstance<InstanceObj> =
    MeshDescBaseInstance<InstanceObj>,
> extends BaseDesc<Config, UpdateConfig, Instance, CustomEvent> {
  public position?: XYZ;
  public scale?: XYZ;
  public rotation?: XYZ;
  public matrix?: Matrix4;
  public matrixWorld?: Matrix4;
  /** Resolved value of {@link MeshDescBaseConfig.pickable}. */
  public readonly pickingEnabled: boolean;

  private readonly _emissive = uniform(new ThreeColor(0x000000));
  private readonly _emissiveIntensity = uniform(0);
  private readonly _roughness = uniform(0);
  private readonly _metalness = uniform(0);
  private readonly _effectIdsMask = uniform(0);
  private _normalNode: Node<"vec3"> = normalView;
  private _colorOutputNode: Node<"vec4"> = output;

  protected _effectIds: string[] = [];

  private prevPassKey?: PassKey;
  private _onSlotsChanged = () => this.updateEffectIdsMask();

  constructor(view: ThreeView, ctx: ViewContext, config?: Config) {
    const resolvedConfig = config ?? ({} as Config);
    super(view, ctx, resolvedConfig);
    this.position = resolvedConfig.position;
    this.scale = resolvedConfig.scale;
    this.rotation = resolvedConfig.rotation;
    this.matrix = resolvedConfig.matrix;
    this.matrixWorld = resolvedConfig.matrixWorld;
    this.pickingEnabled = resolvedConfig.pickable ?? false;
    this._effectIds = resolvedConfig.effectIds ?? [];
  }

  /** Factory for the underlying Three.js instance. */
  abstract createMesh(): Instance;

  /** The underlying Three.js {@link Object3D} (undefined before `onCreate`). */
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

  /** Render scene the mesh joins. Override to opt into `draped`/`opaque`/`transparent`. */
  protected getPassKey(): PassKey {
    return "mrt";
  }

  onCreate() {
    this._instance = this.createMesh();
    invariant(this.raw);

    this.applyTransform();
    this._instance.visible = this.visible;
    this.onPassKeyChange();

    this.ctx.on("effectSlotsChanged", this._onSlotsChanged);

    for (const material of this.extractNodeMaterial()) {
      this.setupNodeMaterial(material);
    }

    this.updateEffectIdsMask();
  }

  /** Override for non-`Mesh` shapes (e.g. `Group`s). */
  protected extractNodeMaterial(): NodeMaterial[] {
    const raw = this.raw;
    if (!(raw instanceof Mesh)) return [];
    const m = raw.material;
    const list = Array.isArray(m) ? m : [m];
    return list.filter((x): x is NodeMaterial => x instanceof NodeMaterial);
  }

  /** Wire one NodeMaterial into the MRT outputStruct using this base's inputs. */
  protected setupNodeMaterial(material: NodeMaterial): void {
    setupNodeMaterialForMRT(material, {
      colorNode: this._colorOutputNode,
      normalNode: this._normalNode,
      roughnessNode: this._roughness,
      metalnessNode: this._metalness,
      emissiveNode: this._emissive.rgb,
      emissiveIntensityNode: this._emissiveIntensity,
      effectIdsMaskNode: this._effectIdsMask,
    });
  }

  /** Re-run {@link setupNodeMaterial} on every attached NodeMaterial. */
  protected refreshNodeMaterial(): void {
    for (const material of this.extractNodeMaterial()) {
      this.setupNodeMaterial(material);
    }
  }

  /**
   * Emissive color fed into the MRT emissive slot. Drives this slot
   * independent of the underlying material's `emissive` property, so subclasses
   * can route their own config without coupling to a specific NodeMaterial subtype.
   */
  get emissive(): ThreeColor {
    return this._emissive.value;
  }
  set emissive(value: ColorRepresentation | Color) {
    this._emissive.value.set(value instanceof Color ? value.raw : value);
  }

  /** Multiplier on `diffuseColor.rgb` for the MRT emissive slot. */
  get emissiveIntensity(): number {
    return this._emissiveIntensity.value;
  }
  set emissiveIntensity(value: number) {
    this._emissiveIntensity.value = value;
  }

  /** Roughness written to the MRT normal slot's `.w` channel. */
  get roughness(): number {
    return this._roughness.value;
  }
  set roughness(value: number) {
    this._roughness.value = value;
  }

  /**
   * Metalness written to the MRT normal slot's `.z` channel. Non-PBR materials
   * reuse this slot as reflectivity — matches `injectGBuffer`.
   */
  get metalness(): number {
    return this._metalness.value;
  }
  set metalness(value: number) {
    this._metalness.value = value;
  }

  /**
   * View-space normal fed into the MRT normal slot (packed octahedrally).
   * Reassigning a Node (vs uniform `.value`) changes graph topology, so the
   * setter rebuilds the outputStruct.
   */
  get normalNode(): Node<"vec3"> {
    return this._normalNode;
  }
  set normalNode(node: Node<"vec3">) {
    this._normalNode = node;
    this.refreshNodeMaterial();
  }

  /**
   * Final vec4 written to the MRT color slot (location 0). Exists alongside
   * `material.colorNode` because picking has to swap the *entire* lit output
   * for a batchId color during the picking pass — which the standard
   * `colorNode` (a lit-input hook) cannot express.
   */
  get colorOutputNode(): Node<"vec4"> {
    return this._colorOutputNode;
  }
  set colorOutputNode(node: Node<"vec4">) {
    this._colorOutputNode = node;
    this.refreshNodeMaterial();
  }

  /** Recompute the effectIds bitmask uniform feeding the MRT effectId slot. */
  protected updateEffectIdsMask(): void {
    const registry = this.ctx.selectiveEffectRegistry;
    if (!registry) return;
    const mask =
      this._effectIds.length > 0 ? registry.computeMask(this._effectIds) : 0;
    this._effectIdsMask.value = mask;
  }

  protected composeLocalTransform(): Matrix4 {
    const local = new Matrix4();
    if (this.position) {
      local.multiply(
        new Matrix4().makeTranslation(
          this.position.x,
          this.position.y,
          this.position.z,
        ),
      );
    }
    if (this.rotation) {
      local.multiply(
        new Matrix4().makeRotationFromEuler(
          new Euler(this.rotation.x, this.rotation.y, this.rotation.z),
        ),
      );
    }
    if (this.scale) {
      local.scale(new Vector3(this.scale.x, this.scale.y, this.scale.z));
    }
    return local;
  }

  private applyTransform(): void {
    invariant(this.raw);
    const hasLocal =
      this.position != null || this.rotation != null || this.scale != null;

    if (this.matrixWorld) {
      this.raw.matrixAutoUpdate = false;
      this.raw.matrixWorldAutoUpdate = false;
      if (hasLocal) {
        this.raw.matrixWorld.multiplyMatrices(
          this.matrixWorld,
          this.composeLocalTransform(),
        );
      } else {
        this.raw.matrixWorld.copy(this.matrixWorld);
      }
      this.raw.updateMatrixWorld();
      return;
    }

    if (this.matrix) {
      this.raw.matrixAutoUpdate = false;
      if (hasLocal) {
        this.raw.matrix.multiplyMatrices(
          this.matrix,
          this.composeLocalTransform(),
        );
      } else {
        this.raw.matrix.copy(this.matrix);
      }
      return;
    }

    if (this.position) this.raw.position.copy(this.position);
    if (this.scale) this.raw.scale.copy(this.scale);
    if (this.rotation)
      this.raw.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
  }

  /** Remove `raw` from the scene attached to {@link passKey}. */
  removeFromScene(passKey: PassKey) {
    const scenes = this.ctx.scenes;
    if (scenes[passKey] && this.raw) {
      scenes[passKey].remove(this.raw);
    }
  }

  /** Add `raw` to the scene attached to {@link passKey}. */
  addToScene(passKey: PassKey) {
    if (!this.raw) return;
    const scenes = this.ctx.scenes;
    if (scenes[passKey]) {
      scenes[passKey].add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
    let effectIdsChanged = false;
    if (updates.effectIds !== undefined) {
      const nextEffectIds = updates.effectIds ?? [];
      if (!arraysEqual(this._effectIds, nextEffectIds)) {
        this._effectIds = [...nextEffectIds];
        effectIdsChanged = true;
      }
    }

    super.onUpdateConfig(updates);
    invariant(this.raw);

    const spatialChanged =
      updates.matrix !== undefined ||
      updates.matrixWorld !== undefined ||
      updates.position !== undefined ||
      updates.scale !== undefined ||
      updates.rotation !== undefined;

    if (updates.matrix !== undefined) this.matrix = updates.matrix;
    if (updates.matrixWorld !== undefined)
      this.matrixWorld = updates.matrixWorld;
    if (updates.position !== undefined) this.position = updates.position;
    if (updates.scale !== undefined) this.scale = updates.scale;
    if (updates.rotation !== undefined) this.rotation = updates.rotation;

    if (spatialChanged) {
      if (this.matrixWorld || this.matrix) {
        this.applyTransform();
      } else {
        if (updates.position !== undefined) {
          this.raw.position.copy(updates.position);
        }
        if (updates.scale !== undefined) {
          this.raw.scale.copy(updates.scale);
        }
        if (updates.rotation !== undefined) {
          this.raw.rotation.set(
            updates.rotation.x,
            updates.rotation.y,
            updates.rotation.z,
          );
        }
      }
    }

    this.onPassKeyChange();

    if (effectIdsChanged) {
      this.updateEffectIdsMask();
    }
  }

  /** Re-evaluate {@link getPassKey} and move the mesh between scenes if needed. */
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
    this.ctx.off("effectSlotsChanged", this._onSlotsChanged);
    this._effectIds = [];

    if (this.raw && this.raw.parent) {
      this.raw.parent.remove(this.raw);
    }

    super.onDestroy();
  }

  /** Optional per-frame animation callback. */
  update?(time: number): void;
  /** Optional viewport-resize callback. */
  onResize?(width: number, height: number): void;
}
