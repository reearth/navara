---
title: SkyBoxMeshDesc
description: Sky box mesh descriptor for navara_three
sidebar:
  order: 112
---

`SkyBoxMeshDesc`は、シンプルなスカイボックスをシーンに追加するDescriptorです。昼夜の空の色と太陽の色を設定でき、大気散乱シミュレーション（`SkyMeshDesc`）を使用せずに軽量な空の表現が可能です。

以下のプロパティに加えて、基底クラスの共通プロパティ（`position`、`rotation`、`scale`、`matrix`、`matrixWorld`、`pickable`、`visible`）が利用できます。詳細は [MeshDesc](./mesh-desc-base) を参照してください。

## Properties

### skyBox

**Type:** `object | undefined`

**Description:** スカイボックスの設定オプション。

#### dayColor

**Type:** `Color | undefined`

**Description:** 昼間の空の色を指定します。

**Default:** `new Color().setHex(0x92c1ff)`（薄い青）

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    dayColor: new Color().setHex(0x87ceeb), // スカイブルー
  }
}
```

#### nightColor

**Type:** `Color | undefined`

**Description:** 夜間の空の色を指定します。

**Default:** `new Color().setHex(0x000033)`（暗い青）

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    nightColor: new Color().setHex(0x000022), // より暗い青
  }
}
```

#### sunColor

**Type:** `Color | undefined`

**Description:** 太陽周辺の色を指定します。

**Default:** `new Color().setHex(0xffddae)`（薄いオレンジ）

**Example:**

```typescript
import { Color } from "@navara/three";

{
  skyBox: {
    sunColor: new Color().setHex(0xffd700), // ゴールド
  }
}
```

## 使用例

### 基本的な使用例

```typescript
import ThreeView, { SkyBoxMeshDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// デフォルト設定でスカイボックスを追加
const skyBox = view.addMesh<SkyBoxMeshDesc>({
  skyBox: {},
});
```

### カスタムカラーの設定

```typescript
import ThreeView, { SkyBoxMeshDesc, Color } from "@navara/three";

const view = new ThreeView();
await view.init();

// カスタムカラーでスカイボックスを追加
const skyBox = view.addMesh<SkyBoxMeshDesc>({
  skyBox: {
    dayColor: new Color().setHex(0x87ceeb),    // スカイブルー
    nightColor: new Color().setHex(0x0a0a2e),   // ダークブルー
    sunColor: new Color().setHex(0xffa500),     // オレンジ
  },
});
```

### 動的な色の更新

```typescript
// 時間帯に応じて色を変更
skyBox.update({
  skyBox: {
    dayColor: new Color().setHex(0xff6b6b),
    sunColor: new Color().setHex(0xff4500),
  },
});
```

## SkyMeshDesc との違い

| 特徴 | SkyBoxMeshDesc | SkyMeshDesc |
|------|-----------------|--------------|
| レンダリング方式 | シンプルなグラデーション | 物理ベースの大気散乱 |
| パフォーマンス | 軽量 | やや重い |
| リアリティ | 基本的 | 高い |
| 太陽・月の表示 | なし | あり |
| 大気テクスチャ | 不要 | 必要 |

### 使い分け

- **SkyBoxMeshDesc**: シンプルなビジュアライゼーション、パフォーマンス重視のシーン、スタイライズされた表現
- **SkyMeshDesc**: リアルな大気表現、時間帯による変化、太陽・月の表示が必要な場合

## 注意事項

- スカイボックスはカメラの視錐台カリングが無効化されており、常に描画されます。
- 色は大気の `sunDirection` に基づいて昼夜の色がブレンドされます。
- `SkyMeshDesc` と同時に使用する場合は、描画順序に注意してください。
