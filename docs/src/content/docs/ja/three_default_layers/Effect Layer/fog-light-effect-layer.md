---
title: FogLightEffectDesc
description: Fog light effect descriptor for navara_three
sidebar:
  order: 55
---

`FogLightEffectDesc`クラスは、ボリュメトリックライティングエフェクトを生成するレイヤーです。ポイントライトからのボリュメトリックフォグを計算し、光の散乱効果を表現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### lights

**Type:** `FogLightDefinition[] | undefined`

**Description:** フォグライトの配列を指定します。各ライトは位置、色、強度、影響半径を持ちます。

**Default:** `[]`

**Example:**

```typescript
{
  fogLight: {
    lights: [
      {
        position: { x: 0, y: 100, z: 0 },
        color: new Color().setHex(0xffffff),
        intensity: 10,
        radius: 500
      }
    ],
  }
}
```

### maxLights

**Type:** `number | undefined`

**Description:** ライトの最大数を指定します。この値を超えるライトは無視されます。

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

**Description:** ボリュメトリックフォグの密度を指定します。

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

**Description:** サーフェスライティングエフェクトを適用するかどうかを指定します。

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

**Description:** ダウンサンプル係数を指定します。1 = フル解像度、2 = 半分、4 = 1/4。

**Default:** `2`

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

**Description:** GPU上でタイルごとに反復処理される最大ライト数を指定します。

**Default:** `64`

**Example:**

```typescript
{
  fogLight: {
    maxLightsPerTile: 32,
  }
}
```

### extentScale

**Type:** `number | undefined`

**Description:** 解析的な最近接距離に適用される安全スケールを指定します。

**Default:** `0.8`

**Example:**

```typescript
{
  fogLight: {
    extentScale: 1.0,
  }
}
```

### maxFar

**Type:** `number | undefined`

**Description:** フォグライトが考慮される最大距離を指定します。

**Default:** `1e6`

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

**Description:** デバッグ用のグリッド範囲オーバーレイを表示するかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  fogLight: {
    debugShowGrid: true,
  }
}
```

## Usage Examples

### 基本的なフォグライトエフェクトの追加

```typescript
import ThreeView, { FogLightEffectDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// フォグライトエフェクトレイヤーを追加
view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: [
      {
        position: { x: 0, y: 100, z: 0 },
        color: new Color().setHex(0xffffff),
        intensity: 10,
        radius: 500,
      },
    ],
    fogDensity: 5,
    useSurfaceLighting: true,
  },
});
```

### 夜間シーンでの街灯エフェクト

```typescript
import ThreeView, { FogLightEffectDesc, Color, type LayerDescription } from "@navara/three";

const view = new ThreeView();
await view.init();

// 複数の街灯ライトを定義
const streetLights = [
  { position: { x: 100, y: 50, z: 0 }, color: new Color().setHex(0xffaa00), intensity: 8, radius: 200 },
  { position: { x: -100, y: 50, z: 0 }, color: new Color().setHex(0xffaa00), intensity: 8, radius: 200 },
  { position: { x: 0, y: 50, z: 100 }, color: new Color().setHex(0xffaa00), intensity: 8, radius: 200 },
];

const fogLayerDesc = {
  fogLight: {
    lights: streetLights,
    fogDensity: 0.7,
    useSurfaceLighting: true,
    downsample: 2,
    maxLightsPerTile: 128,
  },
  visible: true,
};

view.addEffect<FogLightEffectDesc>(fogLayerDesc);
```

### 動的にライトを追加するシーン

```typescript
import ThreeView, { FogLightEffectDesc, Color, type FogLightDefinition } from "@navara/three";

const view = new ThreeView();
await view.init();

// 初期ライト配列
const fogLights: FogLightDefinition[] = [];

// フォグライトレイヤーを追加
const fogLayer = view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: fogLights,
    fogDensity: 0.7,
    useSurfaceLighting: true,
    downsample: 2,
    maxLightsPerTile: 128,
    maxLights: 400,
  },
});

// 後からライトを追加
function addLight(x: number, y: number, z: number) {
  fogLights.push({
    position: { x, y, z },
    color: new Color().setHex(0xffffff),
    intensity: 10,
    radius: 300,
  });

  fogLayer.update({
    fogLight: {
      lights: fogLights,
    },
  });
}
```

### 夜間のみ表示するフォグライト

```typescript
import ThreeView, { FogLightEffectDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const isNight = view.atmosphere.isAtNight(view.camera.positionECEF); // 時刻に基づいて判定

const fogLayer = view.addEffect<FogLightEffectDesc>({
  fogLight: {
    lights: [
      { position: { x: 0, y: 100, z: 0 }, color: new Color().setHex(0xffffff), intensity: 10, radius: 500 },
    ],
    fogDensity: 0.7,
  },
  visible: isNight,
});

// 時刻に応じて表示を切り替え
function updateVisibility(nightMode: boolean) {
  fogLayer.update({
    visible: nightMode,
  });
}
```

## 備考

このエフェクトは複数のライトをサポートしており、`allowDuplication`が`true`に設定されているため、複数のFogLightEffectDescインスタンスを作成できます。
