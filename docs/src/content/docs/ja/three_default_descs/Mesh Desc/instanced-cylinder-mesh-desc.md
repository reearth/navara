---
title: InstancedCylinderMeshDesc
description: navara_three 向け GPU インスタンス円柱メッシュ
sidebar:
  order: 105
---

`InstancedCylinderMeshDesc` クラスは、GPU インスタンシングを使用して複数の円柱インスタンスをレンダリングするメッシュです。すべての円柱が 1 つのジオメトリとマテリアルを共有し、1 回の描画コールで高パフォーマンスにレンダリングされます。`InstancedMeshDesc` を継承しています。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

テーパー比（`radiusTop` / `radiusBottom`）、セグメント、キャップ、弧（arc）はすべてのインスタンス間で共有され、共有ジオメトリに焼き込まれます。インスタンスごとの `radius` は XZ 方向の均等乗数、`height` は Y 方向の乗数として、共有された単位高さジオメトリに適用されます。

## 共有マテリアルプロパティ

すべてのインスタンスに適用される共有プロパティです。`cylinders` 設定オブジェクト内で指定します。

### radiusTop

**Type:** `number`

**Description:** 共有円柱ジオメトリの上端の半径を指定します。

**Default:** `1`

### radiusBottom

**Type:** `number`

**Description:** 共有円柱ジオメトリの下端の半径を指定します。

**Default:** `1`

### radialSegments

**Type:** `number`

**Description:** 円周方向のセグメント数を指定します。

**Default:** `16`

### heightSegments

**Type:** `number`

**Description:** 高さ方向のセグメント数を指定します。

**Default:** `1`

### openEnded

**Type:** `boolean`

**Description:** 端面（キャップ）を開いた状態にするかどうかを指定します。

**Default:** `false`

### thetaStart

**Type:** `number`

**Description:** 円形断面の開始角（ラジアン）を指定します。

**Default:** `0`

### thetaLength

**Type:** `number`

**Description:** 円形断面の角度範囲（ラジアン）を指定します。

**Default:** `Math.PI * 2`

### color

**Type:** `Color`

**Description:** すべてのインスタンスの基本色を `Color` インスタンスで指定します。

**Default:** `new Color().setStyle("#ffffff")`

### emissiveColor

**Type:** `Color`

**Description:** エミッシブ（自己発光）色を指定します。

**Default:** `new Color().setHex(0x000000)`

### emissiveIntensity

**Type:** `number`

**Description:** エミッシブの強度を指定します。

**Default:** `0`

### opacity

**Type:** `number`

**Description:** 不透明度を指定します。0.0（完全透明）から 1.0（完全不透明）の範囲です。

**Default:** `1`

### transparent

**Type:** `boolean`

**Description:** 透明度を有効にするかどうかを指定します。

**Default:** `false`

### castShadow

**Type:** `boolean`

**Description:** インスタンスが影を落とすかどうかを指定します。

**Default:** `false`

### receiveShadow

**Type:** `boolean`

**Description:** インスタンスが影を受けるかどうかを指定します。

**Default:** `false`

## インスタンスごとのプロパティ (CylinderChildConfig)

各円柱インスタンスのプロパティを `children` 配列内で指定します。

### radius

**Type:** `number`

**Description:** 均等な半径乗数（`radiusTop` と `radiusBottom` の両方をスケールします）。インスタンス行列の XZ スケールとしてエンコードされます。`scale.x` と `scale.z` が指定された場合は乗算されます。

**Default:** `1`

### height

**Type:** `number`

**Description:** 高さの乗数。インスタンス行列の Y スケールとしてエンコードされます。`scale.y` が指定された場合は乗算されます。

**Default:** `1`

### color

**Type:** `Color | undefined`

**Description:** このインスタンス固有の色を指定します。共有マテリアルの `color` を上書きします。

**Default:** `undefined`

### position

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** 親グループに対するローカル位置を指定します。

**Default:** `{ x: 0, y: 0, z: 0 }`

### rotation

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** ローカル回転（オイラー角、ラジアン）を指定します。

**Default:** `undefined`

### scale

**Type:** `{ x: number, y: number, z: number } | undefined`

**Description:** ローカルスケールを指定します。`radius` および `height` と乗算されます。

**Default:** `{ x: 1, y: 1, z: 1 }`

### matrix

**Type:** `Matrix4 | undefined`

**Description:** 事前計算された変換行列を指定します。設定時は `position`、`rotation`、`scale` は無視されます。

**Default:** `undefined`

## Config

### effectIds

**Type:** `string[]` (optional)

**Description:** このメッシュに適用する selective effect descriptor の ID 配列を指定します。

### pickable

**Type:** `boolean` (optional)

**Description:** 個々のインスタンスのピッキングを有効にします。

**Default:** `false`

## インスタンス管理

[InstancedMeshDesc](../../../three/core/custom-desc/#custom-instanced-mesh-desc) から継承される、動的なインスタンス管理メソッド:

### handle.ref.add(config)

新しいインスタンスを追加し、そのインデックスを返します。

```typescript
const index = handle.ref.add({
  position: { x: 100, y: 0, z: 0 },
  radius: 20,
  height: 30,
  color: new Color().setHex(0xffff00),
});
```

### handle.ref.removeAt(index)

指定インデックスのインスタンスを削除します。swap-with-last による O(1) 削除のため、順序は保持されません。

### handle.ref.updateAt(index, config)

指定インデックスのインスタンスを部分更新します。

### handle.ref.clear()

すべてのインスタンスを削除します。

### handle.ref.replaceAll(configs)

全インスタンスをバッチ置換します。

### handle.ref.count

アクティブなインスタンス数を取得します。

## 使用例

### 基本的な使い方

```typescript
import ThreeView, { Color } from "@navara/three";
import { InstancedCylinderMeshDesc } from "@navara/three_default_descs";

const view = new ThreeView();
view.registerMesh("cylinders", InstancedCylinderMeshDesc);
await view.init();

const handle = view.addMesh<InstancedCylinderMeshDesc>({
  cylinders: {
    color: new Color().setHex(0xffffff),
    castShadow: true,
    children: [
      { position: { x: 0, y: 0, z: 0 }, radius: 10, height: 20, color: new Color().setHex(0xff0000) },
      { position: { x: 30, y: 0, z: 0 }, radius: 15, height: 10, color: new Color().setHex(0x00ff00) },
      { position: { x: 60, y: 0, z: 0 }, radius: 5, height: 40, color: new Color().setHex(0x0000ff) },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```

### コーン形状

`radiusTop` または `radiusBottom` のいずれかを 0 にするとコーン形状になります:

```typescript
view.addMesh<InstancedCylinderMeshDesc>({
  cylinders: {
    radiusTop: 0,
    radiusBottom: 1,
    children: [
      { position: { x: 0, y: 0, z: 0 }, radius: 10, height: 30 },
    ],
  },
  position: { x: 0, y: 0, z: 6378137 },
});
```
