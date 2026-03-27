import type { BaseEventMap, XYZ } from "@navara/core";
import { Matrix4, Object3D } from "three";
import invariant from "tiny-invariant";

import type { Scenes } from "../scene";

import {
  LayerDeclaration,
  type BaseInstance,
  type LayerDeclarationConfig,
  type LayerDeclarationConfigUpdate,
} from "./LayerDeclaration";
import type { ViewContext } from "./ViewContext";

export type MeshLayerConfig = {
  type: "mesh";
  position?: XYZ;
  scale?: XYZ;
  rotation?: XYZ;
  matrix?: Matrix4;
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
 *   constructor(view: ViewContext, config: MyMeshConfig) {
 *     super(view, config);
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
 *       this.view.applyShadowMaterial(material);
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
 * const handle = view.addLayer<MyMeshLayer>({
 *   type: "mesh",
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
 *
 * ## Lifecycle
 *
 * 1. **Construction** - The layer is instantiated with the view context and config.
 * 2. **{@link createMesh}** - Called during {@link onCreate} to create the Three.js object.
 *    The base class applies position/scale/rotation and adds it to the scene
 *    determined by {@link getPassKey}.
 * 3. **{@link onUpdateConfig}** - Called when `handle.update()` is invoked. The base class
 *    handles `visible`, `position`, `scale`, and `rotation`; override to handle your
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

  constructor(view: ViewContext, config?: Config) {
    const resolvedConfig = config ?? ({} as Config);
    super(view, resolvedConfig);
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
   * Override this to return your custom mesh. The returned object can be either:
   * - A Three.js `Object3D` directly (e.g. `Mesh`, `Group`, `Points`)
   * - A wrapper object with a `raw` property containing the `Object3D`
   *
   * The base class calls this during {@link onCreate} and automatically applies
   * position, scale, rotation, and adds the object to the appropriate scene.
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

    if (this.matrixWorld) {
      this.raw.matrixAutoUpdate = false;
      this.raw.matrixWorldAutoUpdate = false;
      this.raw.matrixWorld.copy(this.matrixWorld);
    }
    if (this.matrix) {
      this.raw.matrixAutoUpdate = false;
      this.raw.matrix.copy(this.matrix);
    }
    if (this.position) this.raw.position.copy(this.position);
    if (this.scale) this.raw.scale.copy(this.scale);
    if (this.rotation)
      this.raw.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);

    this._instance.visible = this.visible;

    this.onPassKeyChange();
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
    invariant(this.raw);

    if (updates.matrixWorld) {
      this.raw.matrixAutoUpdate = false;
      this.raw.matrixWorldAutoUpdate = false;
      this.raw.matrixWorld.copy(updates.matrixWorld);
    }
    if (updates.matrix) {
      this.raw.matrixAutoUpdate = false;
      this.raw.matrix.copy(updates.matrix);
    }
    if (updates.matrixWorld !== undefined)
      this.matrixWorld = updates.matrixWorld;
    if (updates.matrix !== undefined) this.matrix = updates.matrix;
    if (updates.position !== undefined) {
      this.position = updates.position;
      this.raw.position.copy(updates.position);
    }
    if (updates.scale !== undefined) {
      this.scale = updates.scale;
      this.raw.scale.copy(updates.scale);
    }
    if (updates.rotation !== undefined) {
      this.rotation = updates.rotation;
      this.raw.rotation.set(
        updates.rotation.x,
        updates.rotation.y,
        updates.rotation.z,
      );
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
