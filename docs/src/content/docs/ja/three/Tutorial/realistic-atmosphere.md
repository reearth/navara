---
title: Realistic Atmosphere
description: 大気エフェクトを使用したリアルなビジュアル表現
sidebar:
  order: 6
---

![実行結果](@assets/tutorial/realistic-atmosphere-result.png)

大気エフェクトを使用して、よりリアルなビジュアル表現を実現します。

**このチュートリアルで学べること:**
- 大気遠近法（Aerial Perspective）エフェクトの追加
- 空・太陽・星のオブジェクト設定
- 雲エフェクトの追加
- トーンマッピングとアンチエイリアシングの設定
- 雨・雪エフェクトの追加
- 水面マテリアルの設定（国土地理院MVTデータ活用）

## 大気遠近法エフェクトを追加する

大気遠近法（Aerial Perspective）は、距離に応じた空気感・霞の効果を付与します。`DefaultPlugin` を使うと、すべてのデフォルトDescriptorが登録され、`addDefaultPhotorealScene()` でフォトリアルなシーンを一括セットアップできます。

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView({ shadow: true });
view.addPlugin(plugin);
await view.init();

// フォトリアルなシーンを一括セットアップ（空・太陽光・星・大気エフェクト・トーンマッピング・アンチエイリアシングなど）
const layers = plugin.addDefaultPhotorealScene();

// 必要に応じて Aerial Perspective を調整
layers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true, // 遅延ライティング(雲の影を表示するために必要)
  },
});

view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 23 },
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

view.setCamera({ lng: 139.7511, lat: 35.6736, height: 400, heading: -100, pitch: -20, roll: 0 });
```

`addDefaultPhotorealScene()` により、空・太陽光・星・スカイライトプローブなどの大気オブジェクトも自動で追加されています。影を落とすには太陽光の設定を更新します。

```typescript
layers.sun.update({ sun: { castShadow: true } }); // 影を落とす
```

:::caution[irradiance の注意点]
`irradiance` を有効にすると、透明なマテリアル（ガラスなど）の描画が安定しないことがあります。透明オブジェクトを多用する場合は `irradiance: false` を検討してください。
:::

## トーンマッピングとアンチエイリアシングを設定する

HDR らしい自然な見た目にするためにトーンマッピングと露出、アンチエイリアシングを設定します。

```typescript
// トーンマッピング
layers.toneMapping.update({ toneMapping: { mode: ToneMappingMode.AGX } });
view.toneMappingExposure = 10; // シーンに応じて調整

// アンチエイリアシング
// addDefaultPhotorealScene() はデスクトップで SMAA, モバイル最適化時は FXAA を自動選択します
```

## 雲エフェクトを追加する

体積雲エフェクトを重ねると臨場感が向上します。まずはデフォルト設定で追加し、必要に応じて影や密度を調整します。

```typescript
const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: {},
});

// 例: 雲の影を有効化
clouds.update({ clouds: { shadows: true } });
```

![実行結果](@assets/tutorial/realistic-atmosphere.png)

## 雨エフェクトを追加する

雨の表現には2つのオブジェクトを組み合わせて使用します。`RainMeshDesc` はシーン内に3D雨粒パーティクルを描画し、`RainDropEffectDesc` は画面に水滴が付着するポストエフェクトを提供します。

### 3D雨粒パーティクル

```typescript
// 雨のアニメーションを常に動かすために、アニメーションループを常に回す
view.animation = true;

// 雨オブジェクトを追加
const rain = view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000, // 雨粒の数
    speed: 0.0015,             // 落下速度
    opacity: 1.0,         // 不透明度
    width: 3,          // 雨粒の幅
    height: 60.0,          // 雨粒の長さ
    areaWidth: 500,       // 降雨エリアの幅(m)
    areaHeight: 1000,      // 降雨エリアの高さ(m)
    maxHeight: 10000,       // 降雨エリアの最大高さ(m)
  },
});
```

### 画面水滴エフェクト

雨天時にカメラレンズに付着する水滴を表現するポストエフェクトです。

```typescript
const rainDropEffect = view.addEffect<RainDropEffectDesc>({
  rainDrop: {
    opacity: 1.0,           // エフェクト全体の不透明度
    dropGridSize: 12,       // 水滴グリッドのサイズ
    dropDensity: 1,         // 水滴の密度
    dropLayers: 4,          // 水滴レイヤー数
    dropSizeFactor: 0.015,  // 水滴サイズ係数
    refractionStrength: 0.3, // 屈折の強さ
  },
});
```

:::tip[雨エフェクトの組み合わせ]
`RainMeshDesc` と `RainDropEffectDesc` を同時に有効にすることで、より臨場感のある雨の表現が可能です。
:::

![実行結果](@assets/tutorial/realistic-atmosphere-rain.png)

## 雪エフェクトを追加する

雪の表現は `SnowMeshDesc` を使用します。 雨オブジェクトを消して追加してみましょう。

```typescript
// 雪オブジェクトを追加
const snow = view.addMesh<SnowMeshDesc>({
  snow: {
    particleCount: 5000,  // 雪粒の数
    speed: 0.00005,           // 落下速度
    size: 10,              // 雪粒のサイズ
    opacity: 1,         // 不透明度
    areaWidth: 500,       // 降雪エリアの幅(m)
    areaHeight: 1000,      // 降雪エリアの高さ(m)
    maxHeight: 3000,       // 降雪エリアの最大高さ(m)
    // 風による揺らぎ
    movementStrength: { x: 50, y: 20, z: 50 }, // 各軸方向の揺れ幅
    movementSpeed: { x: 0.0005, y: 0.0002, z: 0.0005 }, // 各軸方向の揺れ速度
  },
});
```

:::caution[パフォーマンスの注意]
`particleCount` を増やすとリアルになりますが、モバイルデバイスではパフォーマンスに影響します。必要に応じて調整してください。
:::

![実行結果](@assets/tutorial/realistic-atmosphere-snow.png)

## 水面マテリアルを追加する（国土地理院MVTデータ）

国土地理院のベクトルタイル実験（experimental_bvmap）には河川・湖沼などの水域データが含まれています。`water: true` オプションを使用すると、波紋のある水面マテリアルを適用できます。

```typescript
// 国土地理院ベクトルタイル実験から水域レイヤーを追加
view.addLayer({
  type: "mvt",
  data: {
    // Credit: Geospatial Information Authority of Japan Vector Tile Experimental Service
    // https://github.com/gsi-cyberjapan/gsimaps-vector-experiment
    url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
  },
  polygon: {
    color: new Color().setStyle("#001e0f"),
    reflectivity: 0.2,    // 反射率
    clampToGround: true,  // 地形に沿わせる
    water: true,          // 水面マテリアルを有効化
  },
  vectorTile: {
    maxZoom: 16,
    layers: ["waterarea"], // 水域レイヤーのみを使用
  },
});

view.atmosphere.date.setHours(16); // 時間を設定
view.setCamera({ lng: 140.0372145462, lat: 35.6059411903, height: 3880, heading: -98.4184014976, pitch: -18.0000012192, roll: 0 });
```

![実行結果](@assets/tutorial/realistic-atmosphere-water.png)

### SSR（スクリーンスペース反射）との組み合わせ

`SSREffectDesc` を追加すると、建物などの反射がリアルタイムで水面に映り込みます。

```typescript
// PLATEAUの建築物モデルを追加
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
    url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 0.5,
    height: -50, // 楕円体高を調整
    castShadow: true,
    receiveShadow: true,
  },
});

// SSRエフェクトを追加
view.addEffect<SSREffectDesc>({
  ssr: {},
});

view.atmosphere.date.setHours(12);

view.setCamera({
  lng: 139.7511145474829,
  lat: 35.67364356091717,
  height: 902.0,
  heading: 64.41840149763287,
  pitch: -36.00000121921312,
  roll: 0,
});
```

![実行結果](@assets/tutorial/realistic-atmosphere-ssr.png)

## 完全な例

以下は大気エフェクト、雨、水面マテリアルをすべて組み合わせた完全な例です。

```typescript
import ThreeView, { type CloudsEffectDesc, Color, JAPAN_GSI_ELEVATION_DECODER, type RainDropEffectDesc, type RainMeshDesc, type SnowMeshDesc, type SSREffectDesc, ToneMappingMode } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView({
  shadow: true,
  animation: true,
  waterTexture: {
    enabled: true
  },
});
view.addPlugin(plugin);
await view.init();

// フォトリアルなシーンを一括セットアップ
const layers = plugin.addDefaultPhotorealScene();

// 必要に応じて Aerial Perspective を調整
layers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true, // 遅延ライティング(雲の影を表示するために必要)
  },
});

view.addLayer({
  type: "tiles",
  data: {
    // Credit:
    // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
    //   https://maps.gsi.go.jp/development/ichiran.html
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  },
  rasterTile: { maxZoom: 23 },
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

layers.sun.update({ sun: { castShadow: true } }); // 影を落とす

// トーンマッピング
layers.toneMapping.update({ toneMapping: { mode: ToneMappingMode.AGX } });
view.toneMappingExposure = 10; // シーンに応じて調整

const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: {
    qualityPreset: "high"
  },
});

// 雲の影を有効化
clouds.update({ clouds: { shadows: true } });

view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000, // 雨粒の数
    speed: 0.0015,             // 落下速度
    opacity: 1.0,         // 不透明度
    width: 3,          // 雨粒の幅
    height: 60.0,          // 雨粒の長さ
    areaWidth: 500,       // 降雨エリアの幅(m)
    areaHeight: 1000,      // 降雨エリアの高さ(m)
    maxHeight: 10000,       // 降雨エリアの最大高さ(m)
  },
});

view.addEffect<RainDropEffectDesc>({
  rainDrop: {
    opacity: 1.0,           // エフェクト全体の不透明度
    dropGridSize: 12,       // 水滴グリッドのサイズ
    dropDensity: 1,         // 水滴の密度
    dropLayers: 4,          // 水滴レイヤー数
    dropSizeFactor: 0.015,  // 水滴サイズ係数
    refractionStrength: 0.3, // 屈折の強さ
  },
});

// 国土地理院ベクトルタイル実験から水域レイヤーを追加
view.addLayer({
  type: "mvt",
  data: {
    // Credit: Geospatial Information Authority of Japan Vector Tile Experimental Service
    // https://github.com/gsi-cyberjapan/gsimaps-vector-experiment
    url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
  },
  polygon: {
    color: new Color().setStyle("#001e0f"),
    reflectivity: 0.02,    // 反射率
    clampToGround: true,  // 地形に沿わせる
    water: true,          // 水面マテリアルを有効化
  },
  vectorTile: {
    maxZoom: 16,
    layers: ["waterarea"], // 水域レイヤーのみを使用
  },
});

// PLATEAUの建築物モデルを追加
view.addLayer({
  type: "cesium3dtiles",
  data: {
    // Credit:
    // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
    //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
    url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 0.5,
    height: -50, // 楕円体高を調整
    castShadow: true,
    receiveShadow: true,
  },
});

// SSRエフェクトを追加
view.addEffect<SSREffectDesc>({
  ssr: {
  },
});

view.atmosphere.date.setHours(16); // 時間を設定

view.setCamera({ lng: 140.0372145462, lat: 35.6059411903, height: 3880, heading: -98.4184014976, pitch: -18.0000012192, roll: 0 });
```

:::tip[自然な見た目にするコツ]
- **3D Tiles のモデル**: `roughness`/`metalness` を調整し、`castShadow`/`receiveShadow` を適切に有効化してください
- **時間帯の調整**: `view.atmosphere.date.setHours(8)` などで時刻を設定できます
- **天候の切り替え**: 雨と雪は `.visible` プロパティで切り替えられます
- **水面の調整**: `waterSpeed` や `waterScaleNormal` で波の動きを調整できます
:::
