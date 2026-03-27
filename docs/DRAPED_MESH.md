# Draped Mesh

This document explains how DrapedMesh works and how to use it in custom layers. For background on the layer system, see [CUSTOM_LAYER.md](CUSTOM_LAYER.md). For the rendering pipeline context, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Overview

DrapedMesh projects a 3D mesh onto terrain using a stencil-buffer technique. Instead of floating above or clipping through the ground, a draped mesh paints its shape directly onto the terrain surface, similar to how a decal is applied to a surface.

This is a purely Three.js construct with no WASM dependency, so it can be used in any layer package including `@navara/three_default_layers`.

## How It Works

### Stencil-Buffer Draping Algorithm

DrapedMesh uses a three-pass stencil test to determine where the mesh intersects the terrain. The terrain must already be rendered to the depth buffer before this process begins.

```
Pass 1: Back-face pass
  - Renders back faces of the mesh
  - Increments stencil buffer where depth test fails (behind terrain)
  - Color and depth writes disabled

Pass 2: Front-face pass
  - Renders front faces of the mesh
  - Decrements stencil buffer where depth test fails (behind terrain)
  - Color and depth writes disabled

Pass 3: Final pass
  - Renders only where stencil != 0 (mesh interior that intersects terrain)
  - Enables color write, disables depth test
  - Clears stencil buffer after rendering
```

After these three passes, only the parts of the mesh that intersect the terrain surface are visible, creating the appearance of draping.

**References:**
- [Hybrid Rendering of Dynamic Terrain in 3D GIS (ISPRS 2008)](https://www.isprs.org/proceedings/XXXVII/congress/2_pdf/5_WG-II-5/06.pdf)
- [Stencil-based Draping (WSCG 2007)](http://wscg.zcu.cz/WSCG2007/Papers_2007/journal/B17-full.pdf)

### Rendering Pipeline Integration

DrapedMesh rendering fits into CustomRenderPass between the globe (terrain) pass and the MRT pass:

```
1. Shadow map
2. Globe / terrain  →  writes depth buffer
3. Draped meshes    →  reads depth buffer, uses stencil test
4. MRT (selective effects)
5. Opaque scene
6. Transparent scene
7. Post-processing
```

The `draped` scene in the `Scenes` type holds all draped meshes. CustomRenderPass processes each DrapedMesh individually using a temporary scene to prevent stencil interference between meshes.

### PassKey System

Layers control which render pass they belong to by overriding `getPassKey()`. Returning `"draped"` places the mesh into the draped scene:

```typescript
type PassKey = "opaque" | "transparent" | "mrt" | "skyEnvMap" | "draped";
```

When `getPassKey()` returns `"draped"`, the layer's mesh is added to the draped scene and processed through the stencil-buffer algorithm described above.

## Usage

### Basic Usage

`DrapedMesh` is a drop-in replacement for Three.js `Mesh`:

```typescript
import { DrapedMesh } from "@navara/three";
import { BoxGeometry, MeshBasicMaterial } from "three";

const geometry = new BoxGeometry(1000, 10000, 1000);
const material = new MeshBasicMaterial({ color: 0xff4444 });

const mesh = new DrapedMesh(geometry, material, true); // third arg: enable draping
```

The `drapedEnable` property controls whether the stencil draping is active. When `false`, the mesh behaves like a normal Three.js Mesh.

### Implementing a Draped Layer

> [!NOTE]
> The mesh must be large enough to penetrate the terrain surface. The stencil test works by detecting where the mesh volume intersects the terrain, so if the mesh does not cover the terrain, nothing will be rendered.

To add draping support to a custom mesh layer:

1. Use `DrapedMesh` as the instance type
2. Override `getPassKey()` to return `"draped"` when draping is enabled
3. Switch materials between lit (normal) and unlit (draped) modes

```typescript
import {
  MeshLayerDeclaration,
  DrapedMesh,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type PassKey,
  type ViewContext,
  Color,
} from "@navara/three";
import { BoxGeometry, MeshBasicMaterial, MeshLambertMaterial } from "three";

type MyLayerDescription = {
  myBox?: {
    width?: number;
    height?: number;
    depth?: number;
    color?: Color;
    draped?: boolean;
  };
};

type MyLayerConfig = MeshLayerConfig & MyLayerDescription;
type MyLayerUpdate = MeshLayerUpdate & MyLayerDescription;

class MyDrapedLayer extends MeshLayerDeclaration<
  MyLayerConfig,
  MyLayerUpdate,
  DrapedMesh<BoxGeometry, MeshBasicMaterial | MeshLambertMaterial>
> {
  private config: MyLayerConfig;

  constructor(view: ViewContext, config: MyLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.myBox ?? {};
    const draped = cfg.draped ?? false;
    const geometry = new BoxGeometry(
      cfg.width ?? 1000,
      cfg.height ?? 10000,
      cfg.depth ?? 1000,
    );

    // Use unlit material when draped (no lighting on terrain surface)
    const material = draped
      ? new MeshBasicMaterial({ color: cfg.color?.raw ?? 0xffffff })
      : new MeshLambertMaterial({ color: cfg.color?.raw ?? 0xffffff });

    return new DrapedMesh(geometry, material, draped);
  }

  // Route to draped scene when draping is enabled
  protected override getPassKey(): PassKey {
    if (this.config.myBox?.draped) {
      return "draped";
    }
    return super.getPassKey();
  }

  onUpdateConfig(updates: MyLayerUpdate): void {
    if (updates.myBox?.draped !== undefined && this._instance) {
      this._instance.drapedEnable = updates.myBox.draped;
      // Swap material for appropriate lighting mode
    }
    super.onUpdateConfig(updates);
  }
}
```

### Dynamic Toggling

The `draped` property can be changed at runtime. When toggling, you need to:

1. Update `drapedEnable` on the DrapedMesh instance
2. Swap the material (draped meshes use unlit materials since they render on the terrain surface)
3. Call `onPassKeyChange()` (handled by the base class when config changes trigger `getPassKey()` to return a different value)

```typescript
// Toggle draping at runtime
layer.update({ myBox: { draped: true } });

// Toggle back to normal rendering
layer.update({ myBox: { draped: false } });
```

### Constraints

- **The mesh must cover the terrain geometry.** The stencil test works by detecting where the mesh volume intersects the terrain surface. If the mesh does not extend through the terrain, nothing will be rendered.
- **Draped meshes use unlit materials.** Since the draped result is painted onto the terrain surface, standard lighting on the mesh itself is not meaningful. Use `MeshBasicMaterial` instead of lit materials like `MeshLambertMaterial` or `MeshStandardMaterial`.

## Built-in Support

The default layers `BoxMeshLayer` and `CylinderMeshLayer` in `@navara/three_default_layers` support the `draped` option out of the box:

```typescript
const layer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 1000,
    height: 10000,
    depth: 1000,
    color: new Color().setHex(0xff4444),
    opacity: 0.8,
    transparent: true,
    draped: true,
  },
  matrixWorld: someMatrix,
});

// Dynamic toggle
layer.update({ box: { draped: false } });
```
