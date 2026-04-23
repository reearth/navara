---
title: ThreeView Properties
description: API Reference for ThreeView Class Properties and Events
sidebar:
  order: 14
---

このページでは、ThreeView インスタンスで利用可能なすべてのプロパティとイベントを説明します。

## Properties

### camera

**Type:** `ThreeViewCamera`

**Read-only** (getter)

ビューの位置、向き、投影を管理するカメラコントローラー。`raw` プロパティで Three.js の `PerspectiveCamera` にアクセスできます。

**Example:**

```tsx
// Three.js カメラの位置を取得
const position = view.camera.raw.position;

// カメラの視野角を変更
view.camera.raw.fov = 60;
view.camera.raw.updateProjectionMatrix();
```

### globe

**Type:** `Globe`

**Read-only** (getter)

地形、画像レイヤー、グローブ固有の設定を管理する Globe インスタンス。透明度、ワイヤーフレーム表示、標高ヒートマップのカラーマップなど、地球表示に関するさまざまなプロパティを制御できます。

**Example:**

```tsx
// グローブの透明度を設定
view.globe.transparent = true;
view.globe.opacity = 0.8;

// ワイヤーフレームモードを有効化
view.globe.wireframe = true;

// 標高ヒートマップ用カラーマップを設定
view.globe.elevationColormap = customColorMap;
```

:::tip[関連ドキュメント]
詳細は [Globe クラス](../../../three/api-reference/globe/) を参照してください。
:::

### atmosphere

**Type:** `Atmosphere`

**Read-only** (getter)

大気システムを管理するインスタンス。太陽と月の位置計算、大気散乱テクスチャの管理を行います。`date` プロパティを変更すると、天体暦に基づいて太陽・月の方向が自動的に再計算され、`SunLightDesc` や `SkyMeshDesc` などの関連 Descriptor に反映されます。

**Example:**

```tsx
// 日時を設定して太陽位置を変更
view.atmosphere.setDate(new Date("2024-06-21T12:00:00"));

// 太陽の方向ベクトルを取得
const sunDirection = view.atmosphere.getSunDirection();

// 現在地が夜かどうかを判定
const isNight = view.atmosphere.isAtNight(view.camera.position);

// 太陽方向の変更を監視
view.atmosphere.on("sunChanged", (sunDirection) => {
  console.log("太陽方向が変更されました:", sunDirection);
});
```

:::tip[関連ドキュメント]
詳細は [Atmosphere クラス](../../../three/api-reference/atmosphere/) を参照してください。
:::

### toneMappingExposure

**Type:** `number`

HDR レンダリングのためのトーンマッピング露出値を取得または設定します。値を大きくすると明るく、小さくすると暗くなります。

**Example:**

```tsx
// 露出を上げて明るくする
view.toneMappingExposure = 1.5;

// 露出を下げて暗くする
view.toneMappingExposure = 0.8;
```

### animation

**Type:** `boolean`

連続アニメーションモードが有効かどうかを取得または設定します。`true` の場合は毎フレームレンダリング、`false` の場合は変更時のみレンダリングします。

**Example:**

```tsx
// 連続レンダリングを有効化
view.animation = true;

// 必要時のみレンダリング（省電力）
view.animation = false;
```

### screenSize

**Type:** `Vector2`

現在のスクリーンサイズをピクセル単位で取得します。

**読み取り専用**

**Example:**

```tsx
const size = view.screenSize;
console.log(`スクリーンサイズ: ${size.x} x ${size.y} ピクセル`);
```

### pixelRatio

**Type:** `number`

現在のデバイスピクセル比率を取得します。

**読み取り専用**

**Example:**

```tsx
const ratio = view.pixelRatio;
console.log(`ピクセル比率: ${ratio}`);
```

### shadowMapViewersEnabled

**Type:** `boolean`

シャドウマップのデバッグビューアが画面に表示されるかどうかを取得または設定します。

**Example:**

```tsx
// シャドウマップのデバッグビューを表示
view.shadowMapViewersEnabled = true;

// デバッグビューを非表示
view.shadowMapViewersEnabled = false;
```
