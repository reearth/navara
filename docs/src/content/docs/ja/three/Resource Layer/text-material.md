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
    center: { x: 0.5, y: 0.0 }
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

**Description:** 単一のフォントファイルの URL、または [`view.addFontFamily()`](../../api/threeview-functions/#addfontfamily) で事前に登録したフォントファミリの `family` 名を指定します。サポートされているファイル形式は ttf、otf、woff、woff2 です。

ファミリ名を指定した場合、`text` に含まれる文字の Unicode 範囲をカバーするフェイスファイルのみが読み込まれるため、CJK などの大きなスクリプトを複数のフェイスに分割してオンデマンドに読み込めます。

各コードポイントには、`faces` の並び順で最初に `unicodeRanges` がそのコードポイントを含むフェイスが使用されるため、範囲が重複する場合は先に定義されたエントリが優先されます。どのフェイスにもカバーされないコードポイントは先頭のフェイス（`faces[0]`）にフォールバックするため、宣言された `unicodeRanges` に含まれない文字のためにも先頭のフェイスがダウンロードされる可能性があります。詳細は [`addFontFamily()`](../../api/threeview-functions/#addfontfamily) を参照してください。

**Default:** `undefined`（フォントは読み込まれず、フォントを指定するまでテキストレイヤは描画されません）。

**Example (単一フォントファイル):**

```typescript
{
  text: {
    font: "https://example.com/fonts/NotoSansJP-Regular.ttf"
  }
}
```

**Example (登録済みフォントファミリ):**

```typescript
view.addFontFamily({
  family: "MapFont",
  faces: [
    { url: "/fonts/latin.woff2", unicodeRanges: [{ from: 0x0000, to: 0x024f }] },
    { url: "/fonts/cjk.woff2", unicodeRanges: [{ from: 0x4e00, to: 0x9fff }] },
  ],
});

// テキストレイヤのマテリアルで使用:
{
  text: {
    font: "MapFont"
  }
}
```

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

### sizeInMeters

**Type:** `boolean | undefined`

**Description:** サイズをメートル単位で指定するかどうか。false の場合、サイズはピクセル単位です。

**Default:** `true`

**Example:**

```typescript
{
  text: {
    sizeInMeters: true
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
