---
title: StarsLayer
description: Stars layer for navara_three
sidebar:
  order: 113
---

`StarsLayer`クラスは、星空を描画するメッシュレイヤーです。実際の天体カタログに基づいたポイントスプライトを使用して、リアルな星空を表現します。

星の位置は `view.atmosphere.date` に基づいて地球の自転が考慮され、太陽の位置によって可視性が自動調整されます。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-layer-base) を参照してください。

:::tip[関連ドキュメント]
大気システムの詳細については [Atmosphere クラス](../../../three/api-reference/atmosphere/) を参照してください。
:::

## Properties

### visible

**Type:** `boolean`

**Description:** 星の表示/非表示を切り替えます。

**Default:** `true`

**Example:**

```typescript
{ visible: true }
```

### pointSize

**Type:** `number`

**Description:** 星のポイントサイズを指定します。

**Default:** `1`

**Example:**

```typescript
{
  stars: {
    pointSize: 1.5,
  }
}
```

### intensity

**Type:** `number`

**Description:** 星の明るさの強度を指定します。

**Default:** `10`

**Example:**

```typescript
{
  stars: {
    intensity: 15,
  }
}
```

### background

**Type:** `boolean`

**Description:** 背景として表示するかどうかを指定します。

**Default:** `true`

**Example:**

```typescript
{
  stars: {
    background: true,
  }
}
```

### assetsUrl

**Type:** `string`

**Description:** 星のデータファイルのURLを指定します。

**Example:**

```typescript
{
  stars: {
    assetsUrl: "https://example.com/stars.bin",
  }
}
```

## Usage Examples

```typescript
import ThreeView, { StarsLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// StarsLayerを追加
const starsLayer = view.addMesh<StarsLayer>({
  stars: {
    visible: true,
    pointSize: 1.2,
    intensity: 12,
    background: true,
  },
});
```

## 技術的詳細

StarsLayerは、@takram/three-atmosphereライブラリを使用して実装されており、以下の機能を提供します:

- 実際の天体カタログデータに基づく星の配置
- 太陽の位置に基づく星の可視性の自動調整
- 地球の自転に基づく星の回転
- 大気の影響を考慮した星の明るさの調整

星のデータは非同期で読み込まれ、読み込みが完了するとシーンに追加されます。