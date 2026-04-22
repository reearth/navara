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

### ラスタタイルレイヤーを追加する

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
import { DefaultPlugin } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();
```

`DefaultPlugin` を追加することで、メッシュ・エフェクト・ライトのデフォルトDescriptorが利用可能になります。

`main.ts` に以下のコードを追加します。

```typescript
// 基本的な環境光を追加
view.addLight({
  ambient: {},
});

// OpenStreetMap タイルレイヤーを追加
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});
```

### 実行結果

シーン上の地球儀に背景地図が表示されます。

![Basic Map](@assets/tutorial/basemap.png)

### コードの説明

**ThreeView の初期化**

```typescript
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();
```

`ThreeView` インスタンスを作成し、`DefaultPlugin` でデフォルトDescriptorを登録してから初期化します。これにより、3D シーンとカメラが設定されます。

**ライトの追加**

```typescript
view.addLight({
  ambient: {},
});
```

シーンを照らすための基本的な環境光を追加します。

**タイルレイヤーの追加**

```typescript
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});
```

OpenStreetMap のラスタタイルを使用して地図レイヤーを追加します。

### 完全なコード

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// OpenStreetMap タイルレイヤーを追加
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
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

`view.setCamera()` メソッドを使用して、カメラの位置と向きを設定できます。パラメータの詳細については、[ThreeView Functions](../../../three/api-reference/threeview-functions/) を参照してください。

### 完全なコード

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// OpenStreetMap タイルレイヤーを追加
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
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
// 地形レイヤーを追加
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});
```

### 実行結果

地図を傾けると、地形の起伏を確認できます。

![Terrain Map](@assets/tutorial/terrain.png)

### コードの説明

**地形データソース**

```typescript
data: {
// Credit:
// - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
//   https://maps.gsi.go.jp/development/ichiran.html
url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
},
```

ここでは、国土地理院の標高タイルを使用します。

**地形設定**

```typescript
rasterTerrain: {
minZoom: 6,
maxZoom: 15,
elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
castShadow: true,
receiveShadow: true,
},
```

- 地形タイルの最大ズームレベル、最小ズームレベル、影などを設定しています。
- elevationDecoder で、地形データをデコードします。

詳細については、[Terrain Layer](../../../three/resource-layer-reference/terrain-layer/) を参照してください。

### 完全なコード

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

// ThreeView インスタンスを作成
const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

// 地形レイヤーを追加
view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});

// OpenStreetMap タイルレイヤーを追加
view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
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

## GeoJSON データを表示する

このチュートリアルでは、GeoJSON データを使用して地図上にポリゴンを表示する方法を学びます。

### GeoJSON レイヤーを追加する

`src/main.ts` に GeoJSON レイヤーを追加します。

```typescript
// ポリゴンデータを表示
view.addLayer({
  type: "geojson",
  data: {
    type: "Feature",
    properties: { name: "エリア" },
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

`view.addLayer` メソッドで GeoJSON レイヤーを追加します。`type: "geojson"` を指定すると、GeoJSON 形式のデータを地図上に表示できます。ポリゴンのスタイル設定（色、高さ、透明度など）も指定できます。

詳細については、[GeoJSON Layer](../../../three/resource-layer-reference/geojson-layer/) を参照してください。

### 完全なコード

すべてを組み合わせた完全な例：

```typescript
import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

view.addLight({
  ambient: {},
});

view.addLayer({
  type: "terrain",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    minZoom: 6,
    maxZoom: 15,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - © OpenStreetMap contributors
    //   https://www.openstreetmap.org/copyright
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 23,
  },
});

// ポリゴン（エリア）
view.addLayer({
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
