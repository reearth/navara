import {
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  type Vector2,
} from "three";
import {
  Fn,
  attribute,
  floor,
  mod,
  select,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";

import type { ViewContext } from "../core/ViewContext";
import { PickableMesh } from "../mesh/pickableMesh";

/**
 * TSL port of `nvr_batchIdToColor` from `shaders/glsl/chunks/pick.glsl`. The
 * encoding must round-trip identically to the GLSL version because the pick
 * helper reads the texel back on the CPU side.
 */
const batchIdToColor = Fn(([batchId]: [Node<"float">]) => {
  const r = floor(batchId.div(65536.0));
  const g = floor(mod(batchId.div(256.0), 256.0));
  const b = floor(mod(batchId, 256.0));
  return vec3(r, g, b).div(255.0);
}).setLayout({
  name: "batchIdToColor",
  type: "vec3",
  inputs: [{ name: "batchId", type: "float" }],
});

/**
 * Turnkey {@link PickableMesh} implementation for {@link NodeMaterial}-backed
 * meshes.
 *
 * Unlike {@link PickableMeshWrapper}, this does NOT inject GLSL via
 * `onBeforeCompile` — TSL materials don't expose that escape hatch. Instead
 * the caller wraps their base color with {@link wrapColor} when configuring
 * the MRT output. During the pick pass `onBeforePicking` flips the shared
 * uniform and the wrapped color expression resolves to the encoded batchId.
 */
export class PickableNodeMaterialWrapper
  extends Object3D
  implements PickableMesh
{
  public readonly batchId: number;
  private readonly uPickable = uniform(false);
  private readonly uBatchId = uniform(0);

  constructor(
    public object: Object3D,
    ctx: ViewContext,
  ) {
    super();
    this.batchId = ctx.genGlobalBatchId() ?? 0;
    this.uBatchId.value = this.batchId;
  }

  /**
   * Wrap a base color node with the picking override. Pass the result to
   * {@link setupNodeMaterialForMRT} as `colorNode`.
   */
  wrapColor(baseColor: Node<"vec4">): Node<"vec4"> {
    const picked = vec4(batchIdToColor(this.uBatchId), 1.0);
    return select(this.uPickable, picked, baseColor);
  }

  onBeforePicking(_pickingCoord?: Vector2): void {
    this.uPickable.value = true;
  }

  onAfterPicking(): void {
    this.uPickable.value = false;
  }

  getRenderable(): Object3D {
    return this.object;
  }
}

/**
 * Abstract base for TSL instanced picking wrappers. Owns the `batchIds` array,
 * `uPickable` uniform, `wrapColor` node, and all array-mutation methods
 * (`addInstance` / `removeInstanceAt` / `clearInstances` / `replaceAll`).
 *
 * Subclasses provide only the geometry-side attribute writes via
 * {@link syncBatchIdAttributes}.
 */
abstract class PickableInstancedNodeMaterialBase
  extends Object3D
  implements PickableMesh
{
  public batchIds: number[];
  protected readonly uPickable = uniform(false);

  constructor(
    initialCount: number,
    protected readonly ctx: ViewContext,
  ) {
    super();
    this.batchIds = Array.from(
      { length: initialCount },
      () => ctx.genGlobalBatchId() ?? 0,
    );
  }

  /**
   * Wrap a base color node with the picking override. Reads the per-instance
   * `batchId` attribute (written on the geometry by the subclass) and switches
   * to the encoded batchId color during the pick pass.
   */
  wrapColor(baseColor: Node<"vec4">): Node<"vec4"> {
    const batchIdAttr = attribute<"float">("batchId", "float");
    const picked = vec4(batchIdToColor(batchIdAttr), 1.0);
    return select(this.uPickable, picked, baseColor);
  }

  /** Allocate a batchId for a new instance and refresh attributes. */
  addInstance(): number {
    const id = this.ctx.genGlobalBatchId() ?? 0;
    this.batchIds.push(id);
    this.syncBatchIdAttributes();
    return id;
  }

  /** Remove an instance by index (swap-with-last, O(1)). */
  removeInstanceAt(index: number): void {
    const last = this.batchIds.length - 1;
    if (index < 0 || index > last) return;
    if (index !== last) this.batchIds[index] = this.batchIds[last];
    this.batchIds.pop();
    this.syncBatchIdAttributes();
  }

  /** Drop all instance batchIds. */
  clearInstances(): void {
    this.batchIds = [];
    this.syncBatchIdAttributes();
  }

  /** Regenerate `count` fresh batchIds and refresh attributes. */
  replaceAll(count: number): number[] {
    this.batchIds = Array.from(
      { length: count },
      () => this.ctx.genGlobalBatchId() ?? 0,
    );
    this.syncBatchIdAttributes();
    return this.batchIds;
  }

  onBeforePicking(_pickingCoord?: Vector2): void {
    this.uPickable.value = true;
  }

  onAfterPicking(): void {
    this.uPickable.value = false;
  }

  /** Write the current `batchIds` array into the geometry attribute(s). */
  protected abstract syncBatchIdAttributes(): void;

  abstract getRenderable(): Object3D;
}

/**
 * TSL counterpart of {@link PickableInstancedMeshWrapper}. Manages a
 * per-instance `batchId` {@link InstancedBufferAttribute} on a single
 * `InstancedMesh` geometry.
 *
 * Lifecycle methods mirror the GLSL wrapper so a subclass like
 * `NewInstancedMeshDesc` can call them from the same `onInstance*` hooks.
 */
export class PickableInstancedNodeMaterialWrapper extends PickableInstancedNodeMaterialBase {
  private batchIdAttr: InstancedBufferAttribute | null = null;

  constructor(
    public mesh: InstancedMesh,
    initialCount: number,
    ctx: ViewContext,
  ) {
    super(initialCount, ctx);
    this.syncBatchIdAttributes();
  }

  /** Re-attach bookkeeping after the underlying `InstancedMesh` was replaced. */
  syncMesh(mesh: InstancedMesh): void {
    this.mesh = mesh;
    this.batchIdAttr = null;
    this.syncBatchIdAttributes();
  }

  protected syncBatchIdAttributes(): void {
    const count = this.mesh.instanceMatrix.count;
    const len = Math.min(this.batchIds.length, count);

    if (this.batchIdAttr && this.batchIdAttr.array.length >= count) {
      const arr = this.batchIdAttr.array as Float32Array;
      arr.fill(0);
      for (let i = 0; i < len; i++) arr[i] = this.batchIds[i] ?? 0;
      this.batchIdAttr.needsUpdate = true;
    } else {
      const data = new Float32Array(count);
      for (let i = 0; i < len; i++) data[i] = this.batchIds[i] ?? 0;
      this.batchIdAttr = new InstancedBufferAttribute(data, 1);
      this.mesh.geometry.setAttribute("batchId", this.batchIdAttr);
    }
  }

  getRenderable(): Object3D {
    return this.mesh;
  }
}

/**
 * TSL counterpart of {@link PickableMultiInstancedMeshWrapper}. Manages
 * per-instance `batchId` attributes across a group of sibling `InstancedMesh`es
 * that share one logical per-instance identity (e.g. all sub-meshes of a
 * single instanced GLTF model).
 *
 * The `batchId` attribute is written on each sub-mesh's geometry so the TSL
 * `attribute("batchId", "float")` node resolves correctly per-mesh at compile
 * time. A geometry-keyed map avoids double-writes when geometries are shared.
 */
export class PickableMultiInstancedNodeMaterialWrapper extends PickableInstancedNodeMaterialBase {
  // Keyed by BufferGeometry to avoid double-writes when geometries are shared.
  private attrs = new Map<BufferGeometry, InstancedBufferAttribute>();

  constructor(
    /** Root Object3D containing all sub-meshes — returned by getRenderable(). */
    public root: Object3D,
    public meshes: InstancedMesh[],
    initialCount: number,
    ctx: ViewContext,
  ) {
    super(initialCount, ctx);
    this.syncBatchIdAttributes();
  }

  /** Re-attach bookkeeping after the underlying sub-meshes were replaced (grow). */
  syncMeshes(meshes: InstancedMesh[]): void {
    this.meshes = meshes;
    this.attrs.clear();
    this.syncBatchIdAttributes();
  }

  protected syncBatchIdAttributes(): void {
    const seen = new Set<BufferGeometry>();
    for (const mesh of this.meshes) {
      const geometry = mesh.geometry;
      if (seen.has(geometry)) continue;
      seen.add(geometry);

      const count = mesh.instanceMatrix.count;
      const len = Math.min(this.batchIds.length, count);
      let attr = this.attrs.get(geometry);
      if (attr && attr.array.length >= count) {
        const arr = attr.array as Float32Array;
        arr.fill(0);
        for (let i = 0; i < len; i++) arr[i] = this.batchIds[i] ?? 0;
        attr.needsUpdate = true;
      } else {
        const data = new Float32Array(count);
        for (let i = 0; i < len; i++) data[i] = this.batchIds[i] ?? 0;
        attr = new InstancedBufferAttribute(data, 1);
        geometry.setAttribute("batchId", attr);
        this.attrs.set(geometry, attr);
      }
    }
  }

  getRenderable(): Object3D {
    return this.root;
  }
}

export { batchIdToColor as nvr_batchIdToColor };
