---
title: GeoJSON Layer
description: How to use the GeoJSON layer
sidebar:
  order: 23
---

The GeoJSON layer is a layer for displaying geographic data in GeoJSON format. It supports various geometry types such as points, lines, and polygons.

## Basic Configuration

| Property   | Type                                          | Description              |
| ---------- | --------------------------------------------- | ------------------------ |
| `type`     | `"geojson"`                                   | Layer type (required)    |
| `data`     | `{ url: string }` or GeoJSON object           | Data source              |

## Supported Materials

You can specify multiple materials simultaneously depending on the geometry types in the data.

| Material                                                                         | Config key  | Supported geometry              |
| -------------------------------------------------------------------------------- | ----------- | ------------------------------- |
| [PointMaterial](../../../three/resource-layer-reference/point-material/)         | `point`     | Point, MultiPoint               |
| [BillboardMaterial](../../../three/resource-layer-reference/billboard-material/) | `billboard` | Point (icon display)            |
| [TextMaterial](../../../three/resource-layer-reference/text-material/)           | `text`      | Point (label display)           |
| [PolylineMaterial](../../../three/resource-layer-reference/polyline-material/)   | `polyline`  | LineString, MultiLineString     |
| [PolygonMaterial](../../../three/resource-layer-reference/polygon-material/)     | `polygon`   | Polygon, MultiPolygon           |
| [ModelMaterial](../../../three/resource-layer-reference/model-material/)         | `model`     | Point (3D model placement)      |

## Usage Examples

### Point Features

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const pointLayer = view.addLayer({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          coordinates: [139.70513431449842, 35.69279782617761],
          type: "Point",
        },
      },
      {
        type: "Feature",
        properties: {},
        geometry: {
          coordinates: [140.13033810546995, 35.60447056434825],
          type: "Point",
        },
      },
    ],
  },
  point: {
    color: new Color().setHex(0xffffff),
    size: 0.1,
    height: 1,
    scaleByDistance: true,
    clampToGround: true,
    transparent: false,
    depthTest: true,
  },
});
```

### Billboard Icons

```typescript
import ThreeView, { Color } from "@navara/three";

const billboardLayer = view.addLayer({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          coordinates: [138.73470764482283, 35.3627947204036],
          type: "Point",
        },
      },
    ],
  },
  billboard: {
    color: new Color().setHex(0xffffff),
    size: 0.05,
    height: 1,
    scaleByDistance: true,
    clampToGround: true,
    depthTest: true,
    transparent: false,
    url: "/example.png",
  },
});
```

### Text Labels

```typescript
import ThreeView, { Color } from "@navara/three";

const textLayer = view.addLayer({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          coordinates: [135.7672689034169, 35.011034421881675],
          type: "Point",
        },
      },
    ],
  },
  text: {
    color: new Color().setHex(0xffffff),
    height: 1,
    scaleByDistance: true,
    clampToGround: true,
    depthTest: true,
    text: "hello 京都",
    backgroundColor: new Color().setHex(0x0a70c2),
    borderColor: new Color().setHex(0xf8e43c),
    borderWidth: 0.08,
    cornerRadius: 0.1,
    size: 50,
    center: { x: 0.5, y: 0 },
    padding: { x: 10, y: 0 },
  },
});
```

### Polylines

```typescript
import ThreeView, { Color } from "@navara/three";

const polylineLayer = view.addLayer({
  type: "geojson",
  data: {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [138.64270223212833, 35.42793245331515],
        [138.8398612065625, 35.42635304536398],
        [138.64071756664583, 35.33027587314082],
        [138.8449071750585, 35.32671062382879],
      ],
      type: "LineString",
    },
  },
  polyline: {
    show: true,
    color: new Color().setHex(0xff0000),
    width: 2,
    height: 1,
    clampToGround: true,
    useGroundNormals: true,
  },
});
```

### Polygons

```typescript
import ThreeView, { Color } from "@navara/three";

const polygonLayer = view.addLayer({
  type: "geojson",
  data: {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [
          [138.66861922558115, 35.46838056308519],
          [138.6559918549957, 35.29164005065681],
          [138.81174182884172, 35.279838616806046],
          [138.8071009152797, 35.436389815907134],
          [138.66861922558115, 35.46838056308519],
        ],
      ],
      type: "Polygon",
    },
  },
  polygon: {
    color: new Color().setHex(0x00aaff),
    height: 0,
    extrudedHeight: 5000,
    clampToGround: true,
    useGroundNormals: true,
    wireframe: false,
    outlineColor: new Color().setHex(0x00ff00),
    outlineWidth: 3,
    outlineShow: false,
    surfaceShow: true,
    castShadow: true,
    receiveShadow: true,
  },
});
```

### 3D Model Placement

```typescript
import ThreeView, { Color } from "@navara/three";

const modelLayer = view.addLayer({
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          coordinates: [127.7, 26.2],
          type: "Point",
        },
      },
    ],
  },
  model: {
    show: true,
    size: 200000,
    height: 0,
    clampToGround: true,
    url: "/example.gltf",
    shouldRotateInDefault: true,
    color: new Color().setHex(0xffffff),
    metalness: 0.1,
    roughness: 0.1,
  },
});
```

## Related Resources

- [MVT Layer](../../../three/resource-layer-reference/mvt-layer/) - Display data in vector tile format
- [PointMaterial](../../../three/resource-layer-reference/point-material/) - Detailed point material settings
- [PolygonMaterial](../../../three/resource-layer-reference/polygon-material/) - Detailed polygon material settings
