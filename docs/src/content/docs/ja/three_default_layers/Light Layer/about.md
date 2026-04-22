---
title: Light Descriptor
description: Light descriptor types for navara_three
sidebar:
  order: 150
---

LightLayer は、3Dシーンの照明を管理するクラス群です。環境光、太陽光、Image-Based Lightingなど、様々な照明手法を提供します。

## LightDescriptor Types

navara_three は、様々な照明要件に対応する複数のライトレイヤータイプを提供しています：

### [AmbientLightLayer](../../../three/light-layer-reference/ambient-light-layer/)

**用途:** シーン全体の環境光
**説明:** すべてのオブジェクトを均等に照らす基本的な環境光。影を作りません。
**主な特徴:**
- シンプルで軽量
- 全方向から均一な照明
- 影なし

**使用例:**
```typescript
import ThreeView, { Color } from "@navara/three";
import { AmbientLightLayer } from "@navara/three_default_layers";

view.registerLight("ambient", AmbientLightLayer);

view.addLight<AmbientLightLayer>({
  ambient: {
    color: new Color().setHex(0xffffff),
    intensity: 1.0
  }
});
```

### [LightProbeLayer](../../../three/light-layer-reference/light-probe-layer/)

**用途:** Image-Based Lighting（IBL）
**説明:** 球面調和関数を使用した事前計算済みの環境照明。リアルな間接照明を実現します。
**主な特徴:**
- 球面調和関数（Spherical Harmonics）による高速計算
- 事前計算されたライティングデータを使用
- 静的な環境照明に最適

**使用例:**
```typescript
import ThreeView from "@navara/three";
import { LightProbeLayer } from "@navara/three_default_layers";

view.registerLight("lightProbe", LightProbeLayer);

view.addLight<LightProbeLayer>({
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(coefficients),
    intensity: 0.05
  }
});
```

### [SkyLightProbeLayer](../../../three/light-layer-reference/sky-light-probe-layer/)

**用途:** 動的なスカイライティング
**説明:** 大気散乱シミュレーションと連携した動的な環境照明。太陽の位置に応じて自動更新されます。
**主な特徴:**
- 大気システムと自動連携
- 太陽の位置に追従
- 昼夜で異なる照明を自動計算

**使用例:**
```typescript
import ThreeView from "@navara/three";
import { SkyLightProbeLayer } from "@navara/three_default_layers";

view.registerLight("skyLightProbe", SkyLightProbeLayer);

view.addLight<SkyLightProbeLayer>({
  skyLightProbe: {
    intensity: 1.0
  }
});
```

### [SunLightLayer](../../../three/light-layer-reference/sun-light-layer/)

**用途:** 太陽光と影
**説明:** Cascaded Shadow Maps（CSM）を使用した高品質な太陽光シミュレーション。大気散乱と連携します。
**主な特徴:**
- 高品質なCascaded Shadow Maps
- 大気散乱による動的な色計算
- 詳細な影のパラメータ制御

**使用例:**
```typescript
import ThreeView from "@navara/three";
import { SunLightLayer } from "@navara/three_default_layers";

view.registerLight("sun", SunLightLayer);

view.addLight<SunLightLayer>({
  sun: {
    intensity: 1.0,
    castShadow: true,
    shadowMapSize: 2048,
    shadowCascadeCount: 4
  }
});
```

## Light Descriptor Types 比較表

| ライトタイプ           | 影          | 動的更新 | 大気連携 | 主な用途         | パフォーマンス   |
| ---------------------- | ----------- | -------- | -------- | ---------------- | ---------------- |
| **AmbientLightLayer**  | なし        | 手動     | 不要     | 基本的な環境光   | 非常に軽量       |
| **LightProbeLayer**    | なし        | 手動     | 不要     | 静的IBL          | 軽量             |
| **SkyLightProbeLayer** | なし        | 自動     | 必須     | 動的スカイライト | 中程度           |
| **SunLightLayer**      | あり（CSM） | 自動     | 推奨     | 太陽光と影       | 重い（影使用時） |

## 一般的な使用パターン

### 基本的な照明セットアップ

最もシンプルな照明構成：

```typescript
// AmbientLightLayer が登録済みであること
view.addLight<AmbientLightLayer>({
  ambient: { intensity: 1.0 }
});
```

### 推奨される照明セットアップ

リアルなシーンには、複数のライトレイヤーを組み合わせます。[three_default_plugin](../../../three_default_plugin/about/) の `DefaultPlugin` を使用すると、すべてのレイヤーが一括登録され、`addDefaultPhotorealScene()` でフォトリアルなシーンを簡単にセットアップできます。

```typescript
import { DefaultPlugin } from "@navara/three_default_plugin";

const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// フォトリアルなシーンを一括セットアップ（SunLight + SkyLightProbe 等を含む）
const layers = plugin.addDefaultPhotorealScene();

// 必要に応じて追加の環境光
view.addLight<AmbientLightLayer>({
  ambient: { intensity: 0.3 }
});
```

### 夜間シーンのセットアップ

夜間シーンには、追加のライトプローブが効果的です：

```typescript
// DefaultPlugin でフォトリアルなシーンをセットアップ
const layers = plugin.addDefaultPhotorealScene();

// 夜間用ライトプローブ（LightProbeLayer は DefaultPlugin で登録済み）
const nightLight = view.addLight<LightProbeLayer>({
  lightProbe: {
    sh: new THREE.SphericalHarmonics3().set(NIGHT_COEFFICIENTS),
    intensity: 0.05
  }
});

// 夜間のみ有効化
view.atmosphere.on("sunChanged", () => {
  const isNight = view.atmosphere.isAtNight(view.camera.positionECEF);
  nightLight.update({ visible: isNight });
});
```

## 注意事項

### パフォーマンス考慮事項

- **AmbientLight**: 最も軽量、常に有効化可能
- **LightProbe/SkyLightProbe**: 中程度、シェーダー計算が追加される
- **SunLight with CSM**: 最も重い、特に高解像度シャドウマップ使用時

### 大気システムとの連携

以下のライトレイヤーは大気システムと連携します：

- **SkyLightProbeLayer**: 大気の放射照度テクスチャを使用（必須）
- **SunLightLayer**: 大気の透過テクスチャを使用（推奨）

大気システムを使用しない場合は、AmbientLightLayerとLightProbeLayerを使用してください。

## 関連リソース

- [Resource Layer Reference](../../../three/resource-layer-reference/about/) - リソースレイヤーの詳細
- [Effect Descriptor Reference](../../../three/effect-layer-reference/about/) - エフェクトレイヤー
- [API Reference](../../../three/api/) - ThreeView API
