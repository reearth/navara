---
title: VectorTileMaterial
description: Vector tile material for navara_three
sidebar:
  order: 39
---

`VectorTileMaterial`は、ベクタータイルレンダリング用のマテリアルを表します。

## Properties

### castShadow

**Type:** `boolean | undefined`

**Description:** ベクタータイルが影を投影するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    castShadow: true
  }
}
```

### layers

**Type:** `string[] | undefined`

**Description:** レンダリングするベクタータイルレイヤーの名前を指定します。配列で複数のレイヤーを指定できます。指定しない場合は、すべてのレイヤーが表示されます。

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    layers: ["buildings", "roads", "water"]
  }
}
```

### maxSse

**Type:** `number | undefined`

**Description:** 詳細レベル（LOD）の詳細度を決定するために使用される最大値です。値が高いほど、パフォーマンスは向上しますが、視覚的な品質は低下します。

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    maxSse: 16
  }
}
```

### maxZoom

**Type:** `number | undefined`

**Description:** ベクタータイルの最大ズームレベルを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    maxZoom: 18
  }
}
```

### overscaledMaxZoom

**Type:** `number | undefined`

**Description:** 最大ズームレベルを超えたタイルの最大ズームレベルを指定します。他のマテリアルの`clampToGround`が`true`の場合に有効です。

**Default:** `24`

**Example:**

```typescript
{
  vectorTile: {
    overscaledMaxZoom: 20
  }
}
```

### receiveShadow

**Type:** `boolean | undefined`

**Description:** ベクタータイルが他のマテリアルの影を受けるかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    receiveShadow: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** ベクタータイルを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  vectorTile: {
    show: true
  }
}
```
