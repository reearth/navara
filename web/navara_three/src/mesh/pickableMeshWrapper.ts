import BATCHID_TO_COLOR from "@shaders/glsl/chunks/pick.glsl";
import {
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Mesh,
  Object3D,
  ShaderMaterial,
  type Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";

import type { ViewContext } from "../core/ViewContext";

import { PickableMesh } from "./pickableMesh";

/**
 * Picking uniform declarations injected into fragment shaders.
 */
const PICKING_UNIFORMS_DECL = /* glsl */ `
uniform float nvr_uPickable;
uniform float nvr_uBatchId;

${BATCHID_TO_COLOR}
`;

/**
 * Picking override block: when pickable, output batchId-encoded color.
 * This block must be placed at the very end of main(), after all other
 * gl_FragColor assignments, so it overrides the final output.
 */
const PICKING_OVERRIDE = /* glsl */ `
if (nvr_uPickable > 0.0) {
  gl_FragColor = vec4(nvr_batchIdToColor(nvr_uBatchId), 1.0);
}
`;

/**
 * Inject picking shader support into a standard Three.js material
 * via onBeforeCompile.
 *
 * Standard materials (MeshBasicMaterial, MeshLambertMaterial, etc.) always
 * contain `#include <dithering_fragment>` as the last meaningful chunk
 * before main() closes. Picking code is injected right after it.
 */
function injectPickingShader(
  shader: WebGLProgramParametersWithUniforms,
  refs: { nvr_uPickable: { value: number }; nvr_uBatchId: { value: number } },
): void {
  shader.uniforms.nvr_uPickable = refs.nvr_uPickable;
  shader.uniforms.nvr_uBatchId = refs.nvr_uBatchId;

  shader.fragmentShader = shader.fragmentShader.replace(
    "void main() {",
    `${PICKING_UNIFORMS_DECL}\nvoid main() {`,
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    `#include <dithering_fragment>\n${PICKING_OVERRIDE}`,
  );
}

/**
 * Inject picking shader support for instanced meshes.
 *
 * Uses a per-instance `batchId` attribute passed as a varying to the fragment
 * shader. When pickable, the fragment shader outputs the batchId-encoded color.
 */
function injectInstancedPickingShader(
  shader: WebGLProgramParametersWithUniforms,
  refs: { nvr_uPickable: { value: number } },
): void {
  shader.uniforms.nvr_uPickable = refs.nvr_uPickable;

  // Vertex shader: declare batchId attribute and pass as varying
  shader.vertexShader = shader.vertexShader.replace(
    "void main() {",
    `
attribute float batchId;
varying float nvr_vBatchId;

void main() {
  nvr_vBatchId = batchId;
`,
  );

  // Fragment shader: inject uniforms, varying, and picking override
  shader.fragmentShader = shader.fragmentShader.replace(
    "void main() {",
    `
uniform float nvr_uPickable;
varying float nvr_vBatchId;

${BATCHID_TO_COLOR}

void main() {
`,
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    `#include <dithering_fragment>

if (nvr_uPickable > 0.0) {
  gl_FragColor = vec4(nvr_batchIdToColor(nvr_vBatchId), 1.0);
}
`,
  );
}

/**
 * Directly inject picking shader code into a ShaderMaterial's source strings.
 *
 * For ShaderMaterial (and its subclasses like LineMaterial), modifying the
 * shader source directly is more reliable than `onBeforeCompile` because:
 * 1. Other code may set onBeforeCompile (e.g. RTE injection for LineMaterial)
 * 2. MRT overrides already modify material.fragmentShader directly
 * 3. The material source is the ground truth for ShaderMaterial compilation
 *
 * The picking override is injected before the last closing brace of main()
 * so it runs after all other gl_FragColor assignments.
 */
function injectPickingIntoShaderMaterial(
  material: ShaderMaterial,
  refs: { nvr_uPickable: { value: number }; nvr_uBatchId: { value: number } },
): void {
  // Add uniforms to the material's uniform map
  material.uniforms.nvr_uPickable = refs.nvr_uPickable;
  material.uniforms.nvr_uBatchId = refs.nvr_uBatchId;

  // Inject uniform declarations before void main()
  material.fragmentShader = material.fragmentShader.replace(
    "void main() {",
    `${PICKING_UNIFORMS_DECL}\nvoid main() {`,
  );

  // Inject picking override before the last closing brace of main().
  // Custom materials (ShaderMaterial, LineMaterial) don't have
  // #include <dithering_fragment>, so we target the last `}` instead.
  const lastBrace = material.fragmentShader.lastIndexOf("}");
  material.fragmentShader =
    material.fragmentShader.slice(0, lastBrace) +
    PICKING_OVERRIDE +
    material.fragmentShader.slice(lastBrace);

  material.needsUpdate = true;
}

/**
 * Turnkey {@link PickableMesh} implementation for stock Three.js materials.
 *
 * Traverses the wrapped Object3D and injects picking shader code into every
 * child `Mesh`'s material: `onBeforeCompile` for standard materials, direct
 * source mutation for `ShaderMaterial`. During the pick pass the fragment
 * shader outputs a batchId-encoded color, bypassing lighting/tonemapping.
 *
 * Apply this explicitly, don't rely on the framework to
 * wrap your mesh for you. If you have a custom shader and don't want shader
 * injection, implement {@link PickableMesh} yourself instead of using this
 * class.
 */
export class PickableMeshWrapper extends Object3D implements PickableMesh {
  public readonly batchId: number;
  private refs: {
    nvr_uPickable: { value: number };
    nvr_uBatchId: { value: number };
  };
  /** Materials that already have picking shaders installed. */
  private injectedMaterials = new WeakSet<Material>();

  constructor(
    public object: Object3D,
    ctx: ViewContext,
  ) {
    super();
    this.batchId = ctx.genGlobalBatchId() ?? 0;
    this.refs = {
      nvr_uPickable: { value: 0 },
      nvr_uBatchId: { value: this.batchId },
    };
    this.setupShaders();
  }

  /**
   * Re-scan the wrapped object and inject picking into any materials that
   * appeared since the last pass (e.g. after a layer swapped its material).
   * Preserves the existing `batchId` and skips materials already injected.
   */
  syncMaterials(): void {
    this.setupShaders();
  }

  private setupShaders(): void {
    const refs = this.refs;
    this.object.traverse((child) => {
      if (!(child instanceof Mesh)) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((m) => {
        if (!(m instanceof Material)) return;
        if (this.injectedMaterials.has(m)) return;
        // For ShaderMaterial (includes LineMaterial), inject directly into
        // the shader source. This is more reliable than onBeforeCompile
        // because ShaderMaterial sources may already be modified by MRT
        // overrides and RTE injection.
        if (m instanceof ShaderMaterial) {
          injectPickingIntoShaderMaterial(m, refs);
          this.injectedMaterials.add(m);
          return;
        }
        // For standard materials, use onBeforeCompile
        const prevOnBeforeCompile = m.onBeforeCompile;
        const prevCacheKey = m.customProgramCacheKey?.bind(m);
        m.onBeforeCompile = (shader, renderer) => {
          prevOnBeforeCompile?.call(m, shader, renderer);
          injectPickingShader(shader, refs);
        };
        m.customProgramCacheKey = () =>
          (prevCacheKey?.() ?? "") + "_nvr_pickable";
        m.needsUpdate = true;
        this.injectedMaterials.add(m);
      });
    });
  }

  onBeforePicking(_pickingCoord?: Vector2): void {
    this.refs.nvr_uPickable.value = 1;
  }

  onAfterPicking(): void {
    this.refs.nvr_uPickable.value = 0;
  }

  getRenderable(): Object3D {
    return this.object;
  }
}

/**
 * Turnkey {@link PickableMesh} implementation for `InstancedMesh`.
 *
 * Adds a per-instance `batchId` attribute and injects picking shader code.
 * During the pick pass each instance renders with its unique batchId color.
 *
 * The wrapper owns the batchId array; callers drive instance lifecycle via
 * {@link addInstance}, {@link removeInstanceAt}, {@link clearInstances},
 * {@link replaceAll}, and {@link syncMesh} (after a buffer grow).
 */
export class PickableInstancedMeshWrapper
  extends Object3D
  implements PickableMesh
{
  public batchIds: number[];
  private refs: { nvr_uPickable: { value: number } };
  private batchIdAttr: InstancedBufferAttribute | null = null;
  /** Set of materials that already have picking shaders installed. */
  private injectedMaterials = new WeakSet<Material>();

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
    this.refs = { nvr_uPickable: { value: 0 } };
    this.setupBatchIdAttribute();
    this.setupShader();
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
    this.setupShader();
  }

  /** Create/update the per-instance batchId attribute on the geometry. */
  private setupBatchIdAttribute(): void {
    const count = this.mesh.instanceMatrix.count;
    const len = Math.min(this.batchIds.length, count);

    if (this.batchIdAttr && this.batchIdAttr.array.length >= count) {
      // Reuse existing buffer — zero out then fill
      const arr = this.batchIdAttr.array as Float32Array;
      arr.fill(0);
      for (let i = 0; i < len; i++) {
        arr[i] = this.batchIds[i] ?? 0;
      }
      this.batchIdAttr.needsUpdate = true;
    } else {
      // First call or buffer too small — allocate new attribute
      const data = new Float32Array(count);
      for (let i = 0; i < len; i++) {
        data[i] = this.batchIds[i] ?? 0;
      }
      this.batchIdAttr = new InstancedBufferAttribute(data, 1);
      this.mesh.geometry.setAttribute("batchId", this.batchIdAttr);
    }
  }

  /** Install picking shader hooks on materials that haven't been injected yet. */
  private setupShader(): void {
    const materials = Array.isArray(this.mesh.material)
      ? this.mesh.material
      : [this.mesh.material];

    const refs = this.refs;

    for (const mat of materials) {
      if (!(mat instanceof Material)) continue;
      if (this.injectedMaterials.has(mat)) continue;

      const prevOnBeforeCompile = mat.onBeforeCompile;
      const prevCacheKey = mat.customProgramCacheKey?.bind(mat);

      mat.onBeforeCompile = (shader, renderer) => {
        prevOnBeforeCompile?.call(mat, shader, renderer);
        injectInstancedPickingShader(shader, refs);
      };
      // Ensure Three.js treats this as a distinct shader program
      mat.customProgramCacheKey = () =>
        (prevCacheKey?.() ?? "") + "_nvr_instanced_pickable";
      // Force shader recompilation
      mat.needsUpdate = true;

      this.injectedMaterials.add(mat);
    }
  }

  onBeforePicking(_pickingCoord?: Vector2): void {
    this.refs.nvr_uPickable.value = 1;
  }

  onAfterPicking(): void {
    this.refs.nvr_uPickable.value = 0;
  }

  getRenderable(): Object3D {
    return this.mesh;
  }
}

/**
 * Turnkey {@link PickableMesh} implementation for a group of sibling
 * `InstancedMesh`es that share one logical per-instance identity.
 *
 * Used for instanced GLTF models: a single source model has multiple sub-meshes
 * (one `InstancedMesh` per node), each with its own geometry and material.
 * Every instance `i` represents one full model, so all sub-meshes at slot `i`
 * share the same `batchId`. Picking any sub-mesh of a given instance resolves
 * to the same id.
 *
 * The wrapper owns a single `batchIds` array, installs a synchronized
 * `batchId` `InstancedBufferAttribute` on every sub-mesh geometry, and injects
 * the instanced picking shader into every sub-mesh material.
 */
export class PickableMultiInstancedMeshWrapper
  extends Object3D
  implements PickableMesh
{
  public batchIds: number[];
  private refs: { nvr_uPickable: { value: number } };
  // Keyed by BufferGeometry, not InstancedMesh: sub-meshes loaded from a GLTF
  // commonly share a geometry, and `batchId` lives on the geometry. Keying by
  // mesh would let a later `geometry.setAttribute("batchId", ...)` silently
  // overwrite the earlier mesh's cached attribute, so updates would mutate
  // a stale object and picking would read outdated ids.
  private attrs = new Map<BufferGeometry, InstancedBufferAttribute>();
  private injectedMaterials = new WeakSet<Material>();

  constructor(
    public root: Object3D,
    public meshes: InstancedMesh[],
    initialCount: number,
    private ctx: ViewContext,
  ) {
    super();
    this.batchIds = Array.from(
      { length: initialCount },
      () => ctx.genGlobalBatchId() ?? 0,
    );
    this.refs = { nvr_uPickable: { value: 0 } };
    this.setupBatchIdAttributes();
    this.setupShaders();
  }

  addInstance(): number {
    const id = this.ctx.genGlobalBatchId() ?? 0;
    this.batchIds.push(id);
    this.setupBatchIdAttributes();
    return id;
  }

  removeInstanceAt(index: number): void {
    const last = this.batchIds.length - 1;
    if (index < 0 || index > last) return;
    if (index !== last) this.batchIds[index] = this.batchIds[last];
    this.batchIds.pop();
    this.setupBatchIdAttributes();
  }

  clearInstances(): void {
    this.batchIds = [];
    this.setupBatchIdAttributes();
  }

  replaceAll(count: number): number[] {
    this.batchIds = Array.from(
      { length: count },
      () => this.ctx.genGlobalBatchId() ?? 0,
    );
    this.setupBatchIdAttributes();
    return this.batchIds;
  }

  /** Re-attach bookkeeping after the underlying sub-meshes were replaced. */
  syncMeshes(meshes: InstancedMesh[]): void {
    this.meshes = meshes;
    this.attrs.clear();
    this.setupBatchIdAttributes();
    this.setupShaders();
  }

  private setupBatchIdAttributes(): void {
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

  private setupShaders(): void {
    const refs = this.refs;
    for (const mesh of this.meshes) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of materials) {
        if (!(mat instanceof Material)) continue;
        if (this.injectedMaterials.has(mat)) continue;

        const prevOnBeforeCompile = mat.onBeforeCompile;
        const prevCacheKey = mat.customProgramCacheKey?.bind(mat);

        mat.onBeforeCompile = (shader, renderer) => {
          prevOnBeforeCompile?.call(mat, shader, renderer);
          injectInstancedPickingShader(shader, refs);
        };
        mat.customProgramCacheKey = () =>
          (prevCacheKey?.() ?? "") + "_nvr_instanced_pickable";
        mat.needsUpdate = true;

        this.injectedMaterials.add(mat);
      }
    }
  }

  onBeforePicking(_pickingCoord?: Vector2): void {
    this.refs.nvr_uPickable.value = 1;
  }

  onAfterPicking(): void {
    this.refs.nvr_uPickable.value = 0;
  }

  getRenderable(): Object3D {
    return this.root;
  }
}
