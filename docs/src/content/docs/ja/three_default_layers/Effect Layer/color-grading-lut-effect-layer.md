---
title: ColorGradingLUTEffectLayer
description: Color grading LUT effect layer for navara_three
sidebar:
  order: 53
---

`ColorGradingLUTEffectLayer`クラスは、LUT(ルックアップテーブル)を使用したカラーグレーディングエフェクトを適用するレイヤーです。3DLファイルなどのLUTテクスチャを使用して、シーン全体の色調を調整できます。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### url

**Type:** `string | undefined`

**Description:** LUTファイルのURLを指定します。3DL形式のLUTファイルがサポートされています。

**Default:** `"https://raw.githubusercontent.com/pmndrs/postprocessing/refs/heads/main/demo/static/textures/lut/3dl/presetpro-cinematic.3dl"`

**Example:**

```typescript
{
  colorGradingLUT: {
    url: "https://example.com/my-lut.3dl",
  }
}
```

### blendMode

**Type:** `BlendMode | undefined`

**Description:** LUTエフェクトのブレンドモードを指定します。

**Default:** `"colorBurn"`

**有効な値:**

| 値 | 説明 |
|---|---|
| `"normal"` | 通常のブレンド |
| `"add"` | 加算ブレンド |
| `"multiply"` | 乗算ブレンド |
| `"screen"` | スクリーンブレンド |
| `"overlay"` | オーバーレイブレンド |
| `"colorBurn"` | カラーバーン（デフォルト） |
| `"colorDodge"` | カラードッジ |
| `"softLight"` | ソフトライト |
| `"hardLight"` | ハードライト |
| `"darken"` | 暗くする |
| `"lighten"` | 明るくする |
| `"difference"` | 差の絶対値 |
| `"exclusion"` | 除外 |
| `"hue"` | 色相 |
| `"saturation"` | 彩度 |
| `"color"` | カラー |
| `"luminosity"` | 輝度 |
| `"linearBurn"` | リニアバーン |
| `"linearDodge"` | リニアドッジ |
| `"linearLight"` | リニアライト |
| `"vividLight"` | ビビッドライト |
| `"pinLight"` | ピンライト |
| `"hardMix"` | ハードミックス |

**Example:**

```typescript
{
  colorGradingLUT: {
    blendMode: "normal",
  }
}
```

### opacity

**Type:** `number | undefined`

**Description:** LUTエフェクトの不透明度を0.0から1.0の範囲で指定します。

**Default:** `0.78`

**Example:**

```typescript
{
  colorGradingLUT: {
    opacity: 0.5,
  }
}
```

## Usage Examples

### 基本的なカラーグレーディングの追加

```typescript
import ThreeView, { ColorGradingLUTEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// カラーグレーディングLUTエフェクトレイヤーを追加
const colorGradingLayer = view.addLayer<ColorGradingLUTEffectLayer>({
  type: "effect",
  colorGradingLUT: {},
});
```

### カスタムLUTを使用したカラーグレーディング

```typescript
import ThreeView, { ColorGradingLUTEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

view.addDefaultEffectLayers();
view.addDefaultAtmosphereLayers();

// カスタムLUTでカラーグレーディングを追加
const colorGradingLayer = view.addLayer<ColorGradingLUTEffectLayer>({
  type: "effect",
  colorGradingLUT: {
    url: "https://example.com/cinematic-lut.3dl",
    blendMode: "colorBurn",
    opacity: 0.8,
  },
});
```

### カラーグレーディングの動的更新

```typescript
import ThreeView, { ColorGradingLUTEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

const colorGradingLayer = view.addLayer<ColorGradingLUTEffectLayer>({
  type: "effect",
  colorGradingLUT: {
    opacity: 0.5,
  },
});

// 後から不透明度を更新
colorGradingLayer.update({
  colorGradingLUT: {
    opacity: 0.9,
  },
});
```

## 備考

LUTを使用することで、映画的な色調やフィルムルックなど、様々なカラーグレーディング効果を簡単に適用できます。3DL形式のLUTファイルはDaVinci Resolveなどの映像編集ソフトで作成できます。
