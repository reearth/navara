---
title: GlowGlobeMeshLayer
description: Glow globe mesh layer for navara_three
sidebar:
  order: 108
---

`GlowGlobeMeshLayer`クラスは、地球の周りにフレネル効果による光彩(グロー)を表示するメッシュレイヤーです。大気圏の光の散乱を模倣し、地球の縁に沿った美しいハロ効果を作成します。

## Properties

### radiusScale

**Type:** `number`

**Description:** WGS84楕円体の長半径に対するグロー球の半径スケール係数を指定します。この値にWGS84長半径(地球の赤道半径)を掛けた値が最終的なグロー球の半径になります。1.0より大きい値を設定することで、地球表面より大きなグロー球を作成し、大気効果を表現します。地球の扁平率も考慮されます。

**Default:** `1.2` (地球の赤道半径の120%: 約7,653,764メートル)

**Example:**

```typescript
{
  glowGlobe: {
    radiusScale: 1.1, // 地球より10%大きいグロー球(典型的な大気効果)
  }
}
```

### coefficient

**Type:** `number`

**Description:** フレネル計算におけるグロー閾値を制御する係数を指定します。この値は、表面法線と視線方向のドット積から減算され、グローの開始位置を制御します。値が大きいほど、地球の縁に向かってより顕著なグローが広がります。

**Default:** `0.5`

**Example:**

```typescript
{
  glowGlobe: {
    coefficient: 0.7, // より広がりのあるグロー
  }
}
```

### exponent

**Type:** `number`

**Description:** フレネル計算におけるグローの減衰強度を制御する指数を指定します。値が大きいほど、中心で鋭く集中したグローになります。値が小さいほど、外側に広がる柔らかく拡散したグローになります。このパラメータは、中心から縁に向かってグロー強度がどれだけ速く減少するかを制御します。

**Default:** `5.0`

**Example:**

```typescript
{
  glowGlobe: {
    exponent: 3.0, // より柔らかく拡散したグロー
  }
}
```

### glowColor

**Type:** `Color`

**Description:** グロー効果の色を`Color`インスタンスで指定します。`Color`クラスは16進数カラーコードやCSS形式の色指定をサポートします。RGB成分がグローの色相を決定し、計算されたフレネル強度と不透明度によって変調されます。

**Default:** `new Color().setHex(0x8cf3ff)` (ライトシアン)

**Example:**

```typescript
import { Color } from "@navara/three";

{
  glowGlobe: {
    glowColor: new Color().setHex(0xff0000), // 赤いグロー
  }
}
```

### opacity

**Type:** `number`

**Description:** グロー効果の不透明度/アルファチャンネルを指定します。グローレイヤー全体の透明度を制御します。この値はシェーダーの色ユニフォームのアルファ成分として使用されます。値が小さいほど微妙で透明なグローになり、値が大きいほど不透明になります。

**Default:** `0.5`

**Range:** 0.0 ~ 1.0

**Example:**

```typescript
{
  glowGlobe: {
    opacity: 0.3, // より控えめなグロー
  }
}
```

## Usage Examples

### 基本的な使い方

```typescript
import ThreeView, { GlowGlobeMeshLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// GlowGlobeMeshLayerを追加
const glowLayer = view.addLayer<GlowGlobeMeshLayer>({
  type: "mesh",
  glowGlobe: {
    radiusScale: 1.2,
    coefficient: 0.5,
    exponent: 5.0,
    glowColor: new Color().setHex(0x8cf3ff),
    opacity: 0.5,
  },
});
```

### カスタムカラー

```typescript
import { Color } from "@navara/three";

const glowLayer = view.addLayer<GlowGlobeMeshLayer>({
  type: "mesh",
  glowGlobe: {
    radiusScale: 1.15,
    coefficient: 0.6,
    exponent: 4.0,
    glowColor: new Color().setHex(0x00ff88),  // ミントグリーン
    opacity: 0.6,
  },
});
```

### 微妙な大気効果

```typescript
import { Color } from "@navara/three";

const glowLayer = view.addLayer<GlowGlobeMeshLayer>({
  type: "mesh",
  glowGlobe: {
    radiusScale: 1.05,
    coefficient: 0.4,
    exponent: 6.0,
    glowColor: new Color().setHex(0x88ccff),
    opacity: 0.3,
  },
});
```

## 技術的詳細

GlowGlobeMeshLayerは、フレネル効果に基づくシェーダーを使用して実装されています:

- **ジオメトリ**: WGS84楕円体に基づく球体ジオメトリで、地球の扁平率を考慮しています
- **マテリアル**: カスタムシェーダーマテリアルで、視線角度に基づいてグロー強度を計算します
- **レンダリング**: BackSideレンダリングを使用し、透明マテリアルとして描画されます

グロー効果は、表面法線とカメラの視線方向の角度に基づいて計算され、地球の縁で最も強く、中心に向かって減少します。
