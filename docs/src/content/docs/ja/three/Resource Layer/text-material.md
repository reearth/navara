---
title: TextMaterial
description: Text material for navara_three
sidebar:
  order: 38
---

`TextMaterial`は、テキストレンダリング用のマテリアルを表します。

## Properties

### backgroundColor

**Type:** `Color | undefined`

**Description:** テキスト背景の色を`Color`で指定します。

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    backgroundColor: new Color().setHex(0xffffff) // 白背景
  }
}
```

### borderColor

**Type:** `Color | undefined`

**Description:** テキスト背景の境界線の色を`Color`で指定します。

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    borderColor: new Color().setHex(0x000000) // 黒境界線
  }
}
```

### borderWidth

**Type:** `number | undefined`

**Description:** テキスト境界線の幅を指定します。枠線の高さに対する比率を 0 〜 0.5 の間で指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    borderWidth: 2
  }
}
```

### center

**Type:** [`Vec2`](#vec2) | undefined

**Description:** 中心からのシフト量を指定します。範囲は 0 から 1 の間です。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    center: { x: 10, y: -5 }
  }
}
```

### clampToGround

**Type:** `boolean | undefined`

**Description:** テキストを地面に固定するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    clampToGround: true
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** テキストの色を`Color`で指定します。

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    color: new Color().setHex(0x000000)
  }
}
```

### cornerRadius

**Type:** `number | undefined`

**Description:** テキスト背景の角の丸みを指定します。0 〜 0.5 の間で隅の半径と高さの比率を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    cornerRadius: 5
  }
}
```

### depthTest

**Type:** `boolean | undefined`

**Description:** 前面のモデルが背面のモデルを隠すかどうかを決定する変数です。

**Default:** `true`

**Example:**

```typescript
{
  text: {
    depthTest: true
  }
}
```

### font

**Type:** `string | undefined`

**Description:** **実験的**: フォントファイルの URL を指定します。サポートされているファイル形式は ttf、otf、woff です。このAPIは大きなフォントファイルを一度に読み込むため、将来的に別のAPIに置き換えられる可能性があります。

**Default:** `Roboto`

**Example:**

```typescript
{
  text: {
    font: "https://example.com/fonts/NotoSansJP-Regular.ttf"
  }
}
```

[troika-three-textのスクリプト](https://github.com/protectwise/troika/blob/main/packages/troika-three-text/find-google-font-url.js)を使用して、Google fontsを取得して得られたフォントファイルを指定することもできます。

### height

**Type:** `number | undefined`

**Description:** テキストの高度を指定します。単位はメートルです。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    height: 100 // 100メートル
  }
}
```

### lang

**Type:** `string | undefined`

**Description:** テキストシェーピング用の言語コードを指定します（例: "en", "ja", "ar"）。テキストを正しくレンダリングするために使用されます。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    lang: "ja"
  }
}
```

### offsetDepth

**Type:** `boolean | undefined`

**Description:** 地球表面との重なりを回避します。テキストが地球表面にめり込まないようにする場合に使用します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    offsetDepth: true
  }
}
```

### outlineBlur

**Type:** `number | undefined`

**Description:** アウトラインのぼかし半径を CSS ピクセル単位で指定します。

**Default:** `0.0`

**Example:**

```typescript
{
  text: {
    outlineBlur: 2
  }
}
```

### outlineColor

**Type:** `Color | undefined`

**Description:** テキストアウトラインの色を`Color`で指定します。

**Default:** `undefined`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  text: {
    outlineColor: new Color().setHex(0x000000) // 黒アウトライン
  }
}
```

### outlineOffset

**Type:** [`Vec2`](#vec2) | undefined

**Description:** CSS ピクセル単位のピクセルオフセット `[x, y]` を指定します。

**Default:** `(0.0, 0.0)`

**Example:**

```typescript
{
  text: {
    outlineOffset: { x: 1, y: 1 }
  }
}
```

### outlineOpacity

**Type:** `number | undefined`

**Description:** テキストアウトラインの不透明度を指定します。範囲は 0.0 から 1.0 です。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    outlineOpacity: 0.8
  }
}
```

### outlineWidth

**Type:** `number | undefined`

**Description:** アウトラインの太さを CSS ピクセル単位で指定します。

**Default:** `0.0`

**Example:**

```typescript
{
  text: {
    outlineWidth: 2
  }
}
```

### padding

**Type:** [`Vec2`](#vec2) | undefined

**Description:** テキストのパディングを指定します。単位はピクセルです。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    padding: { x: 5, y: 3 }
  }
}
```

### scaleByDistance

**Type:** `boolean | undefined`

**Description:** カメラからの距離に基づいてオブジェクトのサイズを調整するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    scaleByDistance: true
  }
}
```

### show

**Type:** `boolean | undefined`

**Description:** テキストを表示するかどうかを指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    show: true
  }
}
```

### size

**Type:** `number | undefined`

**Description:** テキストのサイズを指定します。単位はピクセルです。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    size: 16
  }
}
```

### text

**Type:** `string | undefined`

**Description:** 表示するテキスト内容を指定します。

**Default:** `undefined`

**Example:**

```typescript
{
  text: {
    text: "Tokyo Station"
  }
}
```

## Vec2

2D ベクトルを表すクラスです。

### Properties

#### x

**Type:** `number`

**Description:** X 座標値。

#### y

**Type:** `number`

**Description:** Y 座標値。
