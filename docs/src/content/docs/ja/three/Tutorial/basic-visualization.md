---
title: Basic Visualization
description: 地図表示、地形表示、GIS データ表示の基本的な実装方法
sidebar:
  order: 4
---

このチュートリアルでは、navara_three を使って地図を表示する基本的な方法を説明します。

## セットアップ

navara_three の新しいプロジェクトを作成し、必要なライブラリをインストールします：

```bash
npm create navara-three-starter my-navara-app
cd my-navara-app
npm install
```

## 地図を表示する

### ラスタレイヤーを追加する

`index.html` を開くと、以下のようになっています。

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Navara Three</title>
  </head>
  <body style="margin: 0; overflow: hidden">
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

次に、`src/main.ts` を開くと、以下のようになっています。

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({});
view.addPlugin(plugin);
await view.init();
```

`DefaultPlugin` を追加することで、メッシュ・エフェクト・ライトのデフォルト Descriptor が利用可能になります。

`main.ts` に以下のコードを追加します。

```typescript
// Add basic ambient light
view.addLight({
  ambient: {},
});

// Add OpenStreetMap tile layer
const osmSource = view.addSource({
  type: "raster-tile",
  // Credit:
  // - © OpenStreetMap contributors
  //   https://www.openstreetmap.org/copyright
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: osmSource,
});
```

### 実行結果

シーン上の地球儀に背景地図が表示されます。

![Basic Map](@assets/tutorial/basemap.png)

### コードの説明

**ThreeView の初期化**

```typescript
const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({});
view.addPlugin(plugin);
await view.init();
```

`ThreeView` インスタンスを作成し、`DefaultPlugin` でデフォルト Descriptor を登録してから初期化します。これにより、3D シーンとカメラが設定されます。

**ライトの追加**

```typescript
view.addLight({
  ambient: {},
});
```

シーンを照らすための基本的な環境光を追加します。

**ラスタレイヤーの追加**

```typescript
const osmSource = view.addSource({
  type: "raster-tile",
  // Credit:
  // - © OpenStreetMap contributors
  //   https://www.openstreetmap.org/copyright
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: osmSource,
});
```

OpenStreetMap のラスタタイルを使用して地図レイヤーを追加します。

### 完全なコード

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// Add OpenStreetMap tile layer
const osmSource = view.addSource({
  type: "raster-tile",
  // Credit:
  // - © OpenStreetMap contributors
  //   https://www.openstreetmap.org/copyright
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: osmSource,
});
```

## カメラ位置を設定する

### カメラ位置を設定

特定の場所に地図を表示するには、カメラの位置を設定します。`main.ts` に以下を追加します：

```typescript
view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```

### 実行結果

東京周辺にカメラの位置が設定されます。

![Camera Map](@assets/tutorial/camera.png)

### コードの説明

`view.setCamera()` メソッドを使用して、カメラの位置と向きを設定できます。パラメータの詳細については、[ThreeView Functions](../../../three/api/threeview-functions/) を参照してください。

### 完全なコード

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// Add OpenStreetMap tile layer
const osmSource = view.addSource({
  type: "raster-tile",
  // Credit:
  // - © OpenStreetMap contributors
  //   https://www.openstreetmap.org/copyright
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: osmSource,
});

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```

## 地形を表示する

このチュートリアルでは、前のステップで作成した地図に地形データを追加する方法を学びます。

### 地形レイヤーを追加する

`src/main.ts` に地形レイヤーを追加します。

まずは、地形タイルをデコードするために JAPAN_GSI_ELEVATION_DECODER をインポートします。

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
```

ラスタタイルレイヤーの**前**に地形レイヤーを追加してください（レイヤーは追加順に描画されます）：

```typescript
// Add terrain layer
const demSource = view.addSource({
  type: "raster-dem",
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  minZoom: 6,
  maxZoom: 15,
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
});
view.addLayer({
  type: "terrain",
  source: demSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: demSource,
  hillshade: {},
});
```

### 実行結果

地図を傾けると、地形の起伏を確認できます。

![Terrain Map](@assets/tutorial/terrain.png)

### コードの説明

**地形データソース**

```typescript
// Credit:
// - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
//   https://maps.gsi.go.jp/development/ichiran.html
url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
```

ここでは、国土地理院の標高タイルを使用します。

**地形設定**

```typescript
source: view.addSource({
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  minZoom: 6,
  maxZoom: 15,
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
}),
terrain: {
  castShadow: true,
  receiveShadow: true,
},
```

- 地形タイルの最大ズームレベル、最小ズームレベル、影などを設定しています。
- elevationDecoder で、地形データをデコードします。

詳細については、[Terrain Layer](../../../three/layer/terrain-layer/) を参照してください。

### 完全なコード

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// Add terrain layer
const demSource = view.addSource({
  type: "raster-dem",
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  minZoom: 6,
  maxZoom: 15,
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
});
view.addLayer({
  type: "terrain",
  source: demSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: demSource,
  hillshade: {},
});

// Add OpenStreetMap tile layer
const osmSource = view.addSource({
  type: "raster-tile",
  // Credit:
  // - © OpenStreetMap contributors
  //   https://www.openstreetmap.org/copyright
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: osmSource,
});

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```

## GeoJSON データを表示する

このチュートリアルでは、GeoJSON データを使用して地図上にポリゴンを表示する方法を学びます。

### GeoJSON レイヤーを追加する

`src/main.ts` に GeoJSON レイヤーを追加します。

```typescript
// Display polygon data
const geojsonSource = view.addSource({
  type: "geojson",
  data: {
    type: "Feature",
    properties: { name: "Area" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.75843063805576, 35.70688252862743],
          [139.75843063805576, 35.700933240062355],
          [139.77157543771887, 35.700933240062355],
          [139.77157543771887, 35.70688252862743],
          [139.75843063805576, 35.70688252862743],
        ],
      ],
    },
  },
});
view.addLayer({
  type: "vector",
  source: geojsonSource,
  polygon: {
    color: new Color().setHex(0x00ff00),
    height: 0,
    opacity: 0.5,
    transparent: true,
  },
});
```

### 実行結果

地図上にポリゴンが表示されます。

![GeoJSON Map](@assets/tutorial/geojson.png)

### コードの解説

`view.addSource({ type: "geojson", ... })` で GeoJSON データを Source として登録し、`view.addLayer({ type: "vector", source, ... })` で描画します。`polygon` Material を通じてポリゴンのスタイル設定（色、高さ、透明度など）も指定できます。

詳細については、[Vector Layer](../../../three/layer/vector-layer/) を参照してください。

### 完全なコード

すべてを組み合わせた完全な例：

```typescript
import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

const demSource = view.addSource({
  type: "raster-dem",
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  minZoom: 6,
  maxZoom: 15,
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
});
view.addLayer({
  type: "terrain",
  source: demSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: demSource,
  hillshade: {},
});

const osmSource = view.addSource({
  type: "raster-tile",
  // Credit:
  // - © OpenStreetMap contributors
  //   https://www.openstreetmap.org/copyright
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: osmSource,
});

// Polygon (area)
const geojsonSource = view.addSource({
  type: "geojson",
  data: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.75843063805576, 35.70688252862743],
          [139.75843063805576, 35.700933240062355],
          [139.77157543771887, 35.700933240062355],
          [139.77157543771887, 35.70688252862743],
          [139.75843063805576, 35.70688252862743],
        ],
      ],
    },
  },
});
view.addLayer({
  type: "vector",
  source: geojsonSource,
  polygon: {
    color: new Color().setHex(0x00ff00),
    height: 0,
    opacity: 0.5,
    transparent: true,
  },
});

view.setCamera({
  lng: 139.7671,
  lat: 35.6812,
  height: 1000,
  heading: 0, // -180 to 180
  pitch: -30, // -180 to 0
  roll: 0, // -180 to 180
});
```
