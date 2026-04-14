---
title: Custom Layer
description: カスタムレイヤーの実装について
sidebar:
  order: 21
---

navara_three では、メッシュ・エフェクト・ライトの各レイヤーを独自に実装できます。レイヤーの概念については [About Layer](../../../three/introduction/about-layer/) を参照してください。

## レイヤーの基底クラス

レイヤーの種類に応じて、対応する基底クラスを継承して実装します。

| レイヤー種別 | 基底クラス               | ファクトリメソッド | 登録メソッド            |
| ------------ | ------------------------ | ------------------ | ----------------------- |
| メッシュ           | `MeshLayerDeclaration`            | `createMesh()`                          | `view.registerMesh()`   |
| インスタンスメッシュ | `InstancedMeshLayerDeclaration`   | `createGeometry()` + `createMaterial()` | `view.registerMesh()`   |
| エフェクト         | `EffectLayerDeclaration`          | `createPass()`                          | `view.registerEffect()` |
| ライト             | `LightLayerDeclaration`           | `createLight()`                         | `view.registerLight()`  |

すべての基底クラスは `LayerDeclaration` を継承しており、共通のライフサイクルを持ちます。

## 共通のライフサイクル

| メソッド                    | タイミング                           | 説明                                                                                       |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `constructor(view, config)` | レイヤー生成時                       | ViewContext と設定を受け取る                                                               |
| `onCreate()`                | `addLayer()` 呼び出し時              | ファクトリメソッドを呼び出してインスタンスを作成し、シーンに追加する。基底クラスが実装済み |
| `onUpdateConfig(updates)`   | `handle.update()` 呼び出し時         | 設定の部分更新を処理する                                                                   |
| `onDestroy()`               | `handle.delete()` 呼び出し時         | リソースの解放とシーンからの削除                                                           |
| `update(time)`              | 毎フレーム（オプション）             | アニメーション処理。実装した場合のみ呼び出される                                           |
| `onResize(width, height)`   | ビューポートリサイズ時（オプション） | メッシュレイヤーのみ。実装した場合のみ呼び出される                                         |

## 共通プロパティ

| プロパティ  | 型                      | 説明                                                       |
| ----------- | ----------------------- | ---------------------------------------------------------- |
| `view`      | `ViewContext`           | シーン、カメラ、大気などへのアクセスを提供するコンテキスト |
| `_instance` | `Instance \| undefined` | 作成された Three.js オブジェクト                           |
| `id`        | `string`                | レイヤーの一意な識別子                                     |
| `visible`   | `boolean`               | 表示/非表示                                                |

### ViewContext

`this.view` を通じてシーン、カメラ、レンダリング API にアクセスできます。

#### プロパティ

| プロパティ                  | 説明                                              |
| --------------------------- | ------------------------------------------------- |
| `view.scenes.opaque`       | 不透明オブジェクト用シーン                        |
| `view.scenes.transparent`  | 半透明オブジェクト用シーン                        |
| `view.scenes.mrt`          | セレクティブエフェクト（Bloom / Outline）用シーン |
| `view.scenes.skyEnvMap`    | 環境マップ用シーン                                |
| `view.scenes.light`        | ライト用シーン                                    |
| `view.scenes.draped`       | 地形ドレープメッシュ用シーン                      |
| `view.camera`              | PerspectiveCamera                                 |
| `view.atmosphere`          | 大気（太陽方向、時刻など）                        |
| `view.globe`               | Globe インスタンス（設定済みの場合）              |

#### パス管理

| メソッド                                                | 説明                                               |
| ------------------------------------------------------- | -------------------------------------------------- |
| `view.getPass(name)`                                    | ポストプロセッシングパスを名前で取得               |
| `view.addPass(name, pass)`                              | ポストプロセッシングパスを追加                     |
| `view.insertPassBefore(targetName, name, pass)`         | 対象パスの前にパスを挿入                           |
| `view.insertPassAfter(targetName, name, pass)`          | 対象パスの後にパスを挿入                           |
| `view.removePass(name)`                                 | ポストプロセッシングパスを名前で削除               |

#### レンダラーアクセス

| メソッド                   | 説明                                                |
| -------------------------- | --------------------------------------------------- |
| `view.getRenderer()`      | WebGLRenderer インスタンスを取得                    |
| `view.getInputBuffer()`   | エフェクトコンポーザーの入力バッファを取得          |

#### バッファ / テクスチャアクセス

| メソッド                          | 説明                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `view.getRenderTarget()`          | メインレンダーターゲット（G-buffer を含む）を取得            |
| `view.getGlobeDepthTexture()`     | ポストプロセッシング用のグローブ深度テクスチャを取得         |
| `view.getGlobeNormalTexture()`    | ポストプロセッシング用のグローブ法線テクスチャを取得         |
| `view.getNormalTexture()`         | G-buffer からシーン法線テクスチャを取得                      |
| `view.getEffectIdsTexture()`      | G-buffer からエフェクト ID テクスチャを取得                  |
| `view.getEmissiveTexture()`       | G-buffer からエミッシブテクスチャを取得                      |

#### シャドウ（実験的）

| メソッド                                 | 説明                                               |
| ---------------------------------------- | -------------------------------------------------- |
| `view.applyShadowMaterial(material)`     | CSM シャドウをマテリアルに適用                     |
| `view.removeShadowMaterial(material)`    | CSM シャドウをマテリアルから削除                   |

#### セレクティブエフェクト

| メソッド                                                       | 説明                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `view.applyEffectToObject(object, effectIds, layerId?)`        | Object3D にセレクティブエフェクト（Bloom、Outline）を適用     |
| `view.removeEffectFromObject(object, effectIds?)`              | Object3D からセレクティブエフェクトを削除                     |

## カスタムメッシュレイヤー

### 型パラメータ

```typescript
class MyMeshLayer extends MeshLayerDeclaration<
  Config,      // レイヤーの設定型（MeshLayerConfig を拡張）
  UpdateConfig, // 更新時の設定型（MeshLayerUpdate を拡張）
  InstanceObj,  // Three.js オブジェクトの型（Object3D を拡張）
> {}
```

### 設定型の定義

```typescript
import type { MeshLayerConfig, MeshLayerUpdate } from "@navara/three";

type MyMeshDescription = {
  myMesh?: {
    radius?: number;
    color?: Color;
  };
};

type MyMeshConfig = MeshLayerConfig & MyMeshDescription;
type MyMeshUpdate = MeshLayerUpdate & MyMeshDescription;
```

### 基底クラスが管理するプロパティ

`MeshLayerDeclaration` は以下のプロパティの適用を自動的に処理します：

| プロパティ | 型            | 説明                       |
| ---------- | ------------- | -------------------------- |
| `position` | `{ x, y, z }` | ECEF 座標系での位置        |
| `scale`    | `{ x, y, z }` | スケール                   |
| `rotation` | `{ x, y, z }` | 回転（Euler 角、ラジアン） |
| `visible`  | `boolean`     | 表示/非表示                |

### レンダーパスの指定

`getPassKey()` をオーバーライドして、メッシュの描画先シーンを変更できます。

| PassKey         | 説明                                        |
| --------------- | ------------------------------------------- |
| `"opaque"`      | 不透明レンダリング（デフォルト）            |
| `"transparent"` | 半透明レンダリング                          |
| `"mrt"`         | セレクティブエフェクト用（Bloom / Outline） |
| `"skyEnvMap"`   | 環境マップ用                                |
| `"draped"`      | 地形ドレープレンダリング用                  |

### 実装例

```typescript
import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import {
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
} from "three";

// 設定型を定義
type MySphereMeshDescription = {
  mySphere?: {
    radius?: number;
    color?: Color;
    castShadow?: boolean;
  };
};
type MySphereMeshConfig = MeshLayerConfig & MySphereMeshDescription;
type MySphereMeshUpdate = MeshLayerUpdate & MySphereMeshDescription;

export class MySphereMeshLayer extends MeshLayerDeclaration<
  MySphereMeshConfig,
  MySphereMeshUpdate,
  Mesh<SphereGeometry, MeshStandardMaterial>
> {
  private config: MySphereMeshConfig;

  constructor(view: ViewContext, config: MySphereMeshConfig) {
    super(view, config);
    this.config = config;
  }

  // Three.js オブジェクトを作成して返す
  createMesh() {
    const cfg = this.config.mySphere ?? {};
    const geometry = new SphereGeometry(cfg.radius ?? 1);
    const material = new MeshStandardMaterial({
      color: cfg.color?.raw ?? 0xffffff,
    });
    const mesh = new Mesh(geometry, material);

    // シャドウを有効にする場合
    if (cfg.castShadow) {
      mesh.castShadow = true;
      this.view.applyShadowMaterial(material);
    }

    return mesh;
  }

  // 部分更新を処理
  onUpdateConfig(updates: MySphereMeshUpdate) {
    if (updates.mySphere && this._instance) {
      if (updates.mySphere.radius !== undefined) {
        // ジオメトリの再作成が必要な場合は recreate() を呼ぶ
        this.recreate();
      }
      if (updates.mySphere.color !== undefined) {
        this._instance.material.color.set(updates.mySphere.color.raw);
      }
      this.emit("needsUpdate");
    }
    // 基底クラスの処理（position, scale, rotation, visible）
    super.onUpdateConfig(updates);
  }

  // リソースの解放
  onDestroy() {
    if (this._instance) {
      this._instance.geometry.dispose();
      this._instance.material.dispose();
    }
    super.onDestroy();
  }
}
```

### 登録と使用

```typescript
import ThreeView from "@navara/three";

const view = new ThreeView({});
view.registerMesh("mySphere", MySphereMeshLayer);
await view.init();

const handle = view.addLayer<MySphereMeshLayer>({
  type: "mesh",
  mySphere: { radius: 100, color: new Color().setHex(0x00aaff) },
  position: { x: 0, y: 0, z: 6378137 },
});

// 部分更新
handle.update({ mySphere: { color: new Color().setHex(0xff0000) } });
```

### フレームごとのアニメーション

`update()` メソッドを実装すると、毎フレーム呼び出されます。

```typescript
export class RotatingBoxLayer extends MeshLayerDeclaration</* ... */> {
  createMesh() {
    // ...
  }

  // 毎フレーム呼び出される
  update(time: number) {
    if (this._instance) {
      this._instance.rotation.y = time * 0.001;
    }
  }
}
```

## Custom Instanced Mesh Layer

同じジオメトリの多数のコピーを1回の描画コールでレンダリングするには、`InstancedMeshLayerDeclaration` を使用します。すべてのインスタンスは1つのジオメトリとマテリアルを共有し、`instanceMatrix` と `instanceColor` でインスタンスごとの差異を表現します。

### Type Parameters

```typescript
class MyInstancedLayer extends InstancedMeshLayerDeclaration<
  TGeometry,    // Three.js BufferGeometry type
  TMaterial,    // Three.js Material type
  Config,       // Layer configuration type (extends InstancedMeshLayerConfig)
  UpdateConfig, // Update configuration type (extends InstancedMeshLayerUpdate)
  ChildConfig,  // Per-instance configuration type (extends InstancedChildConfig)
> {}
```

### InstancedChildConfig

インスタンスごとの共通トランスフォームフィールド：

| Property   | Type       | Description                                                      |
| ---------- | ---------- | ---------------------------------------------------------------- |
| `position` | `XYZ`      | Local position relative to the parent group                      |
| `rotation` | `XYZ`      | Local rotation (Euler angles in radians)                         |
| `scale`    | `XYZ`      | Local scale                                                      |
| `matrix`   | `Matrix4`  | Pre-computed transform matrix. When set, position/rotation/scale are ignored |

### Abstract Methods

| Method | Return Type | Description |
| ------ | ----------- | ----------- |
| `createGeometry()` | `TGeometry` | Create the shared geometry for all instances |
| `createMaterial()` | `TMaterial` | Create the shared material for all instances |
| `getChildConfigs()` | `ChildConfig[]` | Extract the initial array of instance configs from the layer config |
| `getInstanceColor(config)` | `ThreeColor \| undefined` | Extract the per-instance color, or undefined for default white |

### Optional Override Methods

| Method | Description |
| ------ | ----------- |
| `getInstanceScale(config, target)` | Compute per-instance scale. Override to incorporate geometry-specific dimensions (e.g., width/height/depth) |
| `composeInstanceMatrix(config)` | Compose the transform matrix for one instance. Override for custom transform logic |

### Instance Management Methods

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `add(config)` | `(config: ChildConfig) => number` | Add a new instance. Returns the index |
| `removeAt(index)` | `(index: number) => void` | Remove by index (swap-with-last, O(1)) |
| `updateAt(index, config)` | `(index: number, config: Partial<ChildConfig>) => void` | Update an instance at the given index |
| `clear()` | `() => void` | Remove all instances |
| `replaceAll(configs)` | `(configs: ChildConfig[]) => void` | Batch replace all instances (single update) |
| `count` | `number` (getter) | Number of active instances |

### Implementation Example

```typescript
import {
  InstancedMeshLayerDeclaration,
  type InstancedMeshLayerConfig,
  type InstancedMeshLayerUpdate,
  type InstancedChildConfig,
  type ViewContext,
  Color,
} from "@navara/three";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Color as ThreeColor,
} from "three";

// Per-instance configuration
type MyBoxChild = InstancedChildConfig & {
  color?: Color;
};

// Layer configuration
type MyBoxesConfig = InstancedMeshLayerConfig & {
  boxes?: { children?: MyBoxChild[] };
};
type MyBoxesUpdate = InstancedMeshLayerUpdate & {
  boxes?: { children?: MyBoxChild[] };
};

export class MyBoxesLayer extends InstancedMeshLayerDeclaration<
  BoxGeometry,
  MeshStandardMaterial,
  MyBoxesConfig,
  MyBoxesUpdate,
  MyBoxChild
> {
  private config: MyBoxesConfig;

  constructor(view: ViewContext, config: MyBoxesConfig) {
    super(view, config);
    this.config = config;
  }

  createGeometry() {
    return new BoxGeometry(1, 1, 1);
  }

  createMaterial() {
    return new MeshStandardMaterial();
  }

  getChildConfigs(): MyBoxChild[] {
    return this.config.boxes?.children ?? [];
  }

  getInstanceColor(config: MyBoxChild): ThreeColor | undefined {
    return config.color ? new ThreeColor(config.color.raw) : undefined;
  }
}
```

### Registration and Usage

```typescript
import ThreeView, { Color } from "@navara/three";

const view = new ThreeView({});
view.registerMesh("myBoxes", MyBoxesLayer);
await view.init();

const handle = view.addLayer<MyBoxesLayer>({
  type: "mesh",
  boxes: {
    children: [
      { position: { x: 0, y: 0, z: 100 }, color: new Color().setHex(0xff0000) },
      { position: { x: 200, y: 0, z: 100 }, color: new Color().setHex(0x00ff00) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});

// Add an instance dynamically
handle.ref.add({ position: { x: 400, y: 0, z: 100 }, color: new Color().setHex(0x0000ff) });

// Update instance at index 0
handle.ref.updateAt(0, { color: new Color().setHex(0xffff00) });

// Remove instance at index 1
handle.ref.removeAt(1);
```

## カスタムエフェクトレイヤー

### 型パラメータ

```typescript
class MyEffectLayer extends EffectLayerDeclaration<
  Config,      // レイヤーの設定型（EffectLayerConfig を拡張）
  UpdateConfig, // 更新時の設定型（EffectLayerUpdate を拡張）
  InstanceObj,  // ポストプロセッシングパスの型
> {}
```

### static プロパティ（パイプライン順序）

エフェクトレイヤーには、レンダーパイプライン内での挿入位置を制御する static プロパティがあります。

| プロパティ         | 型         | 説明                                                                             |
| ------------------ | ---------- | -------------------------------------------------------------------------------- |
| `key`              | `string`   | **必須**。エフェクトの一意なキー名                                               |
| `insertAfter`      | `string[]` | 指定したエフェクトの後に挿入（優先）                                             |
| `insertBefore`     | `string[]` | 指定したエフェクトの前に挿入（`insertAfter` が見つからない場合のフォールバック） |
| `allowDuplication` | `boolean`  | 同じエフェクトの複数インスタンスを許可するか                                     |

挿入順序は `insertAfter` → `insertBefore` → 末尾に追加 の優先度で決まります。

### 実装例

```typescript
import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
  type ViewContext,
} from "@navara/three";

type MyEffectDescription = {
  myEffect?: {
    intensity?: number;
  };
};
type MyEffectConfig = EffectLayerConfig & MyEffectDescription;
type MyEffectUpdate = EffectLayerUpdate & MyEffectDescription;

export class MyEffectLayer extends EffectLayerDeclaration<
  MyEffectConfig,
  MyEffectUpdate,
  MyPostProcessingPass
> {
  // パイプライン内の順序を制御
  static key = "myEffect";
  static insertAfter = ["clouds"];
  static insertBefore = ["transparent"];

  private config: MyEffectConfig;

  constructor(view: ViewContext, config: MyEffectConfig) {
    super(view, config);
    this.config = config;
  }

  // ポストプロセッシングパスを作成して返す
  createPass() {
    const cfg = this.config.myEffect ?? {};
    return new MyPostProcessingPass({
      intensity: cfg.intensity ?? 1.0,
    });
  }

  onUpdateConfig(updates: MyEffectUpdate) {
    if (updates.myEffect && this._instance) {
      if (updates.myEffect.intensity !== undefined) {
        this._instance.intensity = updates.myEffect.intensity;
      }
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }
}
```

### 他のエフェクトレイヤーを参照

`findLayer()` で他の登録済みエフェクトレイヤーを参照できます。

```typescript
createPass() {
  const ssao = this.findLayer<SSAOEffectLayer>("ssao");
  // ...
}
```

## カスタムライトレイヤー

### 型パラメータ

```typescript
class MyLightLayer extends LightLayerDeclaration<
  Config,      // レイヤーの設定型（LightLayerConfig を拡張）
  UpdateConfig, // 更新時の設定型（LightLayerUpdate を拡張）
  InstanceObj,  // Three.js Light の型
> {}
```

### 基底クラスが管理するプロパティ

| プロパティ | 型            | 説明         |
| ---------- | ------------- | ------------ |
| `position` | `{ x, y, z }` | ライトの位置 |
| `visible`  | `boolean`     | 表示/非表示  |

ライトは自動的に `view.scenes.light` シーンに追加されます。

### 実装例

```typescript
import {
  LightLayerDeclaration,
  type LightLayerConfig,
  type LightLayerUpdate,
  type ViewContext,
  Color,
} from "@navara/three";
import { PointLight } from "three";

type MyPointLightDescription = {
  myPointLight?: {
    color?: Color;
    intensity?: number;
    distance?: number;
  };
};
type MyPointLightConfig = LightLayerConfig & MyPointLightDescription;
type MyPointLightUpdate = LightLayerUpdate & MyPointLightDescription;

export class MyPointLightLayer extends LightLayerDeclaration<
  MyPointLightConfig,
  MyPointLightUpdate,
  PointLight
> {
  private config: MyPointLightConfig;

  constructor(view: ViewContext, config: MyPointLightConfig) {
    super(view, config);
    this.config = config;
  }

  createLight() {
    const cfg = this.config.myPointLight ?? {};
    const light = new PointLight(
      cfg.color?.raw ?? 0xffffff,
      cfg.intensity ?? 1,
      cfg.distance ?? 0,
    );
    return light;
  }

  onUpdateConfig(updates: MyPointLightUpdate) {
    if (updates.myPointLight && this._instance) {
      if (updates.myPointLight.color !== undefined) {
        this._instance.color.set(updates.myPointLight.color.raw);
      }
      if (updates.myPointLight.intensity !== undefined) {
        this._instance.intensity = updates.myPointLight.intensity;
      }
      if (updates.myPointLight.distance !== undefined) {
        this._instance.distance = updates.myPointLight.distance;
      }
      this.emit("needsUpdate");
    }
    super.onUpdateConfig(updates);
  }
}
```

## LayerHandle

`view.addLayer()` から返される `LayerHandle<T>` は、レイヤーを制御するためのハンドルです。

| プロパティ / メソッド | 型        | 説明                                     |
| --------------------- | --------- | ---------------------------------------- |
| `id`                  | `string`  | レイヤーの一意な識別子                   |
| `visible`             | `boolean` | 表示/非表示の取得・設定                  |
| `ref`                 | `T`       | 基底レイヤーインスタンスへの直接アクセス |
| `update(updates)`     | `void`    | 設定の部分更新                           |
| `delete()`            | `void`    | レイヤーの削除。`onDestroy()` が呼ばれる |

## 関連リソース

- [About Layer](../../../three/introduction/about-layer/) - レイヤーの概念と種類
- [About Plugin](../../../three/introduction/about-plugin/) - プラグインシステムの概念
- [Plugin API](../../../three/core/plugin/) - プラグインの実装方法
- [three_default_layers](../../../three_default_layers/about/) - デフォルトレイヤーの実装例
