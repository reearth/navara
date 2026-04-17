---
title: AxesHelperLayer
description: Axes helper layer for navara_three
sidebar:
  order: 114
---

`AxesHelperLayer` is a helper layer for adding a Three.js `AxesHelper` to the scene. It visualizes the 3 axes as X (red) / Y (green) / Z (blue), which is useful for verifying coordinate systems and debugging.

## Properties

### axesHelper

**Type:** `object | undefined`

**Description:** Configuration for the helper.

#### size

**Type:** `number | undefined`

**Description:** Specifies the length of the axes.

**Default:** `5`

**Note:** Size is only applied at creation time. To change it, recreate the layer.

## Usage Example

```typescript
import ThreeView, { AxesHelperLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// Add a 3-axis helper
const axes = view.addMesh<AxesHelperLayer>({
  axesHelper: {
    size: 10,
  },
  position: { x: 0, y: 0, z: 0 },
});

// Toggle visibility
axes.update({ visible: false });
```

## Tips

- You can place it at any position by specifying `position`, not just near the origin.
- If it overlaps with other meshes, adjust the camera or position for better visibility.
