---
title: SelectiveBloomEffectLayer
description: Selective bloom effect layer for navara_three
sidebar:
  order: 61
---

`SelectiveBloomEffectLayer`クラスは、選択的なブルームエフェクトを適用するレイヤーです。マスクベースのフィルタリングを使用して、特定のオブジェクトにのみブルームエフェクトを適用できます。

## Properties

### visible

**Type:** `boolean | undefined`

**Description:** エフェクトレイヤーの表示/非表示を制御します。

**Default:** `true`

### strength

**Type:** `number | undefined`

**Description:** ブルームエフェクトの強度を指定します。

**Default:** `0.8`

**Example:**

```typescript
{
  selectiveBloom: {
    strength: 1.2,
  }
}
```

### radius

**Type:** `number | undefined`

**Description:** ブルームエフェクトの半径(ぼかしの広がり)を指定します。

**Default:** `0.2`

**Example:**

```typescript
{
  selectiveBloom: {
    radius: 0.4,
  }
}
```

### threshold

**Type:** `number | undefined`

**Description:** ブルームエフェクトの閾値を指定します。この値より明るいピクセルにのみブルームが適用されます。

**Default:** `0.0`

**Example:**

```typescript
{
  selectiveBloom: {
    threshold: 0.5,
  }
}
```

### debugMode

**Type:** `number | undefined`

**Description:** デバッグモードを指定します。
- `0`: 通常モード
- `1`: ベースのみ表示
- `2`: ブルームのみ表示
- `3`: ブルーム強調表示(100倍)

**Default:** `0`

**Example:**

```typescript
{
  selectiveBloom: {
    debugMode: 2,
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
  selectiveBloom: {
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
  selectiveBloom: {
    debugViews: true,
  }
}
```

## オブジェクトへのエフェクト適用

選択的ブルームエフェクトを特定のオブジェクトに適用するには、対象オブジェクトの`effectIds`プロパティにブルームエフェクトレイヤーのIDを指定します。

### effectIds

対象オブジェクトに適用するセレクティブエフェクトレイヤーのIDの配列です。ブルームエフェクトレイヤーを追加すると一意のIDが割り当てられ、このIDを対象オブジェクトの`effectIds`に指定することでエフェクトが適用されます。

### selectiveEffectOcclusion

エフェクト適用時のオクルージョン（遮蔽）処理モードを指定します。

| 値 | 説明 |
|----|------|
| `"normal"` | 通常モード。深度テストを有効にし、他のオブジェクトに遮蔽されている部分にはエフェクトが適用されません（デフォルト） |
| `"silhouette"` | シルエットモード。深度テストを無効にし、オブジェクトが遮蔽されていてもエフェクトが表示されます |

## Usage Examples

### 基本的な選択的ブルームの追加

```typescript
import ThreeView, {
  SelectiveBloomEffectLayer,
  BoxMeshLayer,
  Color,
} from "@navara/three";

const view = new ThreeView();
await view.init();

// 選択的ブルームエフェクトレイヤーを追加
const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 0.8,
    radius: 0.2,
    threshold: 0.0,
  },
});

// オブジェクトにブルームエフェクトを適用
const cubeLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
    emissiveIntensity: 1.0,
    effectIds: [bloomLayer.id], // ブルームエフェクトを適用
    selectiveEffectOcclusion: "normal",
  },
  position: { x: 0, y: 0, z: 1000 },
});
```

### 強いブルームエフェクト

```typescript
import ThreeView, { SelectiveBloomEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

view.addDefaultEffectLayers();
view.addDefaultAtmosphereLayers();

// 強いブルームエフェクトを追加
const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 1.5,
    radius: 0.5,
    threshold: 0.2,
  },
});
```

### パフォーマンス重視の設定

```typescript
import ThreeView, { SelectiveBloomEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

// パフォーマンス重視の設定
const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 0.6,
    radius: 0.2,
    threshold: 0.0,
    resolutionScale: 0.5, // 低解像度でパフォーマンス向上
  },
});
```

### ブルームエフェクトの動的更新

```typescript
import ThreeView, { SelectiveBloomEffectLayer } from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 0.8,
  },
});

// 後からパラメータを更新
bloomLayer.update({
  selectiveBloom: {
    strength: 1.2,
    radius: 0.3,
  },
});
```

### 3D Tiles へのブルーム適用

```typescript
import ThreeView, { SelectiveBloomEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 1.0,
    radius: 0.5,
  },
});

// 3D Tiles の建物にブルームを適用
const buildingsLayer = view.addLayer({
  type: "cesium3dtiles",
  data: {
    url: "https://example.com/tileset.json",
  },
  model: {
    show: true,
    color: new Color().setHex(0xffffff),
    effectIds: [bloomLayer.id],
    emissiveColor: new Color().setHex(0xffffff),
    emissiveIntensity: 0.3,
    selectiveEffectOcclusion: "normal",
  },
});
```

### GeoJSON モデルへのブルーム適用

```typescript
import ThreeView, { SelectiveBloomEffectLayer, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

const bloomLayer = view.addLayer<SelectiveBloomEffectLayer>({
  type: "effect",
  selectiveBloom: {
    strength: 1.2,
  },
});

// GeoJSON レイヤーのモデルにブルームを適用
const modelLayer = view.addLayer({
  type: "geojson",
  data: featureCollection,
  model: {
    show: true,
    size: 100,
    url: "model.glb",
    effectIds: [bloomLayer.id],
    emissiveColor: new Color().setHex(0xffffff),
    emissiveIntensity: 0.5,
    selectiveEffectOcclusion: "normal",
  },
});
```

### エフェクトの動的な切り替え

```typescript
// 初期状態ではエフェクトなし
const cubeLayer = view.addLayer<BoxMeshLayer>({
  type: "mesh",
  box: {
    width: 100,
    height: 100,
    depth: 100,
    color: new Color().setHex(0xff0000),
    effectIds: [],
  },
  position: { x: 0, y: 0, z: 1000 },
});

// 後からブルームエフェクトを追加
cubeLayer.update({
  box: {
    effectIds: [bloomLayer.id],
    emissiveIntensity: 1.0,
  },
});

// エフェクトを無効化
cubeLayer.update({
  box: {
    effectIds: [],
  },
});
```

## 備考

- 選択的ブルームエフェクトは、マスクベースのフィルタリングを使用して特定のオブジェクトにのみブルームを適用します。
- ブルームエフェクトを効果的に使用するには、オブジェクトの`emissiveIntensity`を適切に設定することが重要です。
- `selectiveEffectOcclusion`のデフォルト値は`"normal"`です。`"silhouette"`モードは、遮蔽されているオブジェクトを意図的に表示したい場合に使用します。
- DepthEnabled オブジェクト（深度クリップあり）と Silhouette オブジェクト（深度クリップなし）の2パスでレンダリングされ、オクルージョンを正しく処理します。
