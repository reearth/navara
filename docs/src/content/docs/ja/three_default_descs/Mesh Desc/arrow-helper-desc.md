---
title: ArrowHelperDesc
description: Arrow helper Descriptor for navara_three
sidebar:
  order: 115
---

`ArrowHelperDesc` は、Three.js の `ArrowHelper` をシーンに追加するためのヘルパーDescriptorです。方向ベクトルの可視化、風向きや進行方向などの表現、デバッグ用途に適しています。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## Properties

### arrowHelper

**Type:** `object | undefined`

**Description:** アローヘルパーの設定。

#### direction

**Type:** `XYZ` (必須)

**Description:** 矢印の方向ベクトル。自動的に正規化されます。

#### origin

**Type:** `XYZ | undefined`

**Description:** 矢印の原点座標。省略時は `{ x: 0, y: 0, z: 0 }`。

#### length

**Type:** `number | undefined`

**Description:** 矢印の長さ。

**Default:** `1`

#### color

**Type:** `Color | undefined`

**Description:** 矢印の色を `Color` で指定します。

**Default:** `new Color().setStyle("#ffffff")`

#### headLength

**Type:** `number | undefined`

**Description:** 矢印ヘッドの長さ。

#### headWidth

**Type:** `number | undefined`

**Description:** 矢印ヘッドの太さ。

## 使用例

```typescript
import ThreeView, { ArrowHelperDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// 東方向へ長さ 5、緑色の矢印
view.addMesh<ArrowHelperDesc>({
  arrowHelper: {
    direction: { x: 1, y: 0, z: 0 },
    origin: { x: 0, y: 0, z: 0 },
    length: 5,
    color: new Color().setHex(0x00ff00),
    headLength: 1,
    headWidth: 0.5,
  },
});
```

## 備考

- `direction` は正規化されて使用されます。
- `color` を更新する場合は `update({ arrowHelper: { color } })` を使用できます。サイズ変更（`length/headLength/headWidth`）も更新可能です。

