---
title: ArrowHelperDesc
description: Arrow helper descriptor for navara_three
sidebar:
  order: 115
---

`ArrowHelperDesc` is a helper Descriptor for adding a Three.js `ArrowHelper` to the scene. It is suitable for visualizing direction vectors, representing wind direction or travel direction, and debugging purposes.

In addition to the properties below, all common properties from the base class (`position`, `rotation`, `scale`, `matrix`, `matrixWorld`, `pickable`, `visible`) are available. See [MeshDesc](./mesh-desc-base) for details.

## Properties

### arrowHelper

**Type:** `object | undefined`

**Description:** Configuration for the arrow helper.

#### direction

**Type:** `XYZ` (required)

**Description:** The direction vector of the arrow. Automatically normalized.

#### origin

**Type:** `XYZ | undefined`

**Description:** The origin coordinates of the arrow. Defaults to `{ x: 0, y: 0, z: 0 }` when omitted.

#### length

**Type:** `number | undefined`

**Description:** The length of the arrow.

**Default:** `1`

#### color

**Type:** `Color | undefined`

**Description:** Specifies the color of the arrow using a `Color` object.

**Default:** `new Color().setStyle("#ffffff")`

#### headLength

**Type:** `number | undefined`

**Description:** The length of the arrow head.

#### headWidth

**Type:** `number | undefined`

**Description:** The width of the arrow head.

## Usage Example

```typescript
import ThreeView, { ArrowHelperDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// A green arrow of length 5 pointing east
view.addMesh<ArrowHelperDesc>({
  arrowHelper: {
    direction: { x: 1, y: 0, z: 0 },
    origin: { x: 0, y: 0, z: 0 },
    length: 5,
    color: new Color().setHex(0x00ff00),
    headLength: 1,
    headWidth: 0.5,
  },
});
```

## Remarks

- `direction` is normalized before use.
- To update the `color`, you can use `update({ arrowHelper: { color } })`. Size changes (`length/headLength/headWidth`) can also be updated.
