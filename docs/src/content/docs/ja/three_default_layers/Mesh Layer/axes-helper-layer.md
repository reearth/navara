---
title: AxesHelperDesc
description: Axes helper Descriptor for navara_three
sidebar:
  order: 114
---

`AxesHelperDesc` は、Three.js の `AxesHelper` をシーンに追加するためのヘルパーDescriptorです。X(赤)/Y(緑)/Z(青) の3軸を可視化し、座標系の確認やデバッグに役立ちます。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-layer-base) を参照してください。

## Properties

### axesHelper

**Type:** `object | undefined`

**Description:** ヘルパーの設定。

#### size

**Type:** `number | undefined`

**Description:** 軸の長さを指定します。

**Default:** `5`

**Note:** サイズは作成時のみ反映されます。変更する場合はDescriptorを再作成してください。

## 使用例

```typescript
import ThreeView, { AxesHelperDesc } from "@navara/three";

const view = new ThreeView();
await view.init();

// 3軸ヘルパーを追加
const axes = view.addMesh<AxesHelperDesc>({
  axesHelper: {
    size: 10,
  },
  position: { x: 0, y: 0, z: 0 },
});

// 表示/非表示の切り替え
axes.update({ visible: false });
```

## Tips

- 原点付近だけでなく、任意の位置に `position` を指定して配置できます。
- 他のメッシュと重なる場合はカメラや位置を調整して見やすくしてください。

