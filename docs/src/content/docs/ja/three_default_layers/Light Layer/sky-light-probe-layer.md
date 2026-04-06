---
title: SkyLightProbeLayer
description: Sky light probe layer for navara_three
sidebar:
  order: 153
---

`SkyLightProbeLayer`クラスは、大気散乱シミュレーションと連携した動的なスカイライトプローブレイヤーを表します。太陽の位置に応じて自動的に更新される環境照明を提供し、リアルな空の照明を再現します。

太陽の方向は `view.atmosphere.date` に基づいて自動計算され、毎フレーム照明が更新されます。

:::tip[関連ドキュメント]
大気システムの詳細については [Atmosphere クラス](../../../three/api-reference/atmosphere/) を参照してください。
:::

## Common Properties

### visible

**Type:** `boolean | undefined`

**Description:** レイヤーの表示/非表示を制御します。

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  skyLightProbe: { ... }
}
```

## SkyLightProbe Properties

### skyLightProbe

**Type:** `object | undefined`

**Description:** スカイライトプローブの設定オプション。

#### intensity

**Type:** `number | undefined`

**Description:** スカイライトプローブの強度を指定します。数値が大きいほど明るくなります。

**Default:** `1`

**Example:**

```typescript
{
  skyLightProbe: {
    intensity: 1.0,
  }
}
```

## 動的更新

SkyLightProbeLayerは以下の要素に基づいて自動的に更新されます：

- **太陽の方向**: `view.atmosphere.sunDirection`から取得
- **カメラの位置**: 大気圏内外での照明の違いを考慮
- **大気テクスチャ**: 放射照度（irradiance）テクスチャを使用

これらの更新は毎フレーム自動的に実行されるため、手動での更新は不要です。

:::note[更新可能なプロパティ]
レイヤー作成後に`update()`メソッドで変更できるプロパティは**`intensity`のみ**です。太陽の方向や位置などは自動的に更新されるため、手動で設定することはできません。
:::

## 使用例

### 基本的な使用例

```typescript
import ThreeView, { SkyLightProbeLayer } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルレイヤーを追加
const defaultLayers = plugin.addDefaultPhotorealLayers();

// スカイライトプローブが自動的に太陽の位置に追従
defaultLayers.skyLightProbe.update({
  skyLightProbe: {
    intensity: 1.0
  }
});
```

### 昼夜で強度を変更

```typescript
const skyLightProbe = view.addLayer<SkyLightProbeLayer>({
  type: "light",
  skyLightProbe: {
    intensity: 1.0
  }
});

// 昼夜で異なる強度を設定
const params = {
  dayIntensity: 1.0,
  nightIntensity: 5.0
};

view.atmosphere.on("sunChanged", () => {
  const isAtNight = view.atmosphere.isAtNight(view.camera.positionECEF);
  const intensity = isAtNight ? params.nightIntensity : params.dayIntensity;

  skyLightProbe.update({
    skyLightProbe: { intensity }
  });
});
```

### 夜間のみ有効化

```typescript
const skyLightProbe = view.addLayer<SkyLightProbeLayer>({
  type: "light",
  skyLightProbe: {
    intensity: 1.0
  },
});

// 夜間のみ強度を上げる
view.atmosphere.on("sunChanged", () => {
  const isAtNight = view.atmosphere.isAtNight(view.camera.positionECEF);
  if(!isAtNight) return;
  skyLightProbe.update({
    skyLightProbe: {
      intensity: 5.0
    },
  });
});
```

## 大気システムとの連携

SkyLightProbeLayerは、`@takram/three-atmosphere`パッケージの大気散乱シミュレーションと密接に連携します：

1. **放射照度テクスチャの取得**: 大気レイヤーから事前計算された放射照度テクスチャを取得
2. **太陽方向の同期**: 太陽の方向を毎フレーム同期
3. **位置の更新**: カメラ位置に基づいて適切な照明を計算

これにより、時間帯や太陽の位置に応じた自然な環境照明が実現されます。

## LightProbeLayerとの違い

| 特徴         | SkyLightProbeLayer     | LightProbeLayer    |
| ------------ | ---------------------- | ------------------ |
| 更新方法     | 自動（太陽位置に追従） | 手動（固定値）     |
| データソース | 大気シミュレーション   | 事前計算された係数 |
| 用途         | 動的な空の照明         | 静的な環境照明     |
| 大気連携     | 必須                   | 不要               |

## 注意事項

- SkyLightProbeLayerを使用するには、大気レイヤー（Atmosphere）が必要です。
- `plugin.addDefaultPhotorealLayers()`を使用すると、SkyLightProbeLayerが自動的に含まれます。
- 夜間は強度を高めに設定することで、より自然な夜景照明を実現できます。
- 他のライトレイヤー（AmbientLight、SunLightなど）と組み合わせて使用できます。
