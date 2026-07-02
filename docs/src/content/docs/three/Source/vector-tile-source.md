---
title: Vector Tile Source
description: A vector-tile (MVT) source
sidebar:
  order: 12
---

A `vector-tile` source describes a Mapbox Vector Tiles (MVT) tileset. Render it with a [`vector`](../../../three/layer/vector-layer/) layer. Which source layers inside the tileset to render is chosen per layer via the layer's `sourceLayers` property.

## Properties

| Property            | Type            | Default    | Description                                              |
| ------------------- | --------------- | ---------- | ------------------------------------------------------- |
| `type`              | `"vector-tile"` | (required) | Source type.                                            |
| `url`               | `string`        | (required) | Tile URL template (contains `{z}/{x}/{y}`).             |
| `maxZoom`           | `number`        | `20`       | Maximum zoom level new tiles are requested for.         |
| `overscaledMaxZoom` | `number`        | `24`       | Maximum zoom overscaled (stretched-parent) tiles are used up to. |
| `maxSse`            | `number`        | `2.0`      | Maximum screen-space error driving tile traversal.      |
| `crs`               | `string`        | —          | Coordinate reference system of the tiles.               |

## Source sharing

Multiple `vector` layers can reference one vector-tile source; the tile data and traversal are shared, and each layer styles its own `sourceLayers`.

```typescript
import ThreeView, { Color } from "@navara/three";

const tiles = view.addSource({
  type: "vector-tile",
  url: "https://example.com/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});

view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["waterarea"],
  polygon: { color: new Color().setStyle("#00aaff"), clampToGround: true },
});

view.addLayer({
  type: "vector",
  source: tiles,
  sourceLayers: ["building"],
  polygon: { color: new Color().setStyle("#555555") },
});
```

## Related Resources

- [About Source](../../../three/source/about/)
- [Vector Layer](../../../three/layer/vector-layer/) — `point`, `polyline`, `polygon`, `text`, `billboard`
