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

| メソッド          | 説明                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `init(view, ctx)` | プラグインの初期化処理。`view.init()` の中で自動的に呼び出される |

### Generics

| パラメータ | 説明                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `TView`    | `init()` に渡される view の型。通常は `ThreeView` または `ThreeView<MyDescriptions>` を指定します。                 |
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

Descriptor の登録をカプセル化する基本的なプラグインの例です。

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import {
  BoxMeshDesc,
  SphereMeshDesc,
  SunLightDesc,
  AmbientLightDesc,
  FXAAEffectDesc,
} from "@navara/three_default_descs";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    // メッシュ Descriptor の登録
    view.registerMesh("box", BoxMeshDesc);
    view.registerMesh("sphere", SphereMeshDesc);

    // ライト Descriptor の登録
    view.registerLight("sun", SunLightDesc);
    view.registerLight("ambient", AmbientLightDesc);

    // エフェクト Descriptor の登録
    view.registerEffect("fxaa", FXAAEffectDesc);
  }
}
```

```typescript
// 使用例
const plugin = new MyScenePlugin();
const view = new ThreeView({});
view.addPlugin(plugin);
await view.init();

// プラグインで登録した Descriptor が利用可能
view.addMesh({ box: { width: 100, height: 100, depth: 100 } });
view.addLight({ sun: { intensity: 1.0 } });
```

### 高レベル API を提供するプラグイン

`init()` 内で Descriptor を登録するだけでなく、初期化後に呼び出すメソッドを提供することもできます。

```typescript
import ThreeView, { Plugin, type ViewContext, type BaseHandle } from "@navara/three";
import {
  SkyMeshDesc,
  SunLightDesc,
  AmbientLightDesc,
  ToneMappingEffectDesc,
  FXAAEffectDesc,
} from "@navara/three_default_descs";

class MyScenePlugin extends Plugin<ThreeView, ViewContext> {
  private view?: ThreeView;

  async init(view: ThreeView, _ctx: ViewContext) {
    this.view = view;

    view.registerMesh("sky", SkyMeshDesc);
    view.registerLight("sun", SunLightDesc);
    view.registerLight("ambient", AmbientLightDesc);
    view.registerEffect("toneMapping", ToneMappingEffectDesc);
    view.registerEffect("fxaa", FXAAEffectDesc);
  }

  /** シーンに基本的な照明とエフェクトを追加する */
  setupScene(): {
    sky: BaseHandle<SkyMeshDesc>;
    sun: BaseHandle<SunLightDesc>;
  } {
    if (!this.view) throw new Error("Plugin is not initialized");

    const sky = this.view.addMesh<SkyMeshDesc>({ sky: {} });
    const sun = this.view.addLight<SunLightDesc>({
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

### カスタム Descriptor を含むプラグイン

独自に実装したカスタム Descriptor（[Custom Descriptor](../../../three/api/custom-desc/) を参照）を登録するプラグインも作成できます。

```typescript
import ThreeView, { Plugin, type ViewContext } from "@navara/three";
import { MyCustomMeshDesc } from "./layers/MyCustomMeshDesc";
import { MyCustomEffectDesc } from "./layers/MyCustomEffectDesc";

class MyCustomPlugin extends Plugin<ThreeView, ViewContext> {
  async init(view: ThreeView, _ctx: ViewContext) {
    view.registerMesh("myCustomMesh", MyCustomMeshDesc);
    view.registerEffect("myCustomEffect", MyCustomEffectDesc);
  }
}
```

## 関連リソース

- [About Plugin](../../../three/introduction/about-plugin/) - プラグインシステムの概念
- [Custom Descriptor](../../../three/core/custom-desc/) - カスタム Descriptor の実装方法
- [three_default_plugin](../../../three_default_plugin/about/) - DefaultPlugin の詳細
- [three_plugins](../../../three_plugins/about/) - ユースケース特化型プラグイン
