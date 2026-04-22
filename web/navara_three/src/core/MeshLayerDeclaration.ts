import type { BaseEventMap, XYZ } from "@navara/core";
import { Euler, Matrix4, Object3D, Vector3 } from "three";
import invariant from "tiny-invariant";

import type ThreeView from "../index";
import type { Scenes } from "../scene";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type?: "mesh";
  /**
   * Local translation. When `matrix` or `matrixWorld` is also set, this is
   * treated as an offset *inside* that frame (left-multiplied by the frame).
   * Otherwise it's applied directly as `Object3D.position`.
   */
  position?: XYZ;
  /**
   * Local scale. See {@link position} for interaction with `matrix` / `matrixWorld`.
   */
  scale?: XYZ;
  /**
   * Local Euler rotation (XYZ order). See {@link position} for interaction
   * with `matrix` / `matrixWorld`.
   */
  rotation?: XYZ;
  /**
   * Local frame. When combined with `position` / `rotation` / `scale`, the
   * effective local matrix is `matrix · T(position) · R(rotation) · S(scale)`.
   * Disables Three.js's auto matrix update.
   */
  matrix?: Matrix4;
  /**
   * World frame (e.g. an NUE-to-ECEF tangent frame on the globe). When
   * combined with `position` / `rotation` / `scale`, the effective world
   * matrix is `matrixWorld · T(position) · R(rotation) · S(scale)`, so the
   * offset fields are interpreted in the frame's local coordinates.
   * Disables Three.js's auto matrix-world update.
   */
  matrixWorld?: Matrix4;
} & LayerDeclarationConfig;

export type MeshLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "scale" | "rotation" | "matrix" | "matrixWorld"
> &
  LayerDeclarationConfigUpdate;

export type PassKey = keyof Pick<
  Scenes,
  "opaque" | "transparent" | "mrt" | "skyEnvMap" | "draped"
>;

export type MeshBaseInstance<Instance extends object = object> =
  Instance extends Object3D
    ? Instance
    : Instance extends {
          raw: infer Raw extends Object3D;
        }
      ? Instance & { raw: Raw } & BaseInstance
      : Instance & BaseInstance;

/**
 * Abstract base class for creating custom mesh layers.
 *
 * Extend this class to add custom Three.js 3D objects (meshes, groups, particles, etc.)
 * to the Navara scene. The base class handles position/scale/rotation synchronization
 * and automatic scene management via {@link getPassKey}.
 *
 * ## Implementing a Custom Mesh Layer
 *
 * ### 1. Define configuration types
 *
 * Create a description type for your mesh-specific options, then merge it with the
 * base config and update types:
 *
 * ```typescript
 * type MyMeshDescription = {
 *   myMesh?: {
 *     radius?: number;
 *     color?: Color;
 *     castShadow?: boolean;
 *   };
 * };
 *
 * type MyMeshConfig = MeshLayerConfig & MyMeshDescription;
 * type MyMeshUpdate = MeshLayerUpdate & MyMeshDescription;
 * ```
 *
 * ### 2. Extend `MeshLayerDeclaration`
 *
 * Implement the {@link createMesh} factory method. Optionally override
 * {@link getPassKey} to control which render scene the mesh belongs to,
 * {@link onUpdateConfig} for dynamic updates, and {@link update} for animation.
 *
 * ```typescript
 * class MyMeshLayer extends MeshLayerDeclaration<
 *   MyMeshConfig,
 *   MyMeshUpdate,
 *   Mesh<SphereGeometry, MeshStandardMaterial>
 * > {
 *   private config: MyMeshConfig;
 *
 *   constructor(view: ThreeView, ctx: ViewContext, config: MyMeshConfig) {
 *     super(view, ctx, config);
 *     this.config = config;
 *   }
 *
 *   createMesh() {
 *     const cfg = this.config.myMesh ?? {};
 *     const geometry = new SphereGeometry(cfg.radius ?? 1);
 *     const material = new MeshStandardMaterial({
 *       color: cfg.color?.raw ?? 0xffffff,
 *     });
 *     const mesh = new Mesh(geometry, material);
 *     mesh.castShadow = cfg.castShadow ?? false;
 *
 *     // Enable CSM shadows if needed
 *     if (mesh.castShadow) {
 *       this.ctx.applyShadowMaterial(material);
 *     }
 *
 *     return mesh;
 *   }
 *
 *   onUpdateConfig(updates: MyMeshUpdate): void {
 *     if (updates.myMesh && this._instance) {
 *       if (updates.myMesh.color !== undefined) {
 *         this._instance.material.color.set(updates.myMesh.color.raw);
 *       }
 *       this.emit("needsUpdate");
 *     }
 *     super.onUpdateConfig(updates);
 *   }
 * }
 * ```
 *
 * ### 3. Register and use the layer
 *
 * ```typescript
 * view.registerMesh("myMesh", MyMeshLayer);
 *
 * const handle = view.addMesh<MyMeshLayer>({
 *   position: { x: 0, y: 100, z: 0 },
 *   scale: { x: 10, y: 10, z: 10 },
 *   rotation: { x: 0, y: Math.PI / 4, z: 0 },
 *   myMesh: { radius: 5, color: new Color("#00ff00") },
 * });
 *
 * // Update dynamically
 * handle.update({ myMesh: { color: new Color("#ff0000") } });
 *
 * // Access the raw Three.js object for direct manipulation
 * const mesh = handle.ref.raw;
 *
 * // Animate on every frame
 * view.on("preUpdate", (time) => {
 *   mesh.rotation.y += 0.01;
 * });
 *
 * // Remove the layer
 * handle.delete();
 * ```
 *
 * ## Render Scenes (Pass Keys)
 *
 * Override {@link getPassKey} to control which render scene the mesh is added to:
 * - `"opaque"` (default) - Standard opaque rendering with depth testing.
 * - `"transparent"` - Transparent rendering pass.
 * - `"mrt"` - Multiple Render Target scene, used for selective effects (bloom, outline).
 * - `"skyEnvMap"` - Sky environment map scene.
 * - `"draped"` - This is only for `DrapedMesh`. The mesh is clamped to the terrain.
 *
 * ## Lifecycle
 *
 * 1. **Construction** - The layer is instantiated with the view context and config.
 * 2. **{@link createMesh}** - Called during {@link onCreate} to create the Three.js object.
 *    The base class applies position/scale/rotation and adds it to the scene
 *    determined by {@link getPassKey}.
 * 3. **{@link onUpdateConfig}** - Called when `handle.update()` is invoked. The base class
 *    handles `visible`, `matrix`, `matrixWorld`, `position`, `scale`, and `rotation`; override to handle your
 *    custom properties. Always call `super.onUpdateConfig(updates)`.
 * 4. **{@link update}** - Optional per-frame callback for animation.
 * 5. **{@link onResize}** - Optional callback when the viewport is resized.
 * 6. **{@link onDestroy}** - Called on `handle.delete()`. The base class removes the mesh
 *    from its parent scene. Override to dispose geometry/material resources.
 *
 * @see The `custom-shader` example page for a complete custom mesh layer tutorial using
 *      MarchingCubes with a custom shader material.
 *
 * @typeParam Config - Layer configuration type (extends {@link MeshLayerConfig})
 * @typeParam UpdateConfig - Updatable properties (extends {@link MeshLayerUpdate})
 * @typeParam InstanceObj - The Three.js Object3D type or a wrapper with a `raw` property
 * @typeParam CustomEvent - Additional custom events the layer can emit
 * @typeParam Instance - Resolved instance type (inferred automatically)
 */
export abstract class MeshLayerDeclaration<
  Config extends MeshLayerConfig = MeshLayerConfig,
  UpdateConfig extends MeshLayerUpdate = MeshLayerUpdate,
  InstanceObj extends Object3D | { raw: Object3D } =
    | Object3D
    | { raw: Object3D },
  CustomEvent extends BaseEventMap = BaseEventMap,
  Instance extends MeshBaseInstance<InstanceObj> =
    MeshBaseInstance<InstanceObj>,
> extends LayerDeclaration<Config, UpdateConfig, Instance, CustomEvent> {
  public position?: XYZ;
  public scale?: XYZ;
  public rotation?: XYZ;
  public matrix?: Matrix4;
  public matrixWorld?: Matrix4;
  private prevPassKey?: PassKey;

  constructor(view: ThreeView, ctx: ViewContext, config?: Config) {
    const resolvedConfig = config ?? ({} as Config);
    super(view, ctx, resolvedConfig);
    this.position = resolvedConfig.position;
    this.scale = resolvedConfig.scale;
    this.rotation = resolvedConfig.rotation;
    this.matrix = resolvedConfig.matrix;
    this.matrixWorld = resolvedConfig.matrixWorld;
  }

  /**
   * Determines which render scene the mesh is added to.
   * Override this to change the rendering pass for your mesh.
   *
   * @returns The pass key: `"opaque"` (default), `"transparent"`, `"mrt"`, or `"skyEnvMap"`.
   */
  protected getPassKey(): PassKey {
    return "opaque";
  }

  /**
   * Factory method to create the Three.js 3D object.
   *
   * Override this to return your custom mesh. The returned object can be
   * either a Three.js `Object3D` directly (e.g. `Mesh`, `Group`, `Points`) or
   * a wrapper object with a `raw` property containing the `Object3D`.
   *
   * The base class calls this during {@link onCreate} and automatically
   * applies position, scale, rotation, and adds the object to the appropriate
   * scene. Picking is opt-in: if your layer supports it, construct a
   * {@link PickableMesh} here and register it yourself via
   * `this.ctx.registerPickableMesh(this.id, wrapper)` before returning.
   */
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
    invariant(this.raw);

    this.applyTransform();

    this._instance.visible = this.visible;

    this.onPassKeyChange();
  }

  /**
   * Composes position, rotation, and scale into a local `T · R · S` matrix.
   * Returns identity when none are set.
   */
  private composeLocalTransform(): Matrix4 {
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

  /**
   * Applies the configured transform to the underlying `Object3D`.
   *
   * When `matrixWorld` (or `matrix`) is set together with any of
   * `position` / `rotation` / `scale`, the base/frame is left-multiplied
   * by the local `T · R · S`: e.g. `effective = matrixWorld · T · R · S`.
   * This lets callers pass a frame (such as an NUE-to-ECEF matrix) as
   * `matrixWorld` and express offsets inside that frame via
   * `position` / `rotation` / `scale`.
   */
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

  removeFromScene(passKey: PassKey) {
    const scenes = this.ctx.scenes;

    if (scenes[passKey] && this.raw) {
      scenes[passKey].remove(this.raw);
    }
  }

  addToScene(passKey: PassKey) {
    if (!this.raw) return;

    const scenes = this.ctx.scenes;

    if (scenes[passKey]) {
      scenes[passKey].add(this.raw);
    }
  }

  onUpdateConfig(updates: UpdateConfig): void {
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
      // With a frame present, the effective transform depends on the
      // combination of all stored fields — recompose the whole thing.
      // Without a frame, apply only the fields that were actually passed,
      // so subclasses that strip a field from `updates` (e.g. GLTFModelLayer
      // keeping `raw.position` at 0 for its RTE shader) can still opt out
      // of having the base class copy it onto `raw`.
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

  /**
   * Optional per-frame update callback.
   * Override this to animate the mesh (e.g. rotation, morph targets, shader uniforms).
   * @param time - High-resolution timestamp from the main render loop (same value passed
   *   to `requestAnimationFrame`), in milliseconds.
   */
  update?(time: number): void;

  /**
   * Optional callback when the viewport is resized.
   * Override this to adjust the mesh based on viewport dimensions.
   * @param width - New viewport width in pixels.
   * @param height - New viewport height in pixels.
   */
  onResize?(width: number, height: number): void;
}
