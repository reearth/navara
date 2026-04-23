---
title: SelectiveOutlineEffectDesc
description: Selective outline effect descriptor for navara_three
sidebar:
  order: 62
---

`SelectiveOutlineEffectDesc`クラスは、選択的なアウトラインエフェクトを適用する Descriptor です。マスクベースのフィルタリングを使用して、特定のオブジェクトにのみアウトラインを描画できます。Sobelフィルタを使用したエッジ検出により、オブジェクトの輪郭を強調します。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトの表示/非表示を制御します。

**Default:** `true`

### color

**Type:** `number | undefined`

**Description:** アウトラインの色を`Color`で指定します。

**Default:** `0xffffff`

**Example:**

```typescript
import { Color } from "@navara/three";

{
  selectiveOutline: {
    color: new Color().setStyle("#ff0000"),
  }
}
```

### thickness

**Type:** `number | undefined`

**Description:** アウトラインの太さを指定します。

**Default:** `1.0`

**Example:**

```typescript
{
  selectiveOutline: {
    thickness: 2.0,
  }
}
```

### edgeStrength

**Type:** `number | undefined`

**Description:** エッジ検出の強度を指定します。値が大きいほどエッジが強調されます。

**Default:** `1.0`

**Example:**

```typescript
{
  selectiveOutline: {
    edgeStrength: 1.5,
  }
}
```

### resolutionScale

**Type:** `number | undefined`

**Description:** レンダリング解像度のスケール係数を指定します。低い値でパフォーマンスが向上します。

**Default:** `1.0`

**Example:**

```typescript
{
  selectiveOutline: {
    resolutionScale: 0.5,
  }
}
```

### debugViews

**Type:** `boolean | undefined`

**Description:** デバッグビューを有効にするかどうかを指定します。有効にすると、マスクテクスチャのビューが表示されます。

**Default:** `false`

**Example:**

```typescript
{
  selectiveOutline: {
    debugViews: true,
  }
}
```

## オブジェクトへのエフェクト適用

選択的アウトラインエフェクトを特定のオブジェクトに適用するには、対象オブジェクトの`effectIds`プロパティにアウトラインエフェクトのIDを指定します。

### effectIds

対象オブジェクトに適用するセレクティブエフェクトのIDの配列です。アウトラインエフェクトを追加すると一意のIDが割り当てられ、このIDを対象オブジェクトの`effectIds`に指定することでエフェクトが適用されます。

### selectiveEffectOcclusion

エフェクト適用時のオクルージョン（遮蔽）処理モードを指定します。

| 値             | 説明                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `"normal"`     | 通常モード。深度テストを有効にし、他のオブジェクトに遮蔽されている部分にはエフェクトが適用されません（デフォルト） |
| `"silhouette"` | シルエットモード。深度テストを無効にし、オブジェクトが遮蔽されていてもエフェクトが表示されます                     |

## Usage Examples

### 基本的な選択的アウトラインの追加

```typescript
import ThreeView, {
  SelectiveOutlineEffectDesc,
  BoxMeshDesc,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

// 選択的アウトラインエフェクトを追加
const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0xffffff),
    thickness: 1.0,
    edgeStrength: 1.0,
  },
});

// オブジェクトにアウトラインエフェクトを適用
const cubeDesc = view.addMesh<BoxMeshDesc>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0x0088ff),
    effectIds: [outlineDesc.id], // アウトラインエフェクトを適用
    selectiveEffectOcclusion: "normal",
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### カラーアウトラインの追加

```typescript
import ThreeView, { SelectiveOutlineEffectDesc, Color } from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";

const view = new ThreeView();
const plugin = new DefaultPlugin();
view.addPlugin(plugin);
await view.init();

// デフォルトのフォトリアルオブジェクトを追加
plugin.addDefaultPhotorealScene();

// 赤色の太いアウトラインを追加
const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0xff0000),
    thickness: 2.5,
    edgeStrength: 1.5,
  },
});
```

### パフォーマンス重視の設定

```typescript
import ThreeView, { SelectiveOutlineEffectDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// パフォーマンス重視の設定
const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0xffffff),
    thickness: 1.0,
    edgeStrength: 1.0,
    resolutionScale: 0.5, // 低解像度でパフォーマンス向上
  },
});
```

### アウトラインエフェクトの動的更新

```typescript
import ThreeView, { SelectiveOutlineEffectDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0xffffff),
    thickness: 1.0,
  },
});

// 後からパラメータを更新
outlineDesc.update({
  selectiveOutline: {
    color: new Color().setHex(0x00ff00), // 緑
    thickness: 2.0,
  },
});
```

### 3D Tiles へのアウトライン適用

```typescript
import ThreeView, { SelectiveOutlineEffectDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0xff0000),
    thickness: 2.0,
  },
});

// 3D Tiles の建物にアウトラインを適用
const buildingsLayer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    effectIds: [outlineDesc.id],
    selectiveEffectOcclusion: "normal",
  },
});
```

### シルエットモードの使用

建物の背後にあるオブジェクトをハイライト表示する例：

```typescript
import ThreeView, {
  SelectiveOutlineEffectDesc,
  BoxMeshDesc,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0x00ff00),
    thickness: 2.0,
  },
});

// シルエットモード：建物の背後でもアウトラインが見える
const highlightedCube = view.addMesh<BoxMeshDesc>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    effectIds: [outlineDesc.id],
    selectiveEffectOcclusion: "silhouette", // 遮蔽されていても表示
  },
  position: { x: 0, y: 0, z: 500 },
});
```

### ブルームとアウトラインを組み合わせる

```typescript
import ThreeView, {
  SelectiveBloomEffectDesc,
  SelectiveOutlineEffectDesc,
  BoxMeshDesc,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomDesc = view.addEffect<SelectiveBloomEffectDesc>({
  selectiveBloom: {
    strength: 1.0,
  },
});

const outlineDesc = view.addEffect<SelectiveOutlineEffectDesc>({
  selectiveOutline: {
    color: new Color().setHex(0xff0000),
    thickness: 2.0,
  },
});

// 両方のエフェクトを適用
const cubeDesc = view.addMesh<BoxMeshDesc>({
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
    emissiveIntensity: 1.0,
    effectIds: [bloomDesc.id, outlineDesc.id], // 両方を適用
    selectiveEffectOcclusion: "normal",
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

## 備考

- 選択的アウトラインエフェクトは、Sobel フィルタを使用したエッジ検出により、オブジェクトの輪郭を描画します。
- 選択したオブジェクトのハイライト表示やフォーカス表示に適しています。
- `selectiveEffectOcclusion`のデフォルト値は`"normal"`です。`"silhouette"`モードは、遮蔽されているオブジェクトを意図的に表示したい場合に使用します。
- DepthEnabled オブジェクト（深度クリップあり）と Silhouette オブジェクト（深度クリップなし）の2パスでレンダリングされ、オクルージョンを正しく処理します。
