---
title: SnowMeshLayer
description: Snow mesh layer for navara_three
sidebar:
  order: 110
---

`SnowMeshLayer`クラスは、雪のパーティクルエフェクトを表示するメッシュレイヤーです。テクスチャベースのポイントスプライトを使用して、リアルな降雪効果を作成します。

## Common Properties

### position

**Type:** `{ x: number, y: number, z: number } | Vector3`

**Description:** 雪のパーティクルエフェクトの中心位置をECEF座標系で指定します。`geodeticToVector3`関数を使用して緯度経度から変換できます。

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
  snow: { ... }
}
```

### visible

**Type:** `boolean`

**Description:** レイヤーの表示/非表示を制御します。

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  snow: { ... }
}
```

## Snow Properties

### particleCount

**Type:** `number`

**Description:** 雪片のパーティクル数を指定します。

**Default:** `30000`

**Example:**

```typescript
{
  snow: {
    particleCount: 3000,
  }
}
```

### radius

**Type:** `number`

**Description:** 雪の分布半径を指定します。

**Default:** `10`

**Example:**

```typescript
{
  snow: {
    radius: 15,
  }
}
```

### areaWidth

**Type:** `number`

**Description:** 降雪エリアの幅を指定します。

**Default:** `500`

**Example:**

```typescript
{
  snow: {
    areaWidth: 500,
  }
}
```

### areaHeight

**Type:** `number`

**Description:** 降雪エリアの高さを指定します。

**Default:** `1000`

**Example:**

```typescript
{
  snow: {
    areaHeight: 1000,
  }
}
```

### speed

**Type:** `number`

**Description:** 雪片の落下速度を指定します。

**Default:** `0.00005`

**Example:**

```typescript
{
  snow: {
    speed: 0.001,
  }
}
```

### movementStrength

**Type:** `{ x: number, y: number, z: number }`

**Description:** 雪片の風による移動の強度を各軸で指定します。

**Default:** `{ x: 50, y: 20, z: 50 }`

**Example:**

```typescript
{
  snow: {
    movementStrength: { x: 0.5, y: 0, z: 0.5 },
  }
}
```

### movementSpeed

**Type:** `{ x: number, y: number, z: number }`

**Description:** 雪片の風による移動の速度を各軸で指定します。

**Default:** `{ x: 0.0005, y: 0.0002, z: 0.0005 }`

**Example:**

```typescript
{
  snow: {
    movementSpeed: { x: 0.001, y: 0, z: 0.001 },
  }
}
```

### size

**Type:** `number`

**Description:** 雪片のサイズを指定します。

**Default:** `3`

**Example:**

```typescript
{
  snow: {
    size: 0.05,
  }
}
```

### color

**Type:** `number`

**Description:** 雪片の色。

**Default:** `0xffffff`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  snow: {
    color: new Color().setStyle("#eeeeff").toHex(),
  }
}
```

### opacity

**Type:** `number`

**Description:** 雪片の不透明度を指定します。

**Default:** `1`

**Example:**

```typescript
{
  snow: {
    opacity: 0.8,
  }
}
```

### followCamera

**Type:** `boolean`

**Description:** メッシュがカメラに追従するかどうかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  snow: {
    followCamera: true,
  }
}
```

### maxHeight

**Type:** `number`

**Description:** 最大高度を指定します。カメラの高度に比例して不透明度が減少します。

**Default:** `3000`

**Example:**

```typescript
{
  snow: {
    maxHeight: 5000,
  }
}
```

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { SnowMeshLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// SnowMeshLayerを追加
const snowLayer = view.addLayer<SnowMeshLayer>({
  type: "mesh",
  snow: {
    particleCount: 3000,
    areaWidth: 500,
    areaHeight: 1000,
    speed: 0.001,
    movementStrength: { x: 0.3, y: 0, z: 0.3 },
    movementSpeed: { x: 0.0005, y: 0, z: 0.0005 },
    size: 0.05,
    opacity: 0.8,
    followCamera: true,
  },
});
```

### 特定の位置に雪を配置

```typescript
import ThreeView, {
  SnowMeshLayer,
  Color,
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

// 位置を指定してSnowMeshLayerを追加
const snowLayer = view.addLayer<SnowMeshLayer>({
  type: "mesh",
  visible: true,
  position: position,
  snow: {
    particleCount: 3000,
    speed: 0.001,
    color: new Color().setHex(0xffffff).toHex(),
    opacity: 0.8,
  },
});

// 表示/非表示を切り替え
snowLayer.visible = false;
```
