---
title: SSAOEffectDesc
description: SSAO effect descriptor for navara_three
sidebar:
  order: 59
---

`SSAOEffectDesc`クラスは、スクリーンスペースアンビエントオクルージョン(SSAO)エフェクトを適用するDescriptorです。ジオメトリの隙間や凹部に暗い影を追加し、より立体的な見た目を実現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

### samples

**Type:** `number | null | undefined`

**Description:** AOサンプル数を指定します。

**Default:** `null`

**Example:**

```typescript
{
  ssao: {
    samples: 16,
  }
}
```

### radius

**Type:** `number | null | undefined`

**Description:** AOの影響半径を指定します。

**Default:** `null`

**Example:**

```typescript
{
  ssao: {
    radius: 5,
  }
}
```

### intensity

**Type:** `number | undefined`

**Description:** AOエフェクトの強度を指定します。

**Default:** `1`

**Example:**

```typescript
{
  ssao: {
    intensity: 1.5,
  }
}
```

### color

**Type:** `Color | undefined`

**Description:** AOの色を指定します。

**Default:** `new Color().setHex(0x000000)` (黒)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  ssao: {
    color: new Color().setHex(0x000000),
  }
}
```

### halfRes

**Type:** `boolean | null | undefined`

**Description:** 半分の解像度でレンダリングするかどうかを指定します。パフォーマンス向上に役立ちます。

**Default:** `false`

**Example:**

```typescript
{
  ssao: {
    halfRes: true,
  }
}
```

### quality

**Type:** `"Low" | "Medium" | "High" | "Ultra" | undefined`

**Description:** SSAO品質モードを指定します。

**Default:** `"Low"`

**Example:**

```typescript
{
  ssao: {
    quality: "High",
  }
}
```

## Usage Examples

### 基本的なSSAOエフェクトの追加

```typescript
import ThreeView, { SSAOEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// SSAOエフェクトを追加
const ssaoLayer = view.addEffect<SSAOEffectDesc>({
  visible: true,
  ssao: {},
});
```

### 高品質SSAOの設定

```typescript
import ThreeView, { SSAOEffectDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// 高品質SSAOを追加
const ssaoLayer = view.addEffect<SSAOEffectDesc>({
  visible: true,
  ssao: {
    quality: "High",
    samples: 16,
    radius: 5,
    intensity: 1.5,
    color: new Color().setHex(0x000000),
  },
});
```

### パフォーマンス重視のSSAO設定

```typescript
import ThreeView, { SSAOEffectDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// 半解像度でパフォーマンスを向上
const ssaoLayer = view.addEffect<SSAOEffectDesc>({
  visible: true,
  ssao: {
    quality: "Low",
    halfRes: true,
  },
});
```

### デフォルトエフェクトと組み合わせた使用

```typescript
import ThreeView, { SSAOEffectDesc, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加
plugin.addDefaultPhotorealScene();

// SSAOを追加
const ssaoLayer = view.addEffect<SSAOEffectDesc>({
  visible: true,
  ssao: {
    quality: "High",
    halfRes: true,
    samples: 16,
    radius: 5,
    intensity: 1,
    color: new Color().setHex(0x000000),
  },
});

// 3Dタイルと組み合わせて使用
view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
  },
});
```

## 関連項目

- [Color クラス](../../../three/api-reference/color/) - 色の設定方法
