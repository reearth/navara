import BATCHID_TO_COLOR from "@shaders/glsl/chunks/pick.glsl";
import {
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  Mesh,
  Object3D,
  type Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";

import type { PickableMesh } from "./pickableMesh";

/**
 * Inject picking shader support into a standard Three.js material.
 *
 * Uses a uniform `nvr_uBatchId` for the batch ID (single value per mesh)
 * and `nvr_uPickable` to toggle picking mode. When pickable, the fragment
 * shader outputs the batchId-encoded color directly, bypassing lighting
 * and tonemapping.
 */
function injectPickingShader(
  shader: WebGLProgramParametersWithUniforms,
  refs: { nvr_uPickable: { value: number }; nvr_uBatchId: { value: number } },
): void {
  shader.uniforms.nvr_uPickable = refs.nvr_uPickable;
  shader.uniforms.nvr_uBatchId = refs.nvr_uBatchId;

  // Fragment shader: inject uniforms and picking override after dithering
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "void main() {",
      `
uniform float nvr_uPickable;
uniform float nvr_uBatchId;

${BATCHID_TO_COLOR}

void main() {
`,
    )
    .replace(
      "#include <dithering_fragment>",
      `
#include <dithering_fragment>

if (nvr_uPickable > 0.0) {
  gl_FragColor = vec4(nvr_batchIdToColor(nvr_uBatchId), 1.0);
}
`,
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
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "void main() {",
      `
uniform float nvr_uPickable;
varying float nvr_vBatchId;

${BATCHID_TO_COLOR}

void main() {
`,
    )
    .replace(
      "#include <dithering_fragment>",
      `
#include <dithering_fragment>

if (nvr_uPickable > 0.0) {
  gl_FragColor = vec4(nvr_batchIdToColor(nvr_vBatchId), 1.0);
}
`,
    );
}

/**
 * Wraps a Three.js Object3D (Mesh, Group, etc.) to make it pickable via the
 * GPU picking system.
 *
 * Traverses the object's scene graph and injects picking shader code into every
 * child Mesh's material via `onBeforeCompile`. This works for both single meshes
 * and groups (e.g. GLTF models with multiple child meshes).
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

      const m = child.material;
      if (!(m instanceof Material)) return;

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
    const data = new Float32Array(this.mesh.count);
    for (let i = 0; i < this.batchIds.length; i++) {
      data[i] = this.batchIds[i] ?? 0;
    }
    this.batchIdAttr = new InstancedBufferAttribute(data, 1);
    this.mesh.geometry.setAttribute("batchId", this.batchIdAttr);
  }

  private setupShader(): void {
    const m = this.mesh.material;
    const mat = Array.isArray(m) ? m[0] : m;
    if (!(mat instanceof Material)) return;

    const prevOnBeforeCompile = mat.onBeforeCompile;
    const prevCacheKey = mat.customProgramCacheKey?.bind(mat);
    const refs = this.refs;

    mat.onBeforeCompile = (shader, renderer) => {
      prevOnBeforeCompile?.call(mat, shader, renderer);
      injectInstancedPickingShader(shader, refs);
    };

    // Ensure Three.js treats this as a distinct shader program
    mat.customProgramCacheKey = () =>
      (prevCacheKey?.() ?? "") + "_nvr_instanced_pickable";

    // Force shader recompilation
    mat.needsUpdate = true;
  }

  /** Update the wrapper after instances are added, removed, or the mesh is replaced. */
  sync(mesh: InstancedMesh, batchIds: number[]): void {
    this.mesh = mesh;
    this.batchIds = batchIds;
    this.setupBatchIdAttribute();
    this.setupShader();
  }

  _setPickable(pickable: boolean, _pickingCoord?: Vector2): void {
    this.refs.nvr_uPickable.value = pickable ? 1 : 0;
  }
}
