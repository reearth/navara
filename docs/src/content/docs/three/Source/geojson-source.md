---
title: GeoJSON Source
description: A geojson source (from a URL or inline)
sidebar:
  order: 310
---

A `geojson` source provides vector data from a GeoJSON document, either fetched from a URL or given inline. Render it with a [`vector`](../../../three/layer/vector-layer/) layer.

## Properties

| Property | Type                                          | Default    | Description                                                                 |
| -------- | --------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `type`   | `"geojson"`                                   | (required) | Source type.                                                               |
| `url`    | `string`                                      | —          | URL to fetch the GeoJSON from. Mutually exclusive with `data`; takes precedence when both are given. |
| `data`   | `FeatureCollection \| Feature \| Geometry`    | —          | Inline GeoJSON document. Used when `url` is not given.                     |
| `crs`    | `string`                                      | —          | Coordinate reference system of the data.                                   |
| `tiled`  | `boolean`                                     | `false`    | Build a tiled spatial index (GeoJSON-VT) for large datasets.              |

## Examples

```typescript
import ThreeView from "@navara/three";

// From a URL
const roads = view.addSource({
  type: "geojson",
  url: "https://example.com/roads.geojson",
});
view.addLayer({ type: "vector", source: roads, polyline: { color: 0xffffff } });

// Inline
const pins = view.addSource({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [139.767, 35.681] }, properties: {} },
    ],
  },
});
view.addLayer({ type: "vector", source: pins, point: { color: 0xff0000, size: 8 } });
```

## Related Resources

- [About Source](../../../three/source/about/)
- [Vector Layer](../../../three/layer/vector-layer/) — `point`, `polyline`, `polygon`, `text`, `billboard`
