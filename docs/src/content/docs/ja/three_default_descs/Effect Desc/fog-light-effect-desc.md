---
title: FogLightEffectDesc
description: Fog light effect descriptor for navara_three
sidebar:
  order: 55
---

`FogLightEffectDesc`クラスは、ボリュメトリックライティングエフェクトを生成するDescriptorです。ポイントライトからのボリュメトリックフォグを計算し、光の散乱効果を表現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

### lights

**Type:** `FogLightDefinition[] | undefined`

**Description:** フォグライトの配列を指定します。各ライトは位置、色、強度と、任意の影響半径（`radius`、デフォルト `500`）を持ちます。位置はワールド（ECEF）座標です。 `geodeticToVector3()` で構築してください。`color` は数値の16進値と `Color` のどちらも指定できます。

**Default:** `[]`

**Example:**

```typescript
import { degreeToRadian, geodeticToVector3 } from "@navaramap/three";

const position = geodeticToVector3({
  lat: degreeToRadian(35.68),
  lng: degreeToRadian(139.76),
  height: 60,
});

view.addEffect({
  fogLight: {
    lights: [
      {
        position: { x: position.x, y: position.y, z: position.z },
        color: 0xffb45c,
        intensity: 1,
        radius: 500,
      },
    ],
  },
});
```

### maxLights

**Type:** `number | undefined`

**Description:** ライト容量の初期値のヒントです。内部のライトテクスチャはライトが増えると自動的に拡張されるため、この値は事前確保にのみ使われます。 想定するライト数を渡しておくと後の再確保を避けられます。

**Default:** `100`

**Example:**

```typescript
{
  fogLight: {
    maxLights: 200,
  }
}
```

### fogDensity

**Type:** `number | undefined`

**Description:** ボリュメトリックフォグの密度を指定します。値を上げると散乱が明るくなり、各ライトの自動導出される到達距離も伸びます。

**Default:** `5`

**Example:**

```typescript
{
  fogLight: {
    fogDensity: 10,
  }
}
```

### useSurfaceLighting

**Type:** `boolean | undefined`

**Description:** フォグに加えて、ライトが地表面も照らすかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  fogLight: {
    useSurfaceLighting: true,
  }
}
```

### downsample

**Type:** `number | undefined`

**Description:** フォグの描画解像度の分母です: 1 = フル解像度、2 = 1/2、4 = 1/4。低解像度のフォグは深度対応アップサンプリングで合成されるため、分母を上げてもシルエットは崩れず、GPUコストは分母の2乗で下がります。

**Default:** `4`

**Example:**

```typescript
{
  fogLight: {
    downsample: 2,
  }
}
```

### maxLightsPerTile

**Type:** `number | undefined`

**Description:** GPUがスクリーンタイルごとに評価するライトの最大数です。品質とコストの主要なダイヤルで、シェーダコストはほぼ線形に比例します。上限を超えたライトは切り捨てられるのではなく滑らかな残余ヘイズに畳み込まれるため、値を下げると弱いハローから順に霞んでいきます。

**Default:** `64`

**Example:**

```typescript
{
  fogLight: {
    maxLightsPerTile: 32,
  }
}
```

### haloFalloff

**Type:** `number | undefined`

**Description:** ハローの減衰係数 `1 / (1 + haloFalloff * h)` です（`h` はレイとライトの最近接距離、メートル単位）。値を上げるとハローがライトの周囲に引き締まります。フォグモデルは影を計算しないため、地形の陰に隠れたライトがゴーストのように光る場合の抑制に有効です。

**Default:** `0.1`

**Example:**

```typescript
{
  fogLight: {
    haloFalloff: 0.3,
  }
}
```

### extentScale

**Type:** `number | undefined`

**Description:** ライトをスクリーンタイルに登録する際、実効到達距離に掛ける安全係数です。`1.0` 未満にするとタイル境界でフォグが切れるリスクがあります。

**Default:** `1.0`

**Example:**

```typescript
{
  fogLight: {
    extentScale: 1.0,
  }
}
```

### tileSize

**Type:** `number | undefined`

**Description:** タイルドライトカリングに使うスクリーンタイルのサイズ（フォグ描画解像度でのピクセル数）です。

**Default:** `32`

**Example:**

```typescript
{
  fogLight: {
    tileSize: 32,
  }
}
```

### maxFar

**Type:** `number | undefined`

**Description:** フォグライトを考慮するカメラからの最大距離です。この距離より遠いライトはCPU側でカリングされます。

**Default:** エフェクト作成時のカメラの `far` 値

**Example:**

```typescript
{
  fogLight: {
    maxFar: 5000,
  }
}
```

### debugShowGrid

**Type:** `boolean | undefined`

**Description:** タイルグリッドとタイルごとのライト占有数をデバッグオーバーレイとして表示するかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  fogLight: {
    debugShowGrid: true,
  }
}
```

## Performance

- **`downsample` が最大のレバーです。** デフォルトの `4` はフォグを1/4解像度で描画します。深度対応アップサンプリングによりシルエットは維持されます。フォグを近くでシャープに見せたい場合のみ `2`（または `1`）を使ってください。
- **`maxLightsPerTile` はハローの網羅性とシェーダコストのトレード**で、ほぼ線形です。広い半径のライトが多いシーンでは `32` に下げるとフォグパスがおよそ半分になり、弱いハローは残余ヘイズに溶け込みます。
- **`radius` は各ライトの到達距離の上限です。** 実効到達距離は `intensity`・`fogDensity`・`haloFalloff` から自動的に導出され、`radius` でクランプされます。`radius` を絞る（または `haloFalloff` を上げる）と、各ライトが触れるタイル数が直接減ります。
- **想定ライト数を `maxLights` に渡しておく**と、後からライトを追加した際のテクスチャ再確保を避けられます。
- タイルグリッドはカメラ・ライト・フォグ設定が変化したときだけ再構築されるため、静止しているビューのCPUコストはゼロです。

## Usage Examples

### 基本的なフォグライトエフェクトの追加

```typescript
import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import { FogLightEffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

const position = geodeticToVector3({
  lat: degreeToRadian(35.68),
  lng: degreeToRadian(139.76),
  height: 60,
});

// フォグライトエフェクトのDescriptorを追加
view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: [
      {
        position: { x: position.x, y: position.y, z: position.z },
        color: 0xffffff,
        intensity: 10,
        radius: 500,
      },
    ],
    fogDensity: 5,
    useSurfaceLighting: true,
  },
});
```

### 夜景シーンの街灯エフェクト

```typescript
import ThreeView, {
  degreeToRadian,
  geodeticToVector3,
} from "@navaramap/three";
import {
  FogLightEffectDesc,
  type FogLightDefinition,
} from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// 道路上の各地点（[lng, lat, 地面標高（メートル）]）に温かい色のランプを1灯ずつ配置。
// 路面より高く持ち上げると光の玉として見える
const roadPoints: [number, number, number][] = [
  [139.7601, 35.6805, 30],
  [139.7612, 35.6811, 31],
  [139.7623, 35.6816, 33],
];
const streetLights: FogLightDefinition[] = roadPoints.map(
  ([lng, lat, elevation]) => {
    const position = geodeticToVector3({
      lat: degreeToRadian(lat),
      lng: degreeToRadian(lng),
      height: elevation + 14,
    });
    return {
      position: { x: position.x, y: position.y, z: position.z },
      color: 0xffaa00,
      intensity: 1,
      radius: 200,
    };
  },
);

view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: streetLights,
    fogDensity: 2,
    useSurfaceLighting: true,
    maxFar: view.camera.raw.far,
  },
  visible: true,
});
```

### シーンへのライトの動的な追加

```typescript
import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import {
  FogLightEffectDesc,
  type FogLightDefinition,
} from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

// 初期のライト配列
const fogLights: FogLightDefinition[] = [];

// フォグライトのDescriptorを追加。後から追加するライトのぶん容量を事前確保する
const fogDesc = view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: fogLights,
    fogDensity: 2,
    maxLights: 400,
  },
});

// 後からライトを追加
function addLight(lng: number, lat: number, height: number) {
  const position = geodeticToVector3({
    lat: degreeToRadian(lat),
    lng: degreeToRadian(lng),
    height,
  });
  fogLights.push({
    position: { x: position.x, y: position.y, z: position.z },
    color: 0xffffff,
    intensity: 10,
    radius: 300,
  });

  fogDesc.update({
    fogLight: {
      lights: fogLights,
    },
  });
}
```

### 夜間のみ表示するフォグライト

```typescript
import ThreeView, { degreeToRadian, geodeticToVector3 } from "@navaramap/three";
import { FogLightEffectDesc } from "@navaramap/three-default-descs";

const view = new ThreeView();
await view.init();

const position = geodeticToVector3({
  lat: degreeToRadian(35.68),
  lng: degreeToRadian(139.76),
  height: 60,
});

const isNight = view.atmosphere.isAtNight(view.camera.positionECEF); // 時刻に基づいて判定

const fogDesc = view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: [
      {
        position: { x: position.x, y: position.y, z: position.z },
        color: 0xffffff,
        intensity: 10,
        radius: 500,
      },
    ],
    fogDensity: 2,
  },
  visible: isNight,
});

// 時刻に応じて表示を切り替える
function updateVisibility(nightMode: boolean) {
  fogDesc.update({
    visible: nightMode,
  });
}
```

## Notes

- このエフェクトは複数のライトをサポートしており、`allowDuplication` が `true` のため、複数のFogLightEffectDescインスタンスを作成できます。
- フォグはジオメトリによって遮蔽されません。地形の陰にあるライトも周囲のフォグを照らすため、尾根の上にかすかな光が見えることがあります。[`haloFalloff`](#halofalloff) を上げると抑制できます。
- カメラはフォグの中に入れます。ライトが視点の真横や背後に回っても散乱は連続に保たれます。
