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
- 空・太陽・星のDescriptor設定
- 雲エフェクトの追加
- トーンマッピングとアンチエイリアシングの設定
- 雨・雪エフェクトの追加
- 水面マテリアルの設定（国土地理院MVTデータ活用）

## 大気遠近法エフェクトを追加する

大気遠近法（Aerial Perspective）は、距離に応じた空気感・霞の効果を付与します。`DefaultPlugin` を使うと、すべてのデフォルトDescriptorが登録され、`addDefaultPhotorealScene()` でフォトリアルなシーンを一括セットアップできます。

```typescript
import ThreeView, { JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({ shadow: true });
view.addPlugin(plugin);
await view.init();

// フォトリアルなシーンを一括セットアップ（空・太陽光・星・大気エフェクト・トーンマッピング・アンチエイリアシングなど）
const layers = plugin.addDefaultPhotorealScene();

// 必要に応じて Aerial Perspective を調整
layers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true, // Deferred lighting (required for displaying cloud shadows)
  },
});

const photoSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: photoSource,
});

const terrainSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
  minZoom: 6,
  maxZoom: 15,
});
view.addLayer({
  type: "terrain",
  source: terrainSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: terrainSource,
  hillshade: {},
});

view.setCamera({ lng: 139.7511, lat: 35.6736, height: 400, heading: -100, pitch: -20, roll: 0 });
```

`addDefaultPhotorealScene()` により、空・太陽光・星・スカイライトプローブなどの大気Descriptorも自動で追加されています。影を落とすには太陽光の設定を更新します。

```typescript
layers.sun.update({ sun: { castShadow: true } }); // Cast shadows
```

:::caution[irradiance の注意点]
`irradiance` を有効にすると、透明なマテリアル（ガラスなど）の描画が安定しないことがあります。透明オブジェクトを多用する場合は `irradiance: false` を検討してください。
:::

## トーンマッピングとアンチエイリアシングを設定する

HDR らしい自然な見た目にするためにトーンマッピングと露出、アンチエイリアシングを設定します。

```typescript
// Tone mapping
layers.toneMapping.update({ toneMapping: { mode: ToneMappingMode.AGX } });
view.toneMappingExposure = 10; // Adjust according to the scene

// Anti-aliasing
// addDefaultPhotorealScene() automatically selects SMAA for desktop and FXAA for mobile optimization
```

## 雲エフェクトを追加する

体積雲エフェクトを重ねると臨場感が向上します。まずはデフォルト設定で追加し、必要に応じて影や密度を調整します。

```typescript
const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: {},
});

// Example: Enable cloud shadows
clouds.update({ clouds: { shadows: true } });
```

![実行結果](@assets/tutorial/realistic-atmosphere.png)

## 雨エフェクトを追加する

雨の表現には2つのオブジェクトを組み合わせて使用します。`RainMeshDesc` はシーン内に3D雨粒パーティクルを描画し、`RainDropEffectDesc` は画面に水滴が付着するポストエフェクトを提供します。

### 3D雨粒パーティクル

```typescript
// Enable the animation loop to keep rain animation running
view.animation = true;

// Add rain object
const rain = view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000, // Number of raindrops
    speed: 0.0015,             // Fall speed
    opacity: 1.0,         // Opacity
    width: 3,          // Raindrop width
    height: 60.0,          // Raindrop length
    areaWidth: 500,       // Rainfall area width (m)
    areaHeight: 1000,      // Rainfall area height (m)
    maxHeight: 10000,       // Maximum rainfall area height (m)
  },
});
```

### 画面水滴エフェクト

雨天時にカメラレンズに付着する水滴を表現するポストエフェクトです。

```typescript
const rainDropEffect = view.addEffect<RainDropEffectDesc>({
  rainDrop: {
    opacity: 0.8,           // Overall effect opacity
    dropGridSize: 14,       // Water droplet grid size
    dropDensity: 0.1,       // Water droplet density
    dropSizeFactor: 0.025,  // Water droplet size factor
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
// Add snow object
const snow = view.addMesh<SnowMeshDesc>({
  snow: {
    particleCount: 5000,  // Number of snowflakes
    speed: 0.00005,           // Fall speed
    size: 10,              // Snowflake size
    opacity: 1,         // Opacity
    areaWidth: 500,       // Snowfall area width (m)
    areaHeight: 1000,      // Snowfall area height (m)
    maxHeight: 3000,       // Maximum snowfall area height (m)
    // Wind-driven sway
    movementStrength: { x: 50, y: 20, z: 50 }, // Sway amplitude for each axis
    movementSpeed: { x: 0.0005, y: 0.0002, z: 0.0005 }, // Sway speed for each axis
  },
});
```

:::caution[パフォーマンスの注意]
`particleCount` を増やすとリアルになりますが、モバイルデバイスではパフォーマンスに影響します。必要に応じて調整してください。
:::

![実行結果](@assets/tutorial/realistic-atmosphere-snow.png)

## 水面マテリアルを追加する（国土地理院MVTデータ）

国土地理院のベクトルタイル実験（experimental_bvmap）には河川・湖沼などの水域データが含まれています。`water: true` オプションを使用すると、波紋のある水面マテリアルを適用できます。

:::caution[ThreeView 側で必須のオプション]
水面マテリアルを利用するには、`ThreeView` の生成時に `waterTexture` を有効化する必要があります。これを設定しないと、レイヤー側の `water: true` は効果を持ちません。

```typescript
const view = new ThreeView<DefaultDescriptions>({
  waterTexture: { enabled: true },
  // ...other options
});
```
:::

```typescript
// Add water area layer from GSI experimental vector tiles
const waterSource = view.addSource({
  // Credit: Geospatial Information Authority of Japan Vector Tile Experimental Service
  // https://github.com/gsi-cyberjapan/gsimaps-vector-experiment
  type: "vector-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});
view.addLayer({
  type: "vector",
  source: waterSource,
  sourceLayers: ["waterarea"], // Use only the water area layer
  polygon: {
    color: new Color().setStyle("#001e0f"),
    reflectivity: 0.2,    // Reflectivity
    clampToGround: true,  // Clamp to terrain
    water: true,          // Enable water surface material
  },
});

view.atmosphere.date = new Date("2026-01-01T16:00:00+09:00"); // January 1, 16:00 JST
view.setCamera({ lng: 140.0372145462, lat: 35.6059411903, height: 3880, heading: -98.4184014976, pitch: -18.0000012192, roll: 0 });
```

![実行結果](@assets/tutorial/realistic-atmosphere-water.png)

### SSR（スクリーンスペース反射）との組み合わせ

`SSREffectDesc` を追加すると、建物などの反射がリアルタイムで水面に映り込みます。

```typescript
// Add PLATEAU building models
const plateauSource = view.addSource({
  // Credit:
  // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
  //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: plateauSource,
  model: {
    show: true,
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 0.5,
    height: -50, // Adjust ellipsoidal height
    castShadow: true,
    receiveShadow: true,
  },
});

// Add SSR effect
view.addEffect<SSREffectDesc>({
  ssr: {},
});

view.atmosphere.date = new Date("2026-01-01T12:00:00+09:00"); // January 1, 12:00 JST

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
import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { type CloudsEffectDesc, type RainDropEffectDesc, type RainMeshDesc, type SnowMeshDesc, type SSREffectDesc, ToneMappingMode } from "@navara/three_default_descs";
import { DefaultPlugin, type DefaultDescriptions } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
const view = new ThreeView<DefaultDescriptions>({
  shadow: true,
  animation: true,
  waterTexture: {
    enabled: true
  },
});
view.addPlugin(plugin);
await view.init();

// Set up a photorealistic scene in one call
const layers = plugin.addDefaultPhotorealScene();

// Adjust Aerial Perspective as needed
layers.aerialPerspective.update({
  aerialPerspective: {
    irradiance: true, // Deferred lighting (required for displaying cloud shadows)
  },
});

const photoSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Latest Nationwide Photo (Seamless)
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 23,
});
view.addLayer({
  type: "raster",
  source: photoSource,
});

const terrainSource = view.addSource({
  // Credit:
  // - Geospatial Information Authority of Japan Tiles - Digital Elevation Map
  //   https://maps.gsi.go.jp/development/ichiran.html
  type: "raster-dem",
  url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
  elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
  minZoom: 6,
  maxZoom: 15,
});
view.addLayer({
  type: "terrain",
  source: terrainSource,
  terrain: {
    castShadow: true,
    receiveShadow: true,
  },
});

view.addLayer({
  type: "raster",
  source: terrainSource,
  hillshade: {},
});

layers.sun.update({ sun: { castShadow: true } }); // Cast shadows

// Tone mapping
layers.toneMapping.update({ toneMapping: { mode: ToneMappingMode.AGX } });
view.toneMappingExposure = 10; // Adjust according to the scene

const clouds = view.addEffect<CloudsEffectDesc>({
  clouds: {
    qualityPreset: "high"
  },
});

// Enable cloud shadows
clouds.update({ clouds: { shadows: true } });

view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000, // Number of raindrops
    speed: 0.0015,             // Fall speed
    opacity: 1.0,         // Opacity
    width: 3,          // Raindrop width
    height: 60.0,          // Raindrop length
    areaWidth: 500,       // Rainfall area width (m)
    areaHeight: 1000,      // Rainfall area height (m)
    maxHeight: 10000,       // Maximum rainfall area height (m)
  },
});

view.addEffect<RainDropEffectDesc>({
  rainDrop: {
    opacity: 0.8,           // Overall effect opacity
    dropGridSize: 14,       // Water droplet grid size
    dropDensity: 0.1,       // Water droplet density
    dropSizeFactor: 0.025,  // Water droplet size factor
  },
});

// Add water area layer from GSI experimental vector tiles
const waterSource = view.addSource({
  // Credit: Geospatial Information Authority of Japan Vector Tile Experimental Service
  // https://github.com/gsi-cyberjapan/gsimaps-vector-experiment
  type: "vector-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
  maxZoom: 16,
});
view.addLayer({
  type: "vector",
  source: waterSource,
  sourceLayers: ["waterarea"], // Use only the water area layer
  polygon: {
    color: new Color().setStyle("#001e0f"),
    reflectivity: 0.02,    // Reflectivity
    clampToGround: true,  // Clamp to terrain
    water: true,          // Enable water surface material
  },
});

// Add PLATEAU building models
const plateauSource = view.addSource({
  // Credit:
  // - 3D City Model (Project PLATEAU) Chiyoda Ward (FY2023) - MLIT PLATEAU
  //   https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023
  type: "3d-tiles",
  url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
});
view.addLayer({
  type: "3d-tiles",
  source: plateauSource,
  model: {
    show: true,
    color: new Color().setStyle("#ffffff"),
    metalness: 0,
    roughness: 0.5,
    height: -50, // Adjust ellipsoidal height
    castShadow: true,
    receiveShadow: true,
  },
});

// Add SSR effect
view.addEffect<SSREffectDesc>({
  ssr: {
  },
});

view.atmosphere.date = new Date("2026-01-01T16:00:00+09:00"); // January 1, 16:00 JST

view.setCamera({ lng: 140.0372145462, lat: 35.6059411903, height: 3880, heading: -98.4184014976, pitch: -18.0000012192, roll: 0 });
```

:::tip[自然な見た目にするコツ]
- **3D Tiles のモデル**: `roughness`/`metalness` を調整し、`castShadow`/`receiveShadow` を適切に有効化してください
- **時間帯の調整**: `new Date("2026-01-01T08:00:00+09:00")` のように、タイムゾーンオフセット付きの ISO 文字列で時刻を設定してください
- **天候の切り替え**: 雨と雪は `.visible` プロパティで切り替えられます
- **水面の調整**: `waterSpeed` や `waterScaleNormal` で波の動きを調整できます
:::
