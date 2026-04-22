---
title: Mesh Layer
description: Mesh layer types for navara_three
sidebar:
  order: 100
---

`MeshLayer` is a layer type for adding 3D mesh objects to the scene. It can display various 3D objects.

All mesh layers inherit from [`MeshLayerDeclaration`](./mesh-layer-base), which provides common properties such as `position`, `rotation`, `scale`, `matrix`, `matrixWorld`, and `pickable`. See the [MeshLayerDeclaration](./mesh-layer-base) page for details on transform composition, picking, and coordinate transformation.

## Available MeshLayer Types

The following MeshLayer types are available in navara_three:

| Layer Type | Description |
|------------|------|
| [ArclineMeshLayer](./arcline-mesh-layer) | A layer that draws arc-shaped lines connecting two points |
| [BoxMeshLayer](./box-mesh-layer) | A layer that draws box geometry |
| [InstancedBoxMeshLayer](./instanced-box-mesh-layer) | A GPU-instanced layer that renders multiple boxes in a single draw call |
| [CylinderMeshLayer](./cylinder-mesh-layer) | A layer that draws cylinder geometry |
| [GLTFModelLayer](./gltf-model-layer) | A layer that loads and displays GLTF/GLB format 3D models |
| [GlowGlobeMeshLayer](./glow-globe-mesh-layer) | A layer that displays a Fresnel-effect glow around the globe |
| [PlaneMeshLayer](./plane-mesh-layer) | A layer that draws plane geometry |
| [RainMeshLayer](./rain-mesh-layer) | A layer that displays rain particle effects |
| [SkyBoxMeshLayer](./sky-box-mesh-layer) | A layer that draws a simple skybox |
| [SkyMeshLayer](./sky-mesh-layer) | A layer that draws the sky, sun, and moon using atmospheric scattering |
| [SmoothLineMeshLayer](./smooth-line-mesh-layer) | A layer that draws smooth lines using Catmull-Rom curves |
| [SnowMeshLayer](./snow-mesh-layer) | A layer that displays snow particle effects |
| [SphereMeshLayer](./sphere-mesh-layer) | A layer that draws sphere geometry |
| [StarsLayer](./stars-layer) | A layer that draws a starry sky |
| [TubeMeshLayer](./tube-mesh-layer) | A layer that draws tube geometry |
| [AxesHelperLayer](./axes-helper-layer) | A debug helper layer that visualizes the 3 axes |
| [ArrowHelperLayer](./arrow-helper-layer) | A debug helper layer that visualizes vector directions |

## Basic Usage

MeshLayer is added by registering the layer class and then calling the `view.addMesh()` method:

```typescript
import ThreeView, { Color } from "@navara/three";
import { BoxMeshLayer } from "@navara/three_default_layers";

const view = new ThreeView();

// Register the layer class
view.registerMesh("box", BoxMeshLayer);

await view.init();

// Add a BoxMeshLayer
const boxLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

For detailed usage, refer to the documentation for each layer type.
