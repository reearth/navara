---
title: 3D Tiles Source
description: A 3d-tiles (3D Tiles tileset) source
sidebar:
  order: 360
---

A `3d-tiles` source points at a 3D Tiles tileset (a `tileset.json` hierarchy). Render it with a [`3d-tiles`](../../../three/layer/3d-tiles-layer/) layer.

## Properties

| Property | Type         | Default    | Description                                 |
| -------- | ------------ | ---------- | ------------------------------------------- |
| `type`   | `"3d-tiles"` | (required) | Source type.                                |
| `url`    | `string`     | (required) | URL of the `tileset.json`.                  |
| `crs`    | `string`     | —          | Coordinate reference system of the content. |

## Example

```typescript
import ThreeView from "@navara/three";

const tileset = view.addSource({
  type: "3d-tiles",
  url: "https://example.com/tileset.json",
});
view.addLayer({ type: "3d-tiles", source: tileset, model: { opacity: 1.0 } });
```

## Related Resources

- [About Source](../../../three/source/about/)
- [ModelMaterial](../../../three/material/model-material/) — 3D model rendering options
