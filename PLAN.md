# Plan: Introduce Material Enhancer to Model Mesh

## Overview

Refactor `web/navara_three/src/mesh/model.ts` to use the Material Enhancer pattern (as described in `web/navara_three/src/material/enhancer/DESIGN.md`) for managing shader compilation, uniform refs, and material property updates. This mirrors the existing polygon implementation.

## Key Architecture Decisions

### One enhancer per child mesh

`ModelMesh` extends `Object3D` and contains a `Group` with multiple child `Mesh` objects. Each child mesh has its own `MeshStandardMaterial`/`MeshPhysicalMaterial`. The enhancer manages a single material, so we create **one enhancer per child mesh** during `overrideCesium3DTilesMaterial`.

### Enhancers stored on ModelMesh

Store enhancers in a `Map<Mesh, Enhancer>` on the `ModelMesh` instance. During `_update`, iterate over enhancers and call `update(props)` instead of `setMaterial`.

### Point cloud stays separate

Point cloud rendering (`overridePntsMaterial`) uses `PointsMaterial` with entirely different shaders. It stays outside the enhancer pattern.

### SelectiveEffect mask pass via mutates

The `onBeforeRender` mask pass callback updates bloom/outline uniforms per-frame. The enhancer exposes `mutates().base.setMaskPassState(bloom, outline, occlusion)` for this.

### Depth material shares enhancer

`customDepthMaterial` uses the same enhancer's `transformShader`, then adds depth-specific defines. Since both materials share the same uniform refs, updates propagate automatically.

### Supported shaders

Model materials are `MeshStandardMaterial | MeshPhysicalMaterial`, so `availableShaders = ["standard", "physical"]`.

## File Structure

```
web/navara_three/src/material/enhancer/model/
  index.ts                        - Re-exports
  modelMaterialEnhancer.ts        - Composition wrapper (Base + Water)

  modelBaseEnhancer/
    index.ts                      - Factory function
    types.ts                      - Props, State, Refs, Uniforms, Mutates types
    state.ts                      - State transitions and defaults
    mutates.ts                    - createBaseMutates function
    shader.ts                     - transformShader logic (vertex + fragment)
    material.ts                   - Supported materials + property updates
    markers.ts                    - Marker constants + ShaderReplacer factory

    state.test.ts                 - State transition tests
    mutates.test.ts               - Ref syncing tests
    shader.test.ts                - Shader compatibility tests
    index.test.ts                 - Lifecycle tests

  modelWaterEnhancer/
    index.ts                      - Factory function (composes with base)
    types.ts                      - Props, State, Refs, Uniforms, Mutates types
    state.ts                      - State transitions and defaults
    mutates.ts                    - createWaterMutates function
    shader.ts                     - transformShader logic (fragment only)
    material.ts                   - Material config updates

    state.test.ts                 - State transition tests
    shader.test.ts                - Shader compatibility tests
```

## Module Details

### modelBaseEnhancer

#### types.ts

```typescript
type ModelBaseProps = {
  // Material appearance
  color?: number;
  metalness?: number;
  roughness?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;

  // Picking
  pickable?: boolean;

  // Batch texture
  batchDataTexture?: UniformValue<Texture | null>;
  batchColorEnabled?: boolean;

  // Selective effects (bloom/outline mask pass)
  // Boolean props - converted to number (0/1) internally for uniforms
  bloom?: boolean;
  outline?: boolean;
  // When true, uses 1.0; when false, uses SELECTIVE_EFFECT_OCCLUSION_SKIP
  occlusion?: boolean;
} & BatchTextureFlags; // useBatchTexture, useBatchColorShow, useBatchHeight

type ModelBaseState = Readonly<{
  pickable: boolean;
  batchColorEnabled: boolean;
  useBatchTexture: boolean;
  useBatchColorShow: boolean;
  useBatchHeight: boolean;
  // Selective effects state - stored as boolean, converted to number in mutates
  bloom: boolean;
  outline: boolean;
  occlusion: boolean;
}>;

type ModelBaseRefs = {
  nvr_uPickable: UniformValue<number>;
  uBloomMaskPass: UniformValue<number>;
  uOutlineMaskPass: UniformValue<number>;
  uSelectiveEffectOcclusion: UniformValue<number>;
  batchDataTexture?: UniformValue<Texture | null>;
};

type ModelBaseMutates = Mutates<ModelBaseState, ModelBaseUniforms, {
  setBatchDataTexture: (texture: UniformValue<Texture | null>) => void;
}>;
```

#### state.ts

State transitions. `pickable` and batch flags are tracked.

#### mutates.ts

Creates refs via `structuredClone(DEFAULT_REFS)`. The `update(state)` method syncs all refs from state, including:
- `nvr_uPickable`: `state.pickable ? 1 : 0`
- `uBloomMaskPass`: `state.bloom ? 1 : 0`
- `uOutlineMaskPass`: `state.outline ? 1 : 0`
- `uSelectiveEffectOcclusion`: `state.occlusion ? 1 : SELECTIVE_EFFECT_OCCLUSION_SKIP`

`setBatchDataTexture` assigns the external ref object.

#### shader.ts (vertex)

Moves the current vertex shader modifications from `overrideCesium3DTilesMaterial`:
- Adds `batchId`, `nvr_vBatchId`, `vPosition` attributes/varyings
- Includes ShowPars, BatchTexturePars, ShadowMapDepthPars
- Modifies `#include <color_vertex>` for batch texture
- Modifies `#include <clipping_planes_vertex>` for shadow map + vPosition

#### shader.ts (fragment)

Moves fragment shader modifications and **places markers** for water enhancer:
- Replaces `void main()` with uniform declarations + show/shadow fragments
  - Places `UNIFORM_START` / `UNIFORM_END` markers around uniform block
- Includes SpecularParsFragment after `#include <lights_physical_pars_fragment>`
- Replaces `#include <normal_fragment_maps>` with:
  ```glsl
  // NVR_MODEL_BASE_NORMAL_START
  vec3 origNormal = normal;
  vec3 specular;
  #include <normal_fragment_maps>
  // NVR_MODEL_BASE_NORMAL_END
  ```
- Replaces outgoing light with mask pass + markers:
  ```glsl
  if (uBloomMaskPass > 0.5) { gl_FragColor = vec4(totalEmissiveRadiance, 1.0); return; }
  if (uOutlineMaskPass > 0.5) { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); return; }
  vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
  // NVR_MODEL_BASE_OUTGOING_LIGHT_START
  // NVR_MODEL_BASE_OUTGOING_LIGHT_END
  ```
- Replaces dithering with picking
- Replaces MRT output with markers:
  ```glsl
  // NVR_MODEL_BASE_FINAL_NORMAL_START
  vec3 finalNormal = normal;
  // NVR_MODEL_BASE_FINAL_NORMAL_END
  outputBuffer1 = vec4(packNormalToVec2(finalNormal), metalnessFactor, roughnessFactor)
  ```

#### markers.ts

```typescript
export const MODEL_BASE_SHADER_MARKERS = {
  vertex: {},
  fragment: {
    UNIFORM_START: "// NVR_MODEL_BASE_UNIFORM_START",
    UNIFORM_END: "// NVR_MODEL_BASE_UNIFORM_END",
    NORMAL_START: "// NVR_MODEL_BASE_NORMAL_START",
    NORMAL_END: "// NVR_MODEL_BASE_NORMAL_END",
    OUTGOING_LIGHT_START: "// NVR_MODEL_BASE_OUTGOING_LIGHT_START",
    OUTGOING_LIGHT_END: "// NVR_MODEL_BASE_OUTGOING_LIGHT_END",
    FINAL_NORMAL_START: "// NVR_MODEL_BASE_FINAL_NORMAL_START",
    FINAL_NORMAL_END: "// NVR_MODEL_BASE_FINAL_NORMAL_END",
  },
} as const satisfies ShaderMarkers;
```

#### material.ts

```typescript
export const AVAILABLE_SHADERS = ["standard", "physical"] satisfies ShaderName[];
export type SupportedMaterial = MaterialsFromShaders<typeof AVAILABLE_SHADERS>;

export const updateMaterialProps = (material: SupportedMaterial, props: ModelBaseProps): void => {
  // color, metalness, roughness, emissiveColor, emissiveIntensity
};
```

### modelWaterEnhancer

#### types.ts

```typescript
type ModelWaterOnlyProps = {
  water?: boolean;
  waterScaleNormal?: number;
  waterSpeed?: number;
  shininess?: number;
  specularStrength?: number;
  applyWaterNormal?: number | boolean;
  specular?: boolean;
  ior?: number;
  reflectivity?: number;
  skyEnvMap?: Texture | null;
  waterNormalMap?: Texture | null;
  timeUniform?: UniformValue<number>;
  skyEnvMapUniform?: UniformValue<Texture | null>;
};

type ModelWaterProps = {
  base?: ModelBaseProps;
  water?: ModelWaterOnlyProps;
};

type ModelWaterState = Readonly<{
  useWater: boolean;
  skyEnvMap: Texture | null;
  waterNormalMap: Texture | null;
  reflectivity: number;
  waterScaleNormal: number;
  waterSpeed: number;
  shininess: number;
  specularStrength: number;
  applyWaterNormal: number;
  specular: boolean;
  ior: number;
}>;
```

#### shader.ts

Uses `createModelBaseShaderReplacer` for type-safe marker operations:

1. Inserts `WaterParsFragment` before `computeSpecular` function (non-marker, same as polygon water)
2. `insertAfter(UNIFORM_END, water uniform declarations + tSkyEnvMap)`
3. Sets `WATER` and `USE_SKY_ENVMAP` defines
4. `replaceBlock(NORMAL, water specular using computeWaterSpecularSimple)`
5. `replaceBlock(OUTGOING_LIGHT, env map + specular addition)`
6. `replaceBlock(FINAL_NORMAL, water normal mixing)`

**Key difference from polygon**: Uses `computeWaterSpecularSimple` (not `computeWaterSpecular`), and the outgoing light uses physical shader variables (`totalDiffuse + totalSpecular + totalEmissiveRadiance`).

#### material.ts

Handles `material.needsUpdate` when water flag changes. No envMap manipulation needed (model doesn't use lambert's combine mode).

### modelMaterialEnhancer.ts (Composition)

```typescript
export type ModelMaterialProps = {
  base?: ModelBaseProps;
  water?: ModelWaterOnlyProps;
};

export function createModelMaterialEnhancer(material: SupportedMaterial) {
  const baseEnhancer = createModelBaseEnhancer(material);
  return createModelWaterEnhancer(baseEnhancer);
}
```

## Changes to model.ts

### New fields

```typescript
private _enhancers = new Map<
  Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ReturnType<typeof createModelMaterialEnhancer>
>();
```

### overrideCesium3DTilesMaterial

For each child mesh:
1. Create enhancer: `const enhancer = createModelMaterialEnhancer(mesh.material)`
2. Mount with initial props (from `meshMaterial` + `uniforms`)
3. Assign: `mesh.material.onBeforeCompile = enhancer.transformShader`
4. Assign: `mesh.material.customProgramCacheKey = enhancer.programCacheKey`
5. Store: `this._enhancers.set(mesh, enhancer)`
6. Remove: `setupWaterMaterial` call (absorbed into enhancer mount)
7. Remove: `ensureSelectiveEffectUserData` call (absorbed into enhancer refs)

### initDepthMaterial

```typescript
mesh.customDepthMaterial.onBeforeCompile = (shader, renderer) => {
  enhancer.transformShader(shader);
  shader.defines["USE_SHADOWMAP_DEPTH"] = 1;
  shader.defines["DEPTH_PACKING"] = RGBADepthPacking;
};
```

### setupMeshOnBeforeRender

Update enhancer with selective effect props:
```typescript
enhancer.update({
  base: {
    bloom: evaluation.bloomActive,
    outline: evaluation.outlineActive,
    occlusion: evaluation.occlusion !== SELECTIVE_EFFECT_OCCLUSION_SKIP,
  },
});
```

Skip state (mask not active):
```typescript
enhancer.update({
  base: {
    bloom: false,
    outline: false,
    occlusion: false, // will use SELECTIVE_EFFECT_OCCLUSION_SKIP internally
  },
});
```

### _update

Replace `traverseMesh` + `setMaterial` with:
```typescript
for (const [_mesh, enhancer] of this._enhancers) {
  enhancer.update(buildModelMaterialProps(material));
}
```

### Remove

- `setupWaterMaterial` method (absorbed into water enhancer)
- `setMaterial` method for non-point-cloud path (replaced by enhancer.update)
- `userData.prev` tracking (replaced by enhancer state)
- Direct `userData` uniform manipulation

### Keep

- Animation handling (not material-related)
- Point cloud rendering (separate material type)
- `effectIds` management (mesh-level, not material)
- `_initBatchedMaterial`, `_initBatchDataTexture`, `_getBatchDataTexture`, `_updateBatchAttribute` (batch texture API, but enhanced internally)
- `enableWaterNormalMap` (refactored to use enhancer)

## Implementation Order

1. Create `modelBaseEnhancer/` (types, state, mutates, shader, material, markers, index)
2. Create `modelWaterEnhancer/` (types, state, mutates, shader, material, index)
3. Create `modelMaterialEnhancer.ts` (composition wrapper)
4. Create `model/index.ts` (re-exports)
5. Refactor `model.ts` to use enhancers
6. Create test files (state.test.ts, mutates.test.ts, shader.test.ts, index.test.ts for both)
7. Run build, format, lint, test
