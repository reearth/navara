---
title: Globe Class
description: API Reference for Globe Class - 地球表示の設定を管理するクラス
sidebar:
  order: 21
---

Globe クラスは、地球表示に関するプロパティへのアクセスと変更を行うためのインターフェースを提供します。VectorTile、RasterTile、RasterTerrain など、異なるマテリアルタイプ間で共有される地球表示の設定を管理します。

## アクセス方法

Globe インスタンスは、ThreeView の `globe` プロパティを通じてアクセスします。

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView();

await view.init();

// Globe インスタンスにアクセス
const globe = view.globe;

// プロパティを変更
globe.wireframe = true;
globe.opacity = 0.8;
```

## Properties

### maxSse

**Type:** `number`

**Description:** LOD（Level of Detail）計算のためのスクリーンスペースエラー閾値。値が小さいほど詳細なタイルが読み込まれます。

**Default:** `2.0`

:::warning
このプロパティは初期化時のみ有効です。ThreeView のコンストラクタで設定してください。
:::

**Example:**

```typescript
// コンストラクタで設定
const view = new ThreeView({
  maxSse: 1.5,
});

// 現在の値を取得
console.log(view.globe.maxSse);
```

---

### segments

**Type:** `number`

**Description:** メッシュテッセレーションのセグメント数。値が大きいほど滑らかな地球表面になりますが、パフォーマンスへの影響があります。

**Default:** `64`

:::warning
このプロパティは初期化時のみ有効です。ThreeView のコンストラクタで設定してください。
:::

**Example:**

```typescript
// コンストラクタで設定
const view = new ThreeView({
  segments: 32,
});

// 現在の値を取得
console.log(view.globe.segments);
```

---

### color

**Type:** `Color | undefined`

**Description:** 地球表面の基本色。タイルが読み込まれる前や、タイルがない領域で表示される色を設定します。

**Example:**

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView();

await view.init();

// 色を設定
view.globe.color = new Color().setHex(0x1a1a2e);

// CSS カラー文字列から設定
view.globe.color = new Color().setStyle("#2d3436");
```

---

### hideUnderground

**Type:** `boolean`

**Description:** 地下のジオメトリを非表示にするかどうか。カメラが地球表面の下に入った場合の表示を制御します。

**Default:** `true`

:::warning
この値を無効にすると、エフェクトレイヤーを使用している場合に予期しない動作が発生する可能性があります。
:::

**Example:**

```typescript
// 地下表示を有効化（地下モデルの可視化など）
view.globe.hideUnderground = false;

// 地下表示を無効化（デフォルト）
view.globe.hideUnderground = true;
```

---

### shouldComputeNormalFromVertex

**Type:** `boolean`

**Description:** 頂点位置から法線を計算するかどうか。ライティング計算に影響します。

**Default:** `true`

:::warning
このプロパティは初期化時のみ有効です。ThreeView のコンストラクタで設定してください。
:::

**Example:**

```typescript
// コンストラクタで設定
const view = new ThreeView({
  shouldComputeNormalFromVertex: true,
});
```

---

### transparent

**Type:** `boolean`

**Description:** マテリアルを透明にするかどうか。`true` に設定すると、`opacity` プロパティで透明度を調整できます。

**Default:** `false`

:::note
ブレンディングはリソースレイヤーでのみ機能します。
:::

**Example:**

```typescript
// 透明度を有効化
view.globe.transparent = true;
view.globe.opacity = 0.7;
```

---

### opacity

**Type:** `number`

**Description:** マテリアルのグローバル不透明度（0.0〜1.0）。`transparent` が `true` の場合にのみ効果があります。

**Default:** `1.0`

**Example:**

```typescript
// 半透明に設定
view.globe.transparent = true;
view.globe.opacity = 0.5;

// 完全に不透明に戻す
view.globe.opacity = 1.0;
```

---

### wireframe

**Type:** `boolean`

**Description:** ワイヤーフレームモードでマテリアルをレンダリングするかどうか。デバッグやビジュアライゼーション目的で使用します。

**Default:** `false`

**Example:**

```typescript
// ワイヤーフレームモードを有効化
view.globe.wireframe = true;

// ワイヤーフレームモードを無効化
view.globe.wireframe = false;
```

---

### elevationColormap

**Type:** `ColorMap | undefined`

**Description:** 標高ヒートマップレンダリング用のカラーマップルックアップテーブル。`elevationHeatmap` レイヤーと組み合わせて使用し、標高に応じた色分け表示を実現します。

**Example:**

```typescript
import ThreeView, { ColorMap, Color } from "@navara/three";

const view = new ThreeView();

await view.init();

// ref: https://colorbrewer2.org/#type=sequential&scheme=YlGnBu&n=9
const ylGnBuColorMap = new ColorMap("sequential", "YlGnBu", [
  new Color().setStyle("#ffffd9"),
  new Color().setStyle("#edf8b1"),
  new Color().setStyle("#c7e9b4"),
  new Color().setStyle("#7fcdbb"),
  new Color().setStyle("#41b6c4"),
  new Color().setStyle("#1d91c0"),
  new Color().setStyle("#225ea8"),
  new Color().setStyle("#253494"),
  new Color().setStyle("#081d58"),
]);

view.globe.elevationColormap = ylGnBuColorMap;
```

:::tip[関連ドキュメント]
ColorMap クラスの詳細（メソッド、プロパティ、カラーマップパターン）については [ColorMap クラス](../../../three/api-reference/colormap/) を参照してください。
:::

## 標高ヒートマップの使用例

標高ヒートマップを表示するには、`elevationColormap` と `elevationHeatmap` レイヤーを組み合わせて使用します。

```typescript
import ThreeView, {
  ColorMap,
  Color,
  TERRARIUM_ELEVATION_DECODER,
} from "@navara/three";

const view = new ThreeView({
  animation: true,
});

await view.init();

// ref: https://colorbrewer2.org/#type=diverging&scheme=RdYlGn&n=11
const rdYlGnColorMap = new ColorMap("diverging", "RdYlGn", [
  new Color().setStyle("#006837"),
  new Color().setStyle("#1a9850"),
  new Color().setStyle("#66bd63"),
  new Color().setStyle("#a6d96a"),
  new Color().setStyle("#d9ef8b"),
  new Color().setStyle("#ffffbf"),
  new Color().setStyle("#fee08b"),
  new Color().setStyle("#fdae61"),
  new Color().setStyle("#f46d43"),
  new Color().setStyle("#d73027"),
  new Color().setStyle("#a50026"),
]);

view.globe.elevationColormap = rdYlGnColorMap;
view.globe.color = new Color().setStyle("#1a9850");

// 地形レイヤーを追加
view.addLayer({
  type: "terrain",
  data: {
    url: "https://example.com/terrain/{z}/{x}/{y}.png",
  },
  rasterTerrain: {
    maxZoom: 12,
    minZoom: 5,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
  },
});

// 標高ヒートマップレイヤーを追加
view.addLayer({
  type: "tiles",
  data: {
    url: "https://example.com/terrain/{z}/{x}/{y}.png",
  },
  rasterTile: {
    maxZoom: 15,
  },
  elevationHeatmap: {
    maxHeight: 3000,
    minHeight: 0,
    elevationDecoder: TERRARIUM_ELEVATION_DECODER(),
    logarithmic: true,
    logBoundary: 1000,
  },
});

view.setCamera({
  lng: 138.5,
  lat: 34,
  height: 100000,
  heading: 0,
  pitch: -30,
  roll: 0,
});
```

## 初期化時プロパティの設定

一部のプロパティは初期化時のみ設定可能です。これらは ThreeView のコンストラクタオプションで指定します。

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({
  // 初期化時のみ設定可能なプロパティ
  maxSse: 2,
  segments: 64,
  shouldComputeNormalFromVertex: true,
  // 実行時に変更可能なプロパティ
  color: new Color().setHex(0x1a1a2e),
  hideUnderground: true,
  transparent: false,
  opacity: 1.0,
  wireframe: false,
});

await view.init();

// 初期化後は実行時プロパティのみ変更可能
view.globe.wireframe = true;
view.globe.opacity = 0.8;
```

## 関連項目

- [Color クラス](../../../three/api-reference/color/) - 色を表現するクラス
- [ColorMap クラス](../../../three/api-reference/colormap/) - カラーグラデーションの定義
- [ElevationHeatmapMaterial](../../../three/resource-layer-reference/elevation-heatmap-material/) - 標高ヒートマップマテリアル
- [ThreeView クラス](../../../three/api-reference/threeview-class/) - メインビュークラス
