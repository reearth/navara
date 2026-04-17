---
title: Plugin
description: プラグインの実装について
sidebar:
  order: 22
---

プラグインを実装するための API について説明します。プラグインシステムの概念については [About Plugin](../../../three/introduction/about-plugin/) を参照してください。

## Plugin クラス

すべてのプラグインは `Plugin` 抽象クラスを継承して実装します。

```typescript
import { Plugin } from "@navara/three";

abstract class Plugin<TView = unknown, TCtx = unknown> {
  abstract init(view: TView, ctx: TCtx): Promise<void>;
}
```

`Plugin` クラスは意図的に最小限のインターフェースとして設計されており、`init()` メソッドのみを持ちます。

| メソッド           | 説明                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `init(view, ctx)` | プラグインの初期化処理。`view.init()` の中で自動的に呼び出される |

### Generics

| パラメータ | 説明 |
| ---------- | ---- |
| `TView`    | `init()` に渡される view の型。通常は `ThreeView` または `ThreeView<MyLayerDescriptions>` を指定します。 |
| `TCtx`     | `init()` に渡されるコンテキストの型。`ViewContext` を指定すると、レンダラー、バッファ、パス管理 API にアクセスできます。 |

## ライフサイクル

プラグインは以下のタイミングで動作します：

1. `view.addPlugin(plugin)` — プラグインを登録（`view.init()` の**前**に呼び出す必要あり）
2. `view.init()` — 登録済みのすべてのプラグインの `init()` が**並列**に実行される

```
view.addPlugin(pluginA)
view.addPlugin(pluginB)
await view.init()
  ├── レンダーパス初期化
  ├── Promise.all([pluginA.init(view, ctx), pluginB.init(view, ctx)])  ← 並列実行
  └── メインループ開始
```

:::caution
`view.addPlugin()` は `view.init()` の**前**に呼び出してください。初期化後に呼び出すとエラーが発生します。
:::

## カスタムプラグインの実装

### 基本的なプラグイン

レイヤーの登録をカプセル化する基本的なプラグインの例です。

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import {
  BoxMeshLayer,
  SphereMeshLayer,
  SunLightLayer,
  AmbientLightLayer,
  FXAAEffectLayer,
} from "@navara/three_default_layers";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    // メッシュレイヤーの登録
    view.registerMesh("box", BoxMeshLayer);
    view.registerMesh("sphere", SphereMeshLayer);

    // ライトレイヤーの登録
    view.registerLight("sun", SunLightLayer);
    view.registerLight("ambient", AmbientLightLayer);

    // エフェクトレイヤーの登録
    view.registerEffect("fxaa", FXAAEffectLayer);
  }
}
```

```typescript
// 使用例
const plugin = new MyScenePlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// プラグインで登録したレイヤーが利用可能
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addLight({ sun: { intensity: 1.0 } });
```

### 高レベル API を提供するプラグイン

`init()` 内でレイヤーを登録するだけでなく、初期化後に呼び出すメソッドを提供することもできます。

```typescript
import ThreeView, { Plugin, type ViewContext, type LayerHandle } from "@navara/three";
import {
  SkyMeshLayer,
  SunLightLayer,
  AmbientLightLayer,
  ToneMappingEffectLayer,
  FXAAEffectLayer,
} from "@navara/three_default_layers";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  private view?: ThreeView;

  async init(view: ThreeView, _ctx: ViewContext) {
    this.view = view;

    view.registerMesh("sky", SkyMeshLayer);
    view.registerLight("sun", SunLightLayer);
    view.registerLight("ambient", AmbientLightLayer);
    view.registerEffect("toneMapping", ToneMappingEffectLayer);
    view.registerEffect("fxaa", FXAAEffectLayer);
  }

  /** シーンに基本的な照明とエフェクトを追加する */
  setupScene(): {
    sky: LayerHandle<SkyMeshLayer>;
    sun: LayerHandle<SunLightLayer>;
  } {
    if (!this.view) throw new Error("Plugin is not initialized");

    const sky = this.view.addMesh<SkyMeshLayer>({ sky: {} });
    const sun = this.view.addLight<SunLightLayer>({
      sun: { intensity: 1.0, castShadow: true },
    });
    this.view.addLight({ ambient: { intensity: 0.3 } });
    this.view.addEffect({ toneMapping: {} });
    this.view.addEffect({ fxaa: {} });

    return { sky, sun };
  }
}
```

```typescript
const plugin = new MyScenePlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// 初期化後にプラグインのメソッドを呼び出す
const { sky, sun } = plugin.setupScene();
```

### カスタムレイヤーを含むプラグイン

独自に実装したカスタムレイヤー（[Custom Layer](../../../three/api/custom-layer/) を参照）を登録するプラグインも作成できます。

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import { MyCustomMeshLayer } from "./layers/MyCustomMeshLayer";
import { MyCustomEffectLayer } from "./layers/MyCustomEffectLayer";

class MyCustomPlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    view.registerMesh("myCustomMesh", MyCustomMeshLayer);
    view.registerEffect("myCustomEffect", MyCustomEffectLayer);
  }
}
```

## 関連リソース

- [About Plugin](../../../three/introduction/about-plugin/) - プラグインシステムの概念
- [Custom Layer](../../../three/core/custom-layer/) - カスタムレイヤーの実装方法
- [three_default_plugin](../../../three_default_plugin/about/) - DefaultPlugin の詳細
