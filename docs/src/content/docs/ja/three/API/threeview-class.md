---
title: ThreeView Class
description: API Reference for ThreeView Class Overview and Constructor
sidebar:
  order: 11
---

ThreeView は、Three.js と WebGL を使用して 3D マップビジュアライゼーションを作成・管理するためのメインクラスです。レイヤー管理、カメラ制御、レンダリング、イベント処理のための包括的な API を提供します。

## Example

```tsx
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { Vector3 } from "three";

// Create ThreeView instance
const view = new ThreeView({
  shadow: true,
  animation: true,
  backgroundColor: 0x0a0a0f,
  logarithmicDepthBuffer: true,
});
const plugin = new DefaultPlugin();
view.addPlugin(plugin);

// Initialize the view
await view.init();

// Add default photorealistic layers (sky, stars, sun, light probe)
const defaultLayers = plugin.addDefaultPhotorealScene();

// Add terrain layer
view.addLayer({
  type: "terrain",
  data: {
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

// Add raster tile layer
view.addLayer({
  type: "tiles",
  data: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  rasterTile: {
    color: new Color().setHex(0xffffff),
    maxZoom: 23,
    opacity: 1,
  },
});

// Set camera position
view.setCamera({
  lng: 139.7,
  lat: 35.7,
  height: 1000,
  pitch: -45,
  heading: 0,
  roll: 0,
});
```

## Properties

### container

**Type:** `HTMLElement | undefined`

**Description:** ビューをレンダリングする HTML コンテナ要素。指定された場合、ThreeView はこのコンテナ内に canvas を追加します。

**Example:**

```typescript
const view = new ThreeView({
  container: document.getElementById("map") ?? undefined,
});
```

### canvas

**Type:** `HTMLCanvasElement | OffscreenCanvas | undefined`

**Description:** レンダリングに使用する canvas 要素。指定された場合、この canvas を使用します。指定しない場合は新しい canvas が作成されます。

**Example:**

```typescript
const view = new ThreeView({
  canvas: document.getElementById("canvas") as HTMLCanvasElement,
});
```

### pixelRatio

**Type:** `number | undefined`

**Description:** デバイスピクセル比率のオーバーライド。高 DPI ディスプレイでのレンダリング品質に影響します。指定しない場合はデバイスのデフォルト値を使用します。

**Example:**

```typescript
const view = new ThreeView({
  pixelRatio: 2,
});
```

### disableAutoResize

**Type:** `boolean | undefined`

**Description:** ウィンドウリサイズイベント時の自動リサイズ処理を無効にするかどうか。`true` の場合、ウィンドウサイズの変更時に自動的にリサイズされません。

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  disableAutoResize: true,
});
```

### debug

**Type:** `boolean | undefined`

**Description:** デバッグモードを有効にするかどうか。`true` の場合、パフォーマンス統計オーバーレイなどの追加デバッグ情報が表示されます。

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  debug: true,
});
```

### atmosphere

**Type:** `AtmosphereOptions | undefined`

**Description:** 大気レンダリングの設定オプション。空、太陽、大気散乱効果の設定を行います。`date` プロパティで指定した日時に基づいて太陽と月の位置が自動計算され、`SunLightDesc` などの関連レイヤーに反映されます。

```typescript
export type AtmosphereOptions = {
  atmosphereAssetsUrl?: string; // 大気アセットファイルの URL
  stbnUrl?: string; // STBNテクスチャの URL
  date?: Date; // 太陽・月の位置計算に使用する日時
};
```

**Example:**

```typescript
const view = new ThreeView({
  atmosphere: {
    atmosphereAssetsUrl: "/assets/atmosphere",
    date: new Date("2024-06-21T12:00:00"),
  },
});

// 初期化後に日時を変更可能
await view.init();
view.atmosphere.date = new Date("2024-12-21T18:00:00");
```

:::tip[関連ドキュメント]
大気システムの詳細については [Atmosphere クラス](../../../three/api-reference/atmosphere/) を参照してください。
:::

### backgroundColor

**Type:** `Color | undefined`

**Description:** シーンの背景色。`Color` クラスのインスタンスを指定します。

**Default:** `0x0a0a0f`（暗い青灰色）

**Example:**

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({
  backgroundColor: new Color().setHex(0x1a1a2e),
});
```

:::note
コンストラクタでは数値（16進数カラーコード）を直接渡すことも可能ですが、内部的には `Color` オブジェクトとして処理されます。
:::

### picking

**Type:** `boolean | undefined`

**Description:** 地物ピッキングの設定オプション。有効にすると、地物をクリックした際に `pick` イベントが発火します。

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  picking: true,
});

// pick イベントを監視
view.on("pick", (info) => {
  if (info) {
    console.log("選択された地物:", info.properties);
  }
});
```

### animation

**Type:** `boolean | undefined`

**Description:** メインループを毎フレーム実行するかどうか。`true` の場合、連続的にレンダリングされます。`false` の場合、変更時または `forceUpdate()` が呼び出されたときのみレンダリングされます。

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  animation: true,
});
```

### multisampling

**Type:** `number | undefined`

**Description:** MSAA（マルチサンプル・アンチエイリアシング）のサンプル数。0 の場合は MSAA が無効になります。パフォーマンスへの影響があるため、使用する場合は注意が必要です。

**Default:** `0`

**Example:**

```typescript
const view = new ThreeView({
  multisampling: 4,
});
```

### halfFloat

**Type:** `boolean | undefined`

**Description:** ポストプロセッシングに半精度浮動小数点数（half-float）を使用するかどうか。`true` の場合、レンダリング品質が向上します。

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  halfFloat: true,
});
```

### logarithmicDepthBuffer

**Type:** `boolean | undefined`

**Description:** 対数深度バッファを使用するかどうか。`true` の場合、大規模なスケールでの深度精度が向上します。一部のエフェクトはこれをサポートしていないため、そのような場合は `false` に設定する必要があります。

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  logarithmicDepthBuffer: true,
});
```

### shadow

**Type:** `boolean | undefined`

**Description:** シャドウマッピングを有効にするかどうか。初期化時に指定する必要があり、後から変更することはできません。

**Default:** `false`

**Example:**

```typescript
const view = new ThreeView({
  shadow: true,
});
```

### selectiveEffects

**Type:** `{ debugViews?: boolean } | undefined`

**Description:** セレクティブポストプロセッシングエフェクト（特定のオブジェクトにのみ適用されるエフェクト）の設定。`debugViews` を `true` にすると、セレクティブエフェクトマスクのデバッグビューが表示されます。

**Default:** `{ debugViews: false }`

**Example:**

```typescript
const view = new ThreeView({
  selectiveEffects: { debugViews: true },
});
```

### mobileOptimization

**Type:** `boolean | undefined`

**Description:** モバイルデバイス向けの最適化を有効にするかどうか。`true` の場合、低いピクセル比率やエフェクトの軽量化など、モバイルデバイスに適した設定が適用されます。

**Default:** `true`

**Example:**

```typescript
const view = new ThreeView({
  mobileOptimization: true,
});
```

### waterTexture

**Type:** `{ enabled: boolean; url?: string } | undefined`

**Description:** 共有水テクスチャの設定。有効にすると、水エフェクトを使用するすべてのメッシュで単一の水ノーマルテクスチャが共有されます。これにより、各メッシュが個別にテクスチャを読み込むよりも効率的になります。

**Default:** `{ enabled: true }`

```typescript
type WaterTextureOptions = {
  enabled: boolean; // 水テクスチャの共有を有効にするかどうか
  url?: string; // カスタム水ノーマルテクスチャの URL（省略時はビルトインテクスチャを使用）
};
```

**Example:**

```typescript
// ビルトインテクスチャを使用
const view = new ThreeView({
  waterTexture: { enabled: true },
});

// カスタムテクスチャを使用する場合
const viewWithCustomWater = new ThreeView({
  waterTexture: {
    enabled: true,
    url: "https://example.com/water-normal.png",
  },
});
```

### GlobeOptions

**Type:** `GlobeOptions`

**Description:** 地球表示に関する追加オプション。ThreeView のコンストラクタオプションは GlobeOptions を継承しています。

```typescript
type GlobeOptions = {
  maxSse?: number; // LOD 計算のためのスクリーンスペースエラー閾値（初期化時のみ）
  segments?: number; // メッシュテッセレーションのセグメント数（初期化時のみ）
  color?: Color; // 地球表面の基本色
  hideUnderground?: boolean; // 地下のジオメトリを非表示にするかどうか
  shouldComputeNormalFromVertex?: boolean; // 頂点位置から法線を計算するかどうか（初期化時のみ）
  transparent?: boolean; // マテリアルを透明にするかどうか
  opacity?: number; // マテリアルのグローバル不透明度（0.0〜1.0）
  wireframe?: boolean; // ワイヤーフレームモードでレンダリングするかどうか
};
```

:::warning
`hideUnderground` を無効にすると、エフェクトレイヤーによっては予期しない動作が発生する可能性があります。
:::

:::tip[関連ドキュメント]
各プロパティの詳細と使用例は [Globe クラス](../../../three/api-reference/globe/) を参照してください。
:::

**Example:**

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({
  maxSse: 2,
  segments: 10,
  color: new Color().setHex(0x1a1a2e),
  hideUnderground: true,
  wireframe: false,
});
```
