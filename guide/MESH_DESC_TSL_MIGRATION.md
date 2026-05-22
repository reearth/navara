# MeshDesc TSL Migration Guide

A roadmap for migrating mesh descriptor subclasses off the legacy
`MeshDesc` / `MeshDescWithSelectiveEffect` / `InstancedMeshDesc` hierarchy
onto the TSL-only `MeshDescBase` / `NewMeshDesc` / `NewInstancedMeshDesc`
hierarchy.

The new hierarchy hides MRT wiring, selective-effect uniforms, and picking
behind a single `setupNodeMaterial(material)` call. Each MRT slot is fed
through a **named input** on `MeshDescBase` (`emissive`, `emissiveIntensity`,
`roughness`, `metalness`, `normalNode`, `colorOutputNode`, `effectIds`),
mirroring Three.js's NodeMaterial property style. Subclasses end up smaller
and only express what makes them different.

## Hierarchies at a glance

```
BaseDesc
├── MeshDesc                        ← legacy, GLSL-friendly. Keep using until
│   └── MeshDescWithSelectiveEffect   subclass is migrated.
│       └── InstancedMeshDesc
│           └── (existing GLSL subclasses: PlaneMeshDesc, SphereMeshDesc,
│              InstancedPlaneMeshDesc, InstancedSphereMeshDesc, …)
│
└── MeshDescBase                    ← new, TSL-only. Owns MRT slot
    ├── NewMeshDesc                   composition + selective effect uniforms.
    │   └── BoxMeshDesc                (single Mesh + single-batchId picking)
    │
    └── NewInstancedMeshDesc
        └── InstancedBoxMeshDesc       (InstancedMesh + multi-batchId picking)
```

The two trees coexist. The `MeshDescRegistry` and `ThreeView.addMesh()` both
accept `AnyMeshDesc = MeshDesc | MeshDescBase`, so descriptors from either
tree can register and be added to the same view.

## What the new base classes give you

When your subclass extends `NewMeshDesc` (or `NewInstancedMeshDesc`), the
following are wired automatically — you can delete the equivalent manual
plumbing from your subclass:

1. **MRT output**: `MeshDescBase.onCreate()` extracts every `NodeMaterial`
   on `this.raw` and runs `setupNodeMaterial(material)`, which hands the
   named inputs to `setupNodeMaterialForMRT()`. That helper composes
   `outputStruct(color, normal, effectId, emissive)` and assigns
   `material.outputNode` + `material.depthNode` (a logarithmic-depth Node
   that matches the standard ShaderChunk formula).

2. **Selective effect + per-slot uniforms**: `MeshDescBase` owns five
   uniform Nodes feeding the MRT slots — `_emissive`, `_emissiveIntensity`,
   `_roughness`, `_metalness`, `_effectIdsMask` — exposed via the public
   `emissive` / `emissiveIntensity` / `roughness` / `metalness` setters
   and the `effectIds` config field. `updateEffectIdsMask()` rebuilds the
   bitmask on `effectIds` changes and on `effectSlotsChanged`. Works for
   any `NodeMaterial` subclass (no Lambert-only gating).

3. **Picking** (in the concrete subclass, not `MeshDescBase`):
   - `NewMeshDesc`: when `config.pickable === true`, its `onCreate()`
     override (after `super.onCreate()`) constructs a
     `PickableNodeMaterialWrapper` and assigns
     `this.colorOutputNode = pickWrapper.wrapColor(this.colorOutputNode)`.
     The setter triggers `refreshNodeMaterial()` to splice the wrapper
     into the outputStruct. `get batchId()` exposes the assigned ID.
   - `NewInstancedMeshDesc`: same flow but with
     `PickableInstancedNodeMaterialWrapper` (per-instance batchId via
     TSL `attribute<"float">("batchId", "float")`). `get batchIds()` exposes
     them. `add` / `removeAt` / `clear` / `replaceAll` / capacity grow all
     sync the wrapper automatically — no `onInstance*` overrides needed.

4. **Pass routing**: `MeshDescBase.getPassKey()` returns `"mrt"` by default.
   Override to route to `"draped"` / `"opaque"` / `"transparent"`
   (`BoxMeshDesc` returns `"draped"` when the `draped` flag is set).

5. **Runtime material swap**: call `this.refreshNodeMaterial()` after
   replacing `this._instance.material`. (The `normalNode` / `colorOutputNode`
   setters call it for you when the input Node itself changes.) The picking
   wrapper is preserved so batchIds stay stable.

## Reference implementations

Live examples to copy from:

- **Single mesh**:
  `web/navara_three_default_descs/src/meshes/BoxMeshDesc.ts`
- **Instanced mesh**:
  `web/navara_three_default_descs/src/meshes/InstancedBoxMeshDesc.ts`

## Migration recipe — single Mesh subclass

Apply to subclasses currently shaped like
`PlaneMeshDesc` / `SphereMeshDesc` / `CylinderMeshDesc` etc.

### 1. Switch the material type to a `NodeMaterial`

```diff
- import { MeshLambertMaterial } from "three";
+ import { MeshLambertNodeMaterial } from "three/webgpu";
```

In `createMesh()` / `createMaterial()`, return a NodeMaterial. The
constructor params are almost identical — `color` and `opacity` /
`transparent` flow through, but `emissive` / `emissiveIntensity` move from
the constructor object to assignment:

```diff
- const material = new MeshLambertMaterial({
+ const material = new MeshLambertNodeMaterial({
    color: colorValue.raw,
-   emissive: emissiveColorValue,
-   emissiveIntensity: cfg.emissiveIntensity ?? 0,
    opacity: cfg.opacity ?? 1,
    transparent: cfg.transparent ?? false,
  });
+ material.emissive.set(emissiveColorValue);
+ material.emissiveIntensity = cfg.emissiveIntensity ?? 0;
```

### 2. Switch the base class

```diff
  import {
-   MeshDescWithSelectiveEffect,
-   type MeshConfigWithSelectiveEffect,
-   type MeshUpdateWithSelectiveEffect,
+   NewMeshDesc,
+   type MeshDescConfig,
+   type MeshDescUpdate,
    type ViewContext,
  } from "@navara/three";

- export class PlaneMeshDesc extends MeshDescWithSelectiveEffect<…> {
+ export class PlaneMeshDesc extends NewMeshDesc<…> {
```

```diff
- export type PlaneMeshConfig = MeshConfigWithSelectiveEffect & Description;
- export type PlaneMeshUpdate = MeshUpdateWithSelectiveEffect & Description;
+ export type PlaneMeshConfig = MeshDescConfig & Description;
+ export type PlaneMeshUpdate = MeshDescUpdate & Description;
```

`MeshDescConfig` is a friendly re-export alias of `MeshDescBaseConfig`. Use
the alias — it survives the future `NewMeshDesc` → `MeshDesc` rename, so
your imports don't churn again.

### 3. Drop manual SelectiveEffect and Picking plumbing

The base now owns these. Remove from your subclass:

- The `setupSelectiveEffectUniforms(material)` call inside `createMaterial()`
  (and its import) — the MRT effectId slot is now driven by
  `MeshDescBase._effectIdsMask`, fed from the `effectIds` config.
- The `private pickWrapper?: PickableMeshWrapper` field.
- The `new PickableMeshWrapper(mesh, this.ctx)` + `registerPickableMesh`
  block in `onCreate()` (handled by `NewMeshDesc.onCreate()`).
- The `get batchId()` override (provided by `NewMeshDesc`).
- The pickWrapper cleanup in `onDestroy()` (handled by `NewMeshDesc`).
- The `pickable?: boolean` declaration in your local Description type
  (inherited from `MeshDescConfig`).

If your subclass drove emissive via the material's `emissive` /
`emissiveIntensity` properties, also route them through `MeshDescBase` so
the MRT emissive slot picks them up:

```ts
if (config.box?.emissiveColor !== undefined) this.emissive = config.box.emissiveColor;
if (config.box?.emissiveIntensity !== undefined)
  this.emissiveIntensity = config.box.emissiveIntensity;
```

(Setting the underlying `material.emissive` alone is not enough — the MRT
emissive slot reads `MeshDescBase._emissive` / `_emissiveIntensity`.)

### 4. Remove the `onCreate` override (often possible)

If your `onCreate` did nothing more than `super.onCreate()` + picking
wiring + `castShadow` / `receiveShadow` / `applyShadowMaterial`, the first
three are handled by the base and only the shadow lines remain. Slim down or
delete the override:

```ts
override onCreate(): void {
  super.onCreate();
  const mesh = this.raw;
  const cfg = this.config.box;
  if (mesh) {
    mesh.castShadow = cfg?.castShadow ?? false;
    mesh.receiveShadow = cfg?.receiveShadow ?? false;
    this.ctx.applyShadowMaterial(mesh.material);
  }
}
```

(For `BoxMeshDesc`, `castShadow` / `receiveShadow` are set in `createMesh`
directly because the geometry+material+mesh are constructed there, so the
`onCreate` override disappears entirely.)

### 5. Runtime material swaps

If your subclass disposes and replaces the material at runtime (e.g.,
`BoxMeshDesc` does this on draped toggle), call `this.refreshNodeMaterial()`
after the swap. The base will re-run `setupNodeMaterial(newMaterial)` and
the picking wrapper is preserved across the swap.

```ts
this._instance.material.dispose();
const newMaterial = this.createMaterial(origin);
this._instance.material = newMaterial;
this.refreshNodeMaterial();
```

(Reassigning `this.normalNode` or `this.colorOutputNode` to a new TSL Node
triggers the refresh automatically — you only need to call
`refreshNodeMaterial()` manually when the underlying `material` object
itself is swapped.)

### 6. Verify

- Type-check: `pnpm --filter @navara/three_default_descs type-check`
- Visual check in the example page that exercises your mesh
- Picking, selective effect (bloom), and material swap (if applicable)

## Migration recipe — InstancedMesh subclass

Apply to subclasses like `InstancedPlaneMeshDesc` / `InstancedSphereMeshDesc`
/ `InstancedCylinderMeshDesc`.

### 1. Material → `MeshLambertNodeMaterial`

Same change as single mesh — `createMaterial()` returns a `NodeMaterial`.

### 2. Base class → `NewInstancedMeshDesc`

```diff
  import {
-   InstancedMeshDesc,
-   type InstancedMeshConfig,
-   type InstancedMeshUpdate,
-   type InstancedChildConfig,
-   PickableInstancedMeshWrapper,
-   setupSelectiveEffectUniforms,
+   NewInstancedMeshDesc,
+   type InstancedMeshDescConfig,
+   type InstancedMeshDescUpdate,
+   type InstancedMeshDescChildConfig,
    type ViewContext,
  } from "@navara/three";

- export class InstancedPlaneMeshDesc extends InstancedMeshDesc<
-   PlaneGeometry,
-   MeshLambertMaterial,
+ export class InstancedPlaneMeshDesc extends NewInstancedMeshDesc<
+   PlaneGeometry,
+   MeshLambertNodeMaterial,
    …
  >
```

### 3. Drop manual SelectiveEffect + Instanced Picking plumbing

Remove:

- `setupSelectiveEffectUniforms(material)` inside `createMaterial()`.
- `private pickWrapper?: PickableInstancedMeshWrapper` field.
- `new PickableInstancedMeshWrapper(...)` + `registerPickableMesh` in
  `onCreate()`.
- All `onInstance*` overrides that exist only to call
  `this.pickWrapper?.addInstance()` / `removeInstanceAt()` /
  `clearInstances()` / `replaceAll()` / `syncMesh()` — the base does all
  of these inside `add` / `removeAt` / `clear` / `replaceAll` / `grow`.
- `get batchIds()` override (inherited from `NewInstancedMeshDesc`).
- `onDestroy()`'s pickWrapper unregister (handled by the base).

### 4. Keep your subclass-specific work

- `createGeometry()` / `createMaterial()` / `getChildConfigs()` /
  `getInstanceColor()` — these are still abstract on the base.
- `getInstanceScale()` if you encode per-instance dimensions as scale (e.g.,
  `InstancedBoxMeshDesc.width/height/depth`).
- Per-config `onUpdateConfig` material property updates (color, opacity,
  emissive, etc.) — keep these. When you mutate `material.emissive` /
  `material.emissiveIntensity`, **also** mirror the value onto the base
  (`this.emissive = ...`, `this.emissiveIntensity = ...`) so the MRT
  emissive slot stays in sync — the slot reads
  `MeshDescBase._emissive` / `_emissiveIntensity`, not the underlying
  material's properties.

## Customizing the MRT slots

`MeshDescBase` exposes each MRT-feeding input as a public property. Assign
to them from your subclass — no method override required. Whether the input
is a uniform (mutated via `.value`) or a Node (graph swap) decides whether
the outputStruct has to be rebuilt; the setters handle that for you.

| Input | Type | Default | What it feeds |
| --- | --- | --- | --- |
| `emissive` | `Color` (uniform) | black | additive vec3 in the emissive slot |
| `emissiveIntensity` | number (uniform) | 0 | multiplier on `diffuseColor.rgb` in the emissive slot |
| `roughness` | number (uniform) | 0 | normal slot `.w` |
| `metalness` | number (uniform) | 0 | normal slot `.z` (reflectivity for non-PBR) |
| `effectIds` (via config / `onUpdateConfig`) | `string[]` | `[]` | selective-effect bitmask in effectId slot `.r` |
| `normalNode` | `Node<"vec3">` | `normalView` | view-space normal; packed octahedrally into normal slot `.xy` |
| `colorOutputNode` | `Node<"vec4">` | `output` | full vec4 in color slot (location 0) |

Uniform setters (`emissive`, `emissiveIntensity`, `roughness`, `metalness`)
only update `.value`, so no graph rebuild happens. Node setters
(`normalNode`, `colorOutputNode`) swap the Node and call
`refreshNodeMaterial()` automatically because the outputStruct topology
changes.

**`material.colorNode` vs `colorOutputNode`**: `material.colorNode` is the
standard Three.js NodeMaterial hook for the *lit input* — use it for
ordinary color customization (e.g. `material.colorNode = gradientNode`,
as `BoxMeshDesc` does). `colorOutputNode` is the *final vec4* written to
MRT slot 0, used by picking to swap the entire lit output for a batchId
color. The two compose cleanly: `material.colorNode` flows through lighting
into `output`, which is the default `colorOutputNode`.

### Why not override `setupNodeMaterial`?

Each `setupNodeMaterialForMRT(material, ...)` call **overwrites**
`material.outputNode`. Chaining via `super.setupNodeMaterial(material)`
would compose the slots twice and discard your additions. Assign the named
inputs above instead — the next `setupNodeMaterial` / `refreshNodeMaterial`
call picks them up automatically.

The one legitimate reason to override `setupNodeMaterial` itself is when
you need to compute state **after** `super.onCreate()` but **before** the
first material wiring — e.g. `NewMeshDesc` overrides `onCreate()` to build
the picking wrapper and then assigns `this.colorOutputNode = wrapped`,
letting the setter trigger the rebuild. Prefer that pattern over overriding
`setupNodeMaterial` directly.

## What the new hierarchy does not yet support

Out of scope until a future PR. If your subclass needs any of these, keep it
on the legacy `MeshDesc` hierarchy for now:

1. **Group-wrapped meshes**.
   `extractNodeMaterial()` requires `raw instanceof Mesh`. If your
   `createMesh()` returns a `Group` containing child meshes (e.g.,
   `InstancedGltfModelMeshDesc`), the base doesn't traverse the children.
   Override `extractNodeMaterial()` to walk the tree. Multi-material arrays
   on a single `Mesh` *are* supported — `extractNodeMaterial()` iterates the
   array and keeps every NodeMaterial.

2. **Hierarchical picking** (e.g., a Group where any sub-mesh resolves to
   the same batchId — what `PickableMultiInstancedMeshWrapper` does for
   instanced GLTF). The TSL counterpart doesn't exist yet.

## After all subclasses have migrated

Cleanup PR (do not start until every `MeshDesc` / `MeshDescWithSelectiveEffect`
/ `InstancedMeshDesc` subclass is gone):

1. Delete `web/navara_three/src/core/MeshDesc.ts`,
   `MeshDescWithSelectiveEffect.ts`, `InstancedMeshDesc.ts`.
2. Rename `NewMeshDesc.ts` → `MeshDesc.ts` and
   `NewInstancedMeshDesc.ts` → `InstancedMeshDesc.ts`. Update class names
   and re-exports.
3. Drop the `AnyMeshDesc` / `AnyMeshConfig` unions in `BaseHandle.ts` /
   `MeshDescRegistry.ts` — there is only one hierarchy again.
4. The alias re-exports (`MeshDescConfig` → `MeshDescBaseConfig`, etc.)
   become tautological. Either delete them and let subclasses import
   `MeshDescBaseConfig` directly, or keep them and stop exporting the
   `MeshDescBase*` originals.
5. Update `setupSelectiveEffectUniforms` callers: if no GLSL subclass is
   left, the helper itself can be deleted.

## FAQ

**Q. My subclass needs a fully custom color (not just picking). Where does
it go?**
A. For ordinary color customization, set the standard
`material.colorNode` — that's what `BoxMeshDesc` does for its
`box.colorNode` debug input. If you need to compose at the *final-output*
level (vec4 written to MRT slot 0), assign `this.colorOutputNode` — the
setter rebuilds the outputStruct. If you also want picking, do this after
`NewMeshDesc.onCreate()` has wrapped the default `colorOutputNode`, so the
wrap composes with your customization.

**Q. I want to disable the auto MRT wiring for one mesh.**
A. Don't return a `NodeMaterial` from `createMesh()` — `extractNodeMaterial()`
filters by `instanceof NodeMaterial` and silently skips non-NodeMaterial
entries. Or override `extractNodeMaterial()` to return an empty array, and
optionally override `getPassKey()` to route the mesh to `"opaque"` /
`"transparent"` instead of `"mrt"`.

**Q. The same `view` will have both legacy and new descriptors registered.
Is that supported?**
A. Yes. `MeshDescRegistry` accepts `AnyMeshDesc` constructors and
`ThreeView.addMesh<L extends AnyMeshDesc>` returns the right handle type
for either. GLSL meshes go through the GLSL MRT inject path; TSL meshes go
through `setupNodeMaterialForMRT`. Both write into the same MRT framebuffer
because the per-attachment encodings (color RGB, octahedral normal in
`.xy`, effectIds mask, emissive RGB) are identical.

**Q. The picking attribute (`batchId`) collides with something else on my
geometry.**
A. The attribute name is hard-coded inside
`PickableInstancedNodeMaterialWrapper` to match the GLSL convention. If
your geometry already has a `batchId` attribute, you'll need to rename one
side or override `setupNodeMaterial()` to install a custom picking node
that reads a different attribute.
