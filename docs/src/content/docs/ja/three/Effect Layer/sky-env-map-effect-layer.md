---
title: SkyEnvMapEffectDesc
description: Sky environment map effect descriptor for navara_three
sidebar:
  order: 61
---

`SkyEnvMapEffectDesc`クラスは、空の環境マップをレンダリングするパスです。環境マッピングや反射に使用される空のテクスチャを生成します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

### resolution

**Type:** `number | undefined`

**Description:** 環境マップの解像度を指定します。この値は作成時にのみ設定され、後から変更するにはパスを再作成する必要があります。

**Default:** `256`

**Example:**

```typescript
{
  skyEnvMap: {
    resolution: 512,
  }
}
```

## Usage Examples

### 基本的な空環境マップの追加

```typescript
import ThreeView, { SkyEnvMapEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加（空のレンダリングに必要）
plugin.addDefaultPhotorealScene();

// 空環境マップエフェクトを追加
view.addEffect<SkyEnvMapEffectDesc>({
  skyEnvMap: {
    resolution: 256,
  },
});
```

### 高解像度の環境マップ

```typescript
import ThreeView, { SkyEnvMapEffectDesc } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加
plugin.addDefaultPhotorealScene();

// 高解像度の環境マップを作成
view.addEffect<SkyEnvMapEffectDesc>({
  skyEnvMap: {
    resolution: 512,
  },
});
```

### 反射マテリアルと組み合わせた使用

```typescript
import ThreeView, { SkyEnvMapEffectDesc, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加
plugin.addDefaultPhotorealScene();

// 空環境マップを追加（反射に使用される）
view.addEffect<SkyEnvMapEffectDesc>({
  skyEnvMap: {
    resolution: 256,
  },
});

// 反射するマテリアルを持つ3Dタイルを追加
view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    metalness: 1.0,
    roughness: 0.0, // 滑らかな表面で環境が反射される
  },
});
```

## 備考

生成された環境マップは、マテリアルの反射や環境ライティングに使用されます。解像度は作成時に固定されるため、変更する場合は Descriptor を再作成する必要があります。
