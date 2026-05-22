import {
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
 * TSL counterpart of {@link PickableInstancedMeshWrapper}. Manages a
 * per-instance `batchId` {@link InstancedBufferAttribute} on the geometry and
 * exposes a {@link wrapColor} that reads the attribute via the TSL
 * `attribute("batchId", "float")` node.
 *
 * Lifecycle methods ({@link addInstance} / {@link removeInstanceAt} /
 * {@link clearInstances} / {@link replaceAll} / {@link syncMesh}) mirror the
 * GLSL wrapper so a subclass like `NewInstancedMeshDesc` can call them from
 * the same `onInstance*` hooks.
 */
export class PickableInstancedNodeMaterialWrapper
  extends Object3D
  implements PickableMesh
{
  public batchIds: number[];
  private readonly uPickable = uniform(0);
  private batchIdAttr: InstancedBufferAttribute | null = null;

  constructor(
    public mesh: InstancedMesh,
    initialCount: number,
    private ctx: ViewContext,
  ) {
    super();
    this.batchIds = Array.from(
      { length: initialCount },
      () => ctx.genGlobalBatchId() ?? 0,
    );
    this.setupBatchIdAttribute();
  }

  /**
   * Wrap a base color node with the picking override. Reads the per-instance
   * `batchId` attribute (set up on the geometry by this wrapper) and switches
   * the color to the encoded batchId during the pick pass.
   */
  wrapColor(baseColor: Node<"vec4">): Node<"vec4"> {
    const batchIdAttr = attribute<"float">("batchId", "float");
    const picked = vec4(batchIdToColor(batchIdAttr), 1.0);
    return select(this.uPickable.greaterThan(0.5), picked, baseColor);
  }

  /** Allocate a batchId for a new instance and extend the attribute. */
  addInstance(): number {
    const id = this.ctx.genGlobalBatchId() ?? 0;
    this.batchIds.push(id);
    this.setupBatchIdAttribute();
    return id;
  }

  /** Remove an instance by index (swap-with-last, O(1)). */
  removeInstanceAt(index: number): void {
    const last = this.batchIds.length - 1;
    if (index < 0 || index > last) return;
    if (index !== last) this.batchIds[index] = this.batchIds[last];
    this.batchIds.pop();
    this.setupBatchIdAttribute();
  }

  /** Drop all instance batchIds. */
  clearInstances(): void {
    this.batchIds = [];
    this.setupBatchIdAttribute();
  }

  /** Regenerate `count` fresh batchIds and refresh the attribute. */
  replaceAll(count: number): number[] {
    this.batchIds = Array.from(
      { length: count },
      () => this.ctx.genGlobalBatchId() ?? 0,
    );
    this.setupBatchIdAttribute();
    return this.batchIds;
  }

  /** Re-attach bookkeeping after the underlying `InstancedMesh` was replaced. */
  syncMesh(mesh: InstancedMesh): void {
    this.mesh = mesh;
    this.batchIdAttr = null;
    this.setupBatchIdAttribute();
  }

  /** Create/update the per-instance batchId attribute on the geometry. */
  private setupBatchIdAttribute(): void {
    const count = this.mesh.instanceMatrix.count;
    const len = Math.min(this.batchIds.length, count);

    if (this.batchIdAttr && this.batchIdAttr.array.length >= count) {
      const arr = this.batchIdAttr.array as Float32Array;
      arr.fill(0);
      for (let i = 0; i < len; i++) {
        arr[i] = this.batchIds[i] ?? 0;
      }
      this.batchIdAttr.needsUpdate = true;
    } else {
      const data = new Float32Array(count);
      for (let i = 0; i < len; i++) {
        data[i] = this.batchIds[i] ?? 0;
      }
      this.batchIdAttr = new InstancedBufferAttribute(data, 1);
      this.mesh.geometry.setAttribute("batchId", this.batchIdAttr);
    }
  }

  onBeforePicking(_pickingCoord?: Vector2): void {
    this.uPickable.value = 1;
  }

  onAfterPicking(): void {
    this.uPickable.value = 0;
  }

  getRenderable(): Object3D {
    return this.mesh;
  }
}

export { batchIdToColor as nvr_batchIdToColor };
