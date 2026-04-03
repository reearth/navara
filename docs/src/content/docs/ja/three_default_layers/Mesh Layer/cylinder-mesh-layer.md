---
title: CylinderMeshLayer
description: Cylinder mesh layer for navara_three
sidebar:
  order: 103
---

`CylinderMeshLayer`クラスは、円柱(Cylinder)ジオメトリを描画するためのメッシュレイヤーです。上部半径・下部半径・高さなどを指定して円柱や円錐を作成できます。

## Properties

### radiusTop

**Type:** `number`

**Description:** 円柱の上部の半径を指定します。

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    radiusTop: 50,
  }
}
```

### radiusBottom

**Type:** `number`

**Description:** 円柱の下部の半径を指定します。

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    radiusBottom: 50,
  }
}
```

### height

**Type:** `number`

**Description:** 円柱の高さを指定します。

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    height: 200,
  }
}
```

### radialSegments

**Type:** `number`

**Description:** 円周方向のセグメント数を指定します。

**Default:** `32`

**Example:**

```typescript
{
  cylinder: {
    radialSegments: 64,
  }
}
```

### heightSegments

**Type:** `number`

**Description:** 高さ方向のセグメント数を指定します。

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    heightSegments: 2,
  }
}
```

### openEnded

**Type:** `boolean`

**Description:** 円柱の両端を開いた状態にするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    openEnded: true,
  }
}
```

### thetaStart

**Type:** `number`

**Description:** 円柱の開始角度をラジアンで指定します。

**Default:** `0`

**Example:**

```typescript
{
  cylinder: {
    thetaStart: Math.PI / 4,
  }
}
```

### thetaLength

**Type:** `number`

**Description:** 円柱の中心角をラジアンで指定します。

**Default:** `Math.PI * 2`

**Example:**

```typescript
{
  cylinder: {
    thetaLength: Math.PI,
  }
}
```

### color

**Type:** `Color`

**Description:** 円柱の色を`Color`インスタンスで指定します。`Color`クラスは16進数カラーコードやCSS形式の色指定をサポートします。

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  cylinder: {
    color: new Color().setHex(0x0088ff),
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** 円柱が影を投影するかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** 円柱が影を受けるかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    receiveShadow: true,
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** 円柱の発光色を`Color`インスタンスで指定します。

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  cylinder: {
    emissiveColor: new Color().setHex(0x00ff00),
  }
}
```

### emissiveIntensity

**Type:** `number`

**Description:** 発光の強度を指定します。

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    emissiveIntensity: 1.0,
  }
}
```

### opacity

**Type:** `number`

**Description:** 円柱の不透明度を0.0から1.0の範囲で指定します。`transparent`を`true`に設定する必要があります。

**Default:** `1`

**Example:**

```typescript
{
  cylinder: {
    opacity: 0.5,
    transparent: true,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** 円柱を半透明にするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  cylinder: {
    transparent: true,
    opacity: 0.5,
  }
}
```

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** このメッシュに適用するセレクティブエフェクトレイヤーIDの配列を指定します。

**Example:**

```typescript
{
  cylinder: {
    effectIds: ["bloom-effect", "outline-effect"],
  }
}
```

### selectiveEffectOcclusion

**Type:** `SelectiveEffectOcclusion` (optional)

**Description:** セレクティブエフェクト（Bloom、Outline など）のオクルージョンモードを指定します。

- `"normal"`: 通常のオクルージョンで、他のオブジェクトに遮られた部分はエフェクトが適用されません
- `"silhouette"`: シルエットモードで、遮られた部分もエフェクトが適用されます

**Example:**

```typescript
{
  cylinder: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

### 基本的な円柱

```typescript
import ThreeView, { CylinderMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// CylinderMeshLayerを追加
const cylinderLayer = view.addLayer<CylinderMeshLayer>({
  type: "mesh",
  cylinder: {
    radiusTop: 50,
    radiusBottom: 50,
    height: 200,
    color: new Color().setHex(0x0088ff),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### 円錐の作成

```typescript
import ThreeView, { CylinderMeshLayer, Color } from "@navara/three";

const coneLayer = view.addLayer<CylinderMeshLayer>({
  type: "mesh",
  cylinder: {
    radiusTop: 0,
    radiusBottom: 100,
    height: 200,
    color: new Color().setHex(0xff8800),
  },
});
```
