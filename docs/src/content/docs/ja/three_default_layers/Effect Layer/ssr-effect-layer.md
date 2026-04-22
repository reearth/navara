---
title: SSREffectLayer
description: SSR effect descriptor for navara_three
sidebar:
  order: 60
---

`SSREffectLayer`クラスは、スクリーンスペース反射(SSR)エフェクトを生成するレイヤーです。リアルタイムで画面上のオブジェクトの反射を計算し、水面や光沢のある表面の反射を表現します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### resolutionScale

**Type:** `number | undefined`

**Description:** SSRレンダリングの解像度スケール係数を指定します。0-1の範囲で、低い値ほどパフォーマンスが向上します。

**Default:** `0.5`

**Example:**

```typescript
{
  ssr: {
    resolutionScale: 0.75,
  }
}
```

### iterations

**Type:** `number | undefined`

**Description:** 反射の交差を見つけるためのレイマーチング反復の最大数を指定します。

**Default:** `100`

**Example:**

```typescript
{
  ssr: {
    iterations: 150,
  }
}
```

### binarySearchIterations

**Type:** `number | undefined`

**Description:** 反射の精度を向上させるバイナリサーチ改良ステップの数を指定します。

**Default:** `4`

**Example:**

```typescript
{
  ssr: {
    binarySearchIterations: 6,
  }
}
```

### pixelZSize

**Type:** `number | undefined`

**Description:** ピクセル除外のための深度バッファ精度閾値を指定します。

**Default:** `100`

**Example:**

```typescript
{
  ssr: {
    pixelZSize: 150,
  }
}
```

### pixelStride

**Type:** `number | undefined`

**Description:** スクリーンスペースに沿ったレイマーチングのステップサイズをピクセル単位で指定します。

**Default:** `5`

**Example:**

```typescript
{
  ssr: {
    pixelStride: 8,
  }
}
```

### pixelStrideZCutoff

**Type:** `number | undefined`

**Description:** 遠方エリアでピクセルストライドを減らすための深度カットオフ値を指定します。

**Default:** `500`

**Example:**

```typescript
{
  ssr: {
    pixelStrideZCutoff: 750,
  }
}
```

### maxRayDistance

**Type:** `number | undefined`

**Description:** 反射レイがワールド単位で移動できる最大距離を指定します。

**Default:** `5000`

**Example:**

```typescript
{
  ssr: {
    maxRayDistance: 10000,
  }
}
```

### screenEdgeFadeStart

**Type:** `number | undefined`

**Description:** アーティファクトを隠すためにエッジフェードが開始される画面位置(0-1)を指定します。

**Default:** `0.75`

**Example:**

```typescript
{
  ssr: {
    screenEdgeFadeStart: 0.8,
  }
}
```

### eyeFadeStart

**Type:** `number | undefined`

**Description:** 視角に基づいて反射をフェードする開始角度(ラジアン)を指定します。

**Default:** `0`

**Example:**

```typescript
{
  ssr: {
    eyeFadeStart: 0.1,
  }
}
```

### eyeFadeEnd

**Type:** `number | undefined`

**Description:** 視角に基づいて反射をフェードする終了角度(ラジアン)を指定します。

**Default:** `1`

**Example:**

```typescript
{
  ssr: {
    eyeFadeEnd: 1.2,
  }
}
```

### jitter

**Type:** `number | undefined`

**Description:** アーティファクトを減らすためのランダムジッター量を指定します。

**Default:** `1`

**Example:**

```typescript
{
  ssr: {
    jitter: 0.5,
  }
}
```

### blendMode

**Type:** `BlendMode | undefined`

**Description:** 反射と元のシーンを合成するためのブレンドモードを指定します。

**Default:** `"normal"`

:::note[初期化時のみ設定可能]
このプロパティはレイヤー作成時にのみ設定できます。`update()`メソッドでは変更できません。
:::

**有効な値:** `"normal"`, `"add"`, `"multiply"`, `"screen"`, `"overlay"` など（ColorGradingLUTEffectLayerのblendMode参照）

**Example:**

```typescript
{
  ssr: {
    blendMode: "add",
  }
}
```

### kernelSize

**Type:** `number | undefined`

**Description:** コーントレーシングのガウシアンブラーのカーネルサイズを指定します。

**Default:** `7`

:::note[初期化時のみ設定可能]
このプロパティはレイヤー作成時にのみ設定できます。`update()`メソッドでは変更できません。
:::

**Example:**

```typescript
{
  ssr: {
    kernelSize: 9,
  }
}
```

### useConeTracing

**Type:** `boolean | undefined`

**Description:** 視覚品質を向上させるコーントレーシングを有効にします。コストがかかる可能性があります。

**Default:** `true`

**Example:**

```typescript
{
  ssr: {
    useConeTracing: false,
  }
}
```

### coneTracingFadeStart

**Type:** `number | undefined`

**Description:** 反射のフェードが開始される比率を指定します。

**Default:** `0.9`

**Example:**

```typescript
{
  ssr: {
    coneTracingFadeStart: 0.5,
  }
}
```

### coneTracingFadeEnd

**Type:** `number | undefined`

**Description:** 反射のフェードが終了する比率を指定します。

**Default:** `1.0`

**Example:**

```typescript
{
  ssr: {
    coneTracingFadeEnd: 1.0,
  }
}
```

### coneTracingMaxDistance

**Type:** `number | undefined`

**Description:** 反射が見える最大距離を指定します。

**Default:** `500.0`

**Example:**

```typescript
{
  ssr: {
    coneTracingMaxDistance: 3000,
  }
}
```

### coneTracingIteration

**Type:** `number | undefined`

**Description:** コーントレーシングを蓄積する反復数を指定します。

**Default:** `14`

**Example:**

```typescript
{
  ssr: {
    coneTracingIteration: 8,
  }
}
```

### coneTracingIor

**Type:** `number | undefined`

**Description:** コーントレーシングの屈折率(IOR: Index of Refraction)を指定します。一般的な値は1.0から2.0の範囲です。

**Default:** `1.5`

**Example:**

```typescript
{
  ssr: {
    coneTracingIor: 1.5,
  }
}
```

## Usage Examples

### 基本的なSSRエフェクトの追加

```typescript
import ThreeView, { SSREffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// SSRエフェクトレイヤーを追加
const ssrLayer = view.addEffect<SSREffectLayer>({
  ssr: {},
});
```

### 水面反射のためのSSR

```typescript
import ThreeView, { SSREffectLayer, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルレイヤーを追加
plugin.addDefaultPhotorealScene();

// SSRエフェクトを追加
const ssrLayer = view.addEffect<SSREffectLayer>({
  ssr: {
    resolutionScale: 0.5,
    iterations: 100,
    binarySearchIterations: 4,
    maxRayDistance: 5000,
  },
});

// 水面ポリゴンを追加
view.addLayer({
  type: "geojson",
  data: {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.64, 35.77],
          [139.64, 35.61],
          [139.90, 35.61],
          [139.90, 35.77],
          [139.64, 35.77],
        ],
      ],
    },
  },
  polygon: {
    color: new Color().setHex(0x001e0f),
    reflectivity: 0.02,
    roughness: 0.2,
    water: true,
    specular: true,
  },
});
```

### パフォーマンス重視のSSR設定

```typescript
import ThreeView, { SSREffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// パフォーマンス重視の設定
const ssrLayer = view.addEffect<SSREffectLayer>({
  ssr: {
    resolutionScale: 0.25, // 低解像度でパフォーマンス向上
    iterations: 50,        // 反復回数を減らす
    useConeTracing: false, // コーントレーシングを無効化
  },
});
```

### コーントレーシングを使用した高品質SSR

```typescript
import ThreeView, { SSREffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// 高品質設定
const ssrLayer = view.addEffect<SSREffectLayer>({
  ssr: {
    resolutionScale: 1.0,
    iterations: 150,
    binarySearchIterations: 6,
    useConeTracing: true,
    coneTracingIteration: 8,
    jitter: 1,
  },
});
```

## 備考

高品質な反射エフェクトを提供しますが、パフォーマンスコストが高いため、必要に応じて解像度スケールやイテレーション数を調整してください。水面や光沢のある表面と組み合わせて使用すると効果的です。
