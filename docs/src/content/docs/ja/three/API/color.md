---
title: Color Class
description: API Reference for Color Class - 色を表現するクラス
sidebar:
  order: 18
---

`Color` クラスは、色を表現するためのクラスです。sRGB カラースペースを基準として色を管理し、様々な形式での色の設定・取得をサポートします。

## 基本的な使い方

`Color` クラスは、メソッドチェーンを使用して色を設定します。コンストラクタは引数を取らず、`setRGB()`、`setHex()`、`setStyle()` のいずれかのメソッドで色を設定します。

```typescript
import { Color } from "@navara/three";

// RGB値で設定（各成分は 0.0〜1.0）
const red = new Color().setRGB(1.0, 0.0, 0.0);

// 16進数で設定
const green = new Color().setHex(0x00ff00);

// CSS カラー文字列で設定
const blue = new Color().setStyle("#0000ff");
```

## Methods

### setRGB()

RGB 値で色を設定します（sRGB カラースペース）。

**Syntax:**

```typescript
setRGB(r: number, g: number, b: number): this
```

**Parameters:**

- `r`: 赤成分（0.0〜1.0）
- `g`: 緑成分（0.0〜1.0）
- `b`: 青成分（0.0〜1.0）

**Returns:**

メソッドチェーン用に自身のインスタンスを返します。

**Example:**

```typescript
// 純粋な赤
const red = new Color().setRGB(1.0, 0.0, 0.0);

// オレンジ
const orange = new Color().setRGB(1.0, 0.5, 0.0);

// グレー（50%）
const gray = new Color().setRGB(0.5, 0.5, 0.5);
```

---

### setRGBLinear()

RGB 値で色を設定します（リニアカラースペース、ガンマ補正なし）。

**Syntax:**

```typescript
setRGBLinear(r: number, g: number, b: number): this
```

**Parameters:**

- `r`: 赤成分（0.0〜1.0）
- `g`: 緑成分（0.0〜1.0）
- `b`: 青成分（0.0〜1.0）

**Returns:**

メソッドチェーン用に自身のインスタンスを返します。

**Example:**

```typescript
// リニアカラースペースで色を設定
const linearColor = new Color().setRGBLinear(0.5, 0.5, 0.5);
```

:::note
通常の用途では `setRGB()` を使用してください。`setRGBLinear()` は、ライティング計算などでリニアカラースペースが必要な場合に使用します。
:::

---

### setHex()

16進数で色を設定します（sRGB カラースペース）。

**Syntax:**

```typescript
setHex(hex: number): this
```

**Parameters:**

- `hex`: 16進数のカラー値（例: `0xff0000` は赤）

**Returns:**

メソッドチェーン用に自身のインスタンスを返します。

**Example:**

```typescript
// 赤
const red = new Color().setHex(0xff0000);

// 緑
const green = new Color().setHex(0x00ff00);

// 青
const blue = new Color().setHex(0x0000ff);

// 白
const white = new Color().setHex(0xffffff);

// 黒
const black = new Color().setHex(0x000000);
```

---

### setStyle()

CSS カラー文字列で色を設定します（sRGB カラースペース）。

**Syntax:**

```typescript
setStyle(style: string): this
```

**Parameters:**

- `style`: CSS カラー文字列

**Returns:**

メソッドチェーン用に自身のインスタンスを返します。

**Supported formats:**

- 16進数: `"#ff0000"`, `"#f00"`
- RGB: `"rgb(255, 0, 0)"`
- RGBA: `"rgba(255, 0, 0, 1)"`
- HSL: `"hsl(0, 100%, 50%)"`
- 名前付きカラー: `"red"`, `"blue"`, `"green"` など

**Example:**

```typescript
// 16進数形式
const red = new Color().setStyle("#ff0000");
const shortRed = new Color().setStyle("#f00");

// RGB形式
const green = new Color().setStyle("rgb(0, 255, 0)");

// HSL形式
const blue = new Color().setStyle("hsl(240, 100%, 50%)");

// 名前付きカラー
const coral = new Color().setStyle("coral");
```

---

### copy()

この色の値を別の Color インスタンスにコピーします。

**Syntax:**

```typescript
copy(color: Color): this
```

**Parameters:**

- `color`: コピー先の Color インスタンス

**Returns:**

コピーされた値を持つターゲット Color インスタンス

**Example:**

```typescript
const original = new Color().setHex(0xff0000);
const target = new Color();

original.copy(target);
// target は original と同じ色になる
```

---

### clone()

同じ値を持つ新しい Color インスタンスを作成します。

**Syntax:**

```typescript
clone(): Color
```

**Returns:**

新しい Color インスタンス

**Example:**

```typescript
const original = new Color().setHex(0xff0000);
const cloned = original.clone();

// original と cloned は同じ色だが、別のインスタンス
```

---

### toArray()

色を RGB 配列として返します。

**Syntax:**

```typescript
toArray(): [r: number, g: number, b: number]
```

**Returns:**

`[red, green, blue]` の値（各成分は 0.0〜1.0）

**Example:**

```typescript
const color = new Color().setHex(0xff8000);
const [r, g, b] = color.toArray();
// r ≈ 1.0, g ≈ 0.5, b = 0.0
```

---

### toHex()

色を16進数として返します。

**Syntax:**

```typescript
toHex(): number
```

**Returns:**

16進数のカラー値（例: `0xff0000`）

**Example:**

```typescript
const color = new Color().setStyle("#ff8000");
const hex = color.toHex();
// hex = 0xff8000
```

---

### srgb()

リニアカラースペースから sRGB カラースペースに変換した新しい Color インスタンスを返します。

**Syntax:**

```typescript
srgb(): Color
```

**Returns:**

sRGB カラースペースに変換された新しい Color インスタンス

**Example:**

```typescript
const linearColor = new Color().setRGBLinear(0.5, 0.5, 0.5);
const srgbColor = linearColor.srgb();
```

## Properties

### raw

**Type:** `THREE.Color`（読み取り専用）

**Description:** 内部で使用している Three.js の Color インスタンスへのアクセスを提供します。

:::warning
この プロパティは内部実装の詳細であり、通常の使用では必要ありません。Three.js との直接的な統合が必要な場合にのみ使用してください。
:::

## 使用例

### マテリアルでの使用

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// 地球の基本色を設定
view.globe.color = new Color().setStyle("#1a1a2e");
```

### ライトでの使用

```typescript
import ThreeView, { SunLightDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// 太陽光の色を設定
view.addLight<SunLightDesc>({
  sun: {
    color: new Color().setHex(0xffffff),
    intensity: 3,
  },
});
```

### ColorMap での使用

```typescript
import { ColorMap, Color } from "@navara/three";

// ref: https://colorbrewer2.org/#type=sequential&scheme=YlGnBu&n=9
const ylGnBu = new ColorMap("sequential", "YlGnBu", [
  new Color().setStyle("#ffffd9"),
  new Color().setStyle("#edf8b1"),
  new Color().setStyle("#c7e9b4"),
  new Color().setStyle("#7fcdbb"),
  new Color().setStyle("#41b6c4"),
  new Color().setStyle("#1d91c0"),
  new Color().setStyle("#225ea8"),
  new Color().setStyle("#253494"),
  new Color().setStyle("#081d58"),
]);
```

## 関連項目

- [ColorMap クラス](../../../three/api-reference/colormap/) - カラーグラデーションの定義
- [Globe クラス](../../../three/api-reference/globe/) - `color` プロパティ
- [SunLightDesc](../../../three/effect-desc-reference/sun-light-desc/) - ライトの色設定
- [AmbientLightDesc](../../../three/effect-desc-reference/ambient-light-desc/) - 環境光の色設定
