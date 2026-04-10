import BATCHID_TO_COLOR from "@shaders/glsl/chunks/pick.glsl";
import {
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Mesh,
  Object3D,
  ShaderMaterial,
  type Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";

import type { PickableMesh } from "./pickableMesh";

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
 * Wraps a Three.js Object3D (Mesh, Group, etc.) to make it pickable via the
 * GPU picking system.
 *
 * Traverses the object's scene graph and injects picking shader code into every
 * child Mesh's material. For ShaderMaterial, modifies the source directly.
 * For standard materials, uses `onBeforeCompile`.
 *
 * During the picking pass, the fragment shader outputs a batchId-encoded color
 * directly, bypassing all lighting/tonemapping calculations.
 */
export class PickableMeshWrapper extends Object3D implements PickableMesh {
  private refs: {
    nvr_uPickable: { value: number };
    nvr_uBatchId: { value: number };
  };

  constructor(
    public object: Object3D,
    public batchId: number,
  ) {
    super();
    this.refs = {
      nvr_uPickable: { value: 0 },
      nvr_uBatchId: { value: batchId },
    };
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
        // For ShaderMaterial (includes LineMaterial), inject directly into
        // the shader source. This is more reliable than onBeforeCompile
        // because ShaderMaterial sources may already be modified by MRT
        // overrides and RTE injection.
        if (m instanceof ShaderMaterial) {
          injectPickingIntoShaderMaterial(m, refs);
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
      });
    });
  }

  _setPickable(pickable: boolean, _pickingCoord?: Vector2): void {
    this.refs.nvr_uPickable.value = pickable ? 1 : 0;
  }
}

/**
 * Wraps a Three.js InstancedMesh to make it pickable with per-instance IDs.
 *
 * Adds a per-instance `batchId` attribute and injects picking shader code.
 * During the picking pass, each instance renders with its unique batchId color.
 */
export class PickableInstancedMeshWrapper
  extends Object3D
  implements PickableMesh
{
  private refs: { nvr_uPickable: { value: number } };
  private batchIdAttr: InstancedBufferAttribute | null = null;
  /** Set of materials that already have picking shaders installed. */
  private injectedMaterials = new WeakSet<Material>();

  constructor(
    public mesh: InstancedMesh,
    private batchIds: number[],
  ) {
    super();
    this.refs = { nvr_uPickable: { value: 0 } };
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

  /** Update the wrapper after instances are added, removed, or the mesh is replaced. */
  sync(mesh: InstancedMesh, batchIds: number[]): void {
    this.mesh = mesh;
    this.batchIds = batchIds;
    this.setupBatchIdAttribute();
    // Only installs shader hooks on new/unseen materials; skips already-injected ones.
    this.setupShader();
  }

  _setPickable(pickable: boolean, _pickingCoord?: Vector2): void {
    this.refs.nvr_uPickable.value = pickable ? 1 : 0;
  }
}
