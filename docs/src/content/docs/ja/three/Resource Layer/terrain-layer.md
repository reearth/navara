---
title: Terrain Layer
description: 地形レイヤーの使い方
sidebar:
  order: 25
---

Terrain レイヤーは 3D 地形を表示するためのレイヤーです。データソースとして、GPU 側でデコードする PNG 形式の標高タイル（DEM）と、Cesium Ion などのエンドポイントから配信される事前メッシュ化済みの quantized-mesh タイルの 2 種類をサポートします。

## 基本設定

| プロパティ | 型                | 説明                                                     |
| ---------- | ----------------- | -------------------------------------------------------- |
| `type`     | `"terrain"`       | レイヤータイプ（必須）                                   |
| `data`     | `{ url: string }` | 地形タイルの URL（`{z}/{x}/{y}` プレースホルダーを含む）。ラスター DEM の場合は `.png` / `.webp`、quantized-mesh の場合は `.terrain` を指定します。 |

## 対応マテリアル

| マテリアル                                                                                                | 設定キー         | 説明                                                              |
| --------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/)                 | `rasterTerrain`  | PNG/WebP DEM 向けの地形の外観と標高デコーダーを設定               |
| [QuantizedMeshTerrainMaterial](../../../three/resource-layer-reference/quantized-mesh-terrain-material/)  | `quantizedMesh`  | quantized-mesh タイルソース向けの地形マテリアル設定               |

## 使用例

### 国土地理院 DEMタイル

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

const view = new ThreeView(/* options */);
await view.init();

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Mapbox Terrain-RGB

```typescript
import ThreeView, { MAPBOX_ELEVATION_DECODER } from "@navara/three";

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - © Mapbox Terrain-RGB
    //   https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/
    url: "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=YOUR_ACCESS_TOKEN",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: MAPBOX_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### Terrarium 形式

```typescript
import ThreeView, { TERRARIUM_ELEVATION_DECODER } from "@navara/three";

const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/elevation-tiles/terrarium/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 15,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

:::note
事前定義されたデコーダー定数の詳細は [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/#pre-defined-constants) を参照してください。
:::

### Quantized-Mesh（Cesium Ion）

Cesium Ion の quantized-mesh アセットでは、アセットエンドポイント URL とアクセストークンを実行時に解決する必要があるため、`addLayer` を直接呼ぶ代わりに [`CesiumIonPlugin`](../../../three_plugins/cesiumionplugin/) を使うことを推奨します。

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { CesiumIonPlugin } from "@navara/three_plugins";

const view = new ThreeView(/* options */);
const cesiumIon = new CesiumIonPlugin({
  assetId: 1, // Cesium World Terrain
  accessToken: "<your cesium ion token>",
});

view.addPlugin(new DefaultPlugin());
view.addPlugin(cesiumIon);
await view.init();

cesiumIon.addTerrain({
  maxZoom: 18,
  castShadow: true,
  receiveShadow: true,
  requestVertexNormals: true,
  requestWaterMask: true,
});
```

### Quantized-Mesh（セルフホストエンドポイント）

タイル URL を直接指定し、`quantizedMesh` マテリアルを設定することもできます。

```typescript
const terrainLayer = view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/{z}/{x}/{y}.terrain",
  },
  quantizedMesh: {
    maxZoom: 18,
    castShadow: true,
    receiveShadow: true,
    requestVertexNormals: true,
    requestWaterMask: true,
  },
});
```

## 関連リソース

- [Tile Layer](../../../three/resource-layer-reference/tile-layer/) - ラスタータイルを表示
- [RasterTerrainMaterial](../../../three/resource-layer-reference/raster-terrain-material/) - 地形マテリアルの詳細設定
- [QuantizedMeshTerrainMaterial](../../../three/resource-layer-reference/quantized-mesh-terrain-material/) - quantized-mesh マテリアルの詳細設定
- [CesiumIonPlugin](../../../three_plugins/cesiumionplugin/) - Cesium Ion の quantized-mesh アセットを解決して terrain レイヤーとして登録
