---
title: AmbientLightLayer
description: Ambient light descriptor for navara_three
sidebar:
  order: 151
---

`AmbientLightLayer`クラスは、シーン全体に均一に光を当てる環境光レイヤーを表します。AmbientLightはすべてのオブジェクトを均等に照らし、影を作りません。

## Common Properties

### visible

**Type:** `boolean | undefined`

**Description:** レイヤーの表示/非表示を制御します。

**Default:** `true`

**Example:**

```typescript
{
  visible: false,
  ambient: { ... }
}
```

## Ambient Properties

### ambient

**Type:** `object | undefined`

**Description:** 環境光の設定オプション。

#### color

**Type:** `Color | undefined`

**Description:** 環境光の色を`Color`オブジェクトで指定します。

**Default:** `new Color().setHex(0xffffff)`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  ambient: {
    color: new Color().setHex(0xffffff),
  }
}
```

#### intensity

**Type:** `number | undefined`

**Description:** 環境光の強度を指定します。数値が大きいほど明るくなります。

**Default:** `1`

**Example:**

```typescript
{
  ambient: {
    intensity: 1.0,
  }
}
```

## 使用例

### 基本的な使用例

```typescript
import ThreeView, { AmbientLightLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// 環境光レイヤーを追加
const ambientLight = view.addLight<AmbientLightLayer>({
  ambient: {
    color: new Color().setHex(0xffffff),
    intensity: 1.0
  }
});
```

### 環境光の更新

```typescript
// 環境光の色と強度を更新
ambientLight.update({
  ambient: {
    color: new Color().setHex(0xaabbcc),
    intensity: 0.5
  }
});
```

### シンプルな環境光

```typescript
// デフォルト設定で環境光を追加
view.addLight<AmbientLightLayer>({
  ambient: {}
});
```

### 初期非表示で追加

```typescript
// 非表示状態で環境光を追加し、後から表示切り替え
const ambientLightLayer = view.addLight<AmbientLightLayer>({
  visible: false,
  ambient: {
    intensity: 1,
    color: new Color().setHex(0xffffff),
  },
});

// 表示/非表示を切り替え
ambientLightLayer.visible = true;
```

## 注意事項

- 環境光は影を作りません。
- 環境光は全方向から均等にオブジェクトを照らします。
- 他のライトタイプ（SunLightLayer、SkyLightProbeLayerなど）と組み合わせて使用することができます。
- 環境光の強度が高すぎると、シーンが平坦に見える可能性があります。
