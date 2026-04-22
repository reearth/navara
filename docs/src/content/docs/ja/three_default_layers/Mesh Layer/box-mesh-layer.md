---
title: BoxMeshLayer
description: Box mesh layer for navara_three
sidebar:
  order: 102
---

`BoxMeshLayer`クラスは、立方体(Box)ジオメトリを描画するためのメッシュレイヤーです。幅・高さ・奥行きを指定して立方体を作成できます。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshLayerDeclaration](./mesh-layer-base) を参照してください。

## Properties

### width

**Type:** `number`

**Description:** 立方体の幅(X軸方向のサイズ)を指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    width: 100,
  }
}
```

### height

**Type:** `number`

**Description:** 立方体の高さ(Y軸方向のサイズ)を指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    height: 100,
  }
}
```

### depth

**Type:** `number`

**Description:** 立方体の奥行き(Z軸方向のサイズ)を指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    depth: 100,
  }
}
```

### widthSegments

**Type:** `number`

**Description:** 幅方向のセグメント数を指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    widthSegments: 2,
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
  box: {
    heightSegments: 2,
  }
}
```

### depthSegments

**Type:** `number`

**Description:** 奥行き方向のセグメント数を指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    depthSegments: 2,
  }
}
```

### color

**Type:** `Color`

**Description:** 立方体の色を`Color`インスタンスで指定します。`Color`クラスは16進数カラーコードやCSS形式の色指定をサポートします。

**Default:** `new Color().setStyle("#ffffff")`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  box: {
    color: new Color().setHex(0xff0000),
  }
}

// または
{
  box: {
    color: new Color().setStyle("#ff0000"), // CSS形式
  }
}
```

### emissiveColor

**Type:** `Color`

**Description:** 自己発光色を`Color`インスタンスで指定します。

**Default:** `new Color().setHex(0x000000)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  box: {
    emissiveColor: new Color().setHex(0x222222),
  }
}
```

### emissiveIntensity

**Type:** `number`

**Description:** 自己発光の強度を指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    emissiveIntensity: 0.5,
  }
}
```

### opacity

**Type:** `number`

**Description:** 不透明度を指定します。0.0(完全透明)から1.0(完全不透明)の範囲で指定します。

**Default:** `1`

**Example:**

```typescript
{
  box: {
    opacity: 0.5,
  }
}
```

### transparent

**Type:** `boolean`

**Description:** 透明度を有効にするかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  box: {
    transparent: true,
  }
}
```

### castShadow

**Type:** `boolean`

**Description:** 立方体が影を投影するかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  box: {
    castShadow: true,
  }
}
```

### receiveShadow

**Type:** `boolean`

**Description:** 立方体が影を受けるかどうかを指定します。

**Default:** `false`

**Example:**

```typescript
{
  box: {
    receiveShadow: true,
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
  box: {
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
  box: {
    effectIds: ["bloom-effect"],
    selectiveEffectOcclusion: "normal",
  }
}
```

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { BoxMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// BoxMeshLayerを追加
const boxLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### 影付き立方体

```typescript
import ThreeView, { BoxMeshLayer, Color } from "@navara/three";

const boxLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 200,
    height: 100,
    depth: 150,
    color: new Color().setHex(0x00aa00),
    castShadow: true,
    receiveShadow: true,
  },
  position: { x: 0, y: 0, z: 500 },
});
```

### 半透明の立方体

```typescript
import ThreeView, { BoxMeshLayer, Color } from "@navara/three";

const boxLayer = view.addMesh<BoxMeshLayer>({
  box: {
    width: 150,
    height: 150,
    depth: 150,
    color: new Color().setHex(0x0088ff),
    opacity: 0.5,
    transparent: true,
  },
  position: { x: 1000, y: 0, z: 500 },
});
```
