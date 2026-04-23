---
title: RainMeshDesc
description: Rain mesh descriptor for navara_three
sidebar:
  order: 109
---

`RainMeshDesc`クラスは、雨のパーティクルエフェクトを表示するメッシュです。シェーダーベースのパーティクルシステムを使用して、リアルな降雨効果を作成します。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## Common Properties

### position

**Type:** `{ x: number, y: number, z: number } | Vector3`

**Description:** 雨のパーティクルエフェクトの中心位置をECEF座標系で指定します。`geodeticToVector3`関数を使用して緯度経度から変換できます。

**Example:**

```typescript
import { geodeticToVector3, degreeToRadian, LLE } from "@navara/three";

const position = geodeticToVector3(
  new LLE(
    degreeToRadian(35.67564356091717),  // 緯度
    degreeToRadian(139.74511454748298), // 経度
    10,                                  // 高度
  ),
);

{
  position: position,
  rain: { ... }
}
```

### visible

**Type:** `boolean`

**Description:** オブジェクトの表示/非表示を制御します。

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  rain: { ... }
}
```

## Rain Properties

### particleCount

**Type:** `number`

**Description:** 雨滴のパーティクル数を指定します。

**Default:** `5000`

**Example:**

```typescript
{
  rain: {
    particleCount: 10000,
  }
}
```

### speed

**Type:** `number`

**Description:** 雨滴の落下速度を指定します。

**Default:** `0.0015`

**Example:**

```typescript
{
  rain: {
    speed: 0.002,
  }
}
```

### color

**Type:** `number`

**Description:** 雨滴の色。

**Default:** `0xffffff`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  rain: {
    // Color から指定する場合は toHex() を使用
    color: new Color().setStyle("#aaaaff").toHex(),
  }
}
```

### areaWidth

**Type:** `number`

**Description:** 降雨エリアの幅を指定します。

**Default:** `500`

**Example:**

```typescript
{
  rain: {
    areaWidth: 800,
  }
}
```

### areaHeight

**Type:** `number`

**Description:** 降雨エリアの高さを指定します。

**Default:** `1000`

**Example:**

```typescript
{
  rain: {
    areaHeight: 1500,
  }
}
```

### width

**Type:** `number`

**Description:** 個々の雨滴の幅を指定します。

**Default:** `3.0`

**Example:**

```typescript
{
  rain: {
    width: 5.0,
  }
}
```

### height

**Type:** `number`

**Description:** 個々の雨滴の高さを指定します。

**Default:** `60`

**Example:**

```typescript
{
  rain: {
    height: 80,
  }
}
```

### radius

**Type:** `number`

**Description:** 降雨エリアの半径を指定します。

**Default:** `10`

**Example:**

```typescript
{
  rain: {
    radius: 20,
  }
}
```

### opacity

**Type:** `number`

**Description:** 雨滴の不透明度を指定します。

**Default:** `0.5`

**Example:**

```typescript
{
  rain: {
    opacity: 0.7,
  }
}
```

### alphaMax

**Type:** `number`

**Description:** 光が当たる側の雨滴の最大アルファ値を指定します。

**Default:** `0.5`

**Example:**

```typescript
{
  rain: {
    alphaMax: 0.7,
  }
}
```

### alphaMin

**Type:** `number`

**Description:** 影になる側の雨滴の最小アルファ値を指定します。

**Default:** `0.05`

**Example:**

```typescript
{
  rain: {
    alphaMin: 0.1,
  }
}
```

### followCamera

**Type:** `boolean`

**Description:** メッシュがカメラに追従するかどうかを指定します。これにより、メッシュが無限に描画されているような効果が得られます。

**Default:** `true`

**Example:**

```typescript
{
  rain: {
    followCamera: false,
  }
}
```

### maxHeight

**Type:** `number`

**Description:** カメラの高さに応じて不透明度が比例して減少する最大高度を指定します。

**Default:** `3000`

**Example:**

```typescript
{
  rain: {
    maxHeight: 5000,
  }
}
```

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { RainMeshDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// RainMeshDescを追加
const rainLayer = view.addMesh<RainMeshDesc>({
  rain: {
    particleCount: 5000,
    speed: 0.002,
    color: new Color().setStyle("#aaaaff").toHex(),
    areaWidth: 500,
    areaHeight: 1000,
    opacity: 0.6,
    followCamera: true,
  },
});
```

### 特定の位置に雨を配置

```typescript
import ThreeView, {
  RainMeshDesc,
  geodeticToVector3,
  degreeToRadian,
  LLE,
} from "@navara/three";

const view = new ThreeView({ animation: true });
await view.init();

// 東京の位置を計算
const position = geodeticToVector3(
  new LLE(
    degreeToRadian(35.67564356091717),
    degreeToRadian(139.74511454748298),
    10,
  ),
);

// 位置を指定してRainMeshDescを追加
const rainLayer = view.addMesh<RainMeshDesc>({
  visible: true,
  position: position,
  rain: {
    particleCount: 5000,
    speed: 0.0015,
    opacity: 0.5,
  },
});

// 表示/非表示を切り替え
rainLayer.visible = false;
```
