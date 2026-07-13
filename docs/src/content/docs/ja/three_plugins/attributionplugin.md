---
title: AttributionPlugin
description: navara_three 向けの、非モーダルでズーム連動するデータ出典（クレジット）UI プラグイン。
sidebar:
  order: 4
---

## 概要

`AttributionPlugin` は、地図のデータソースのクレジット UI を表示します。ポップオーバーはアクティブなソースを一覧し、**既定で開いた状態**なのでクリックなしでライセンスが見えます。右下の小さな ⓘ トリガーで開閉でき（`hide()` / `show()` も同じ）、非モーダルなので開いたままでも地図は操作可能（パン / ズーム / 回転）です。

地図の出典表示で一般的に必要となる、次の 3 点に対応します。

- **ズーム連動クレジット** — ソースは、特定のズーム範囲でのみ適用される子クレジットを持てます。該当するものだけが表示され、ズームに応じて静かに切り替わります。
- **レイヤー単位の動的クレジット** — レイヤー（3D タイルの copyright など）が供給するクレジットを、フィーチャーの出現 / 消滅に合わせて自動追跡します。`creditLayerId` で結び付けたソースの配下にネスト表示されます。
- **常時表示ロゴ** — 常に表示が必要なロゴ（Google など）は、ポップオーバーの開閉とは独立して左下の専用フレームに表示されます。

クレジットにはインライン `<a>` リンクを含められます（表示前にサニタイズされます）。色は [`setStyle()`](#setstylestyle) で実行時にテーマ変更できます。

## 使い方

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { AttributionPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container });
const defaultPlugin = new DefaultPlugin();
const attribution = new AttributionPlugin();

view.addPlugin(defaultPlugin);
view.addPlugin(attribution);
await view.init();

// ラスタの基盤地図: フィーチャー単位のクレジットを持たないため、静的に宣言します。
const basemap = view.addSource({
  type: "raster-tile",
  url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  maxZoom: 18,
});
view.addLayer({ type: "raster", source: basemap });

// タイルが自前の copyright を埋め込む 3D タイル（動的に追跡されます）。
const photorealSource = view.addSource({
  type: "3d-tiles",
  url: "https://tile.googleapis.com/v1/3dtiles/root.json?key=YOUR_KEY",
});
const photoreal = view.addLayer({ type: "3d-tiles", source: photorealSource });

// `add` / `remove` で表示する出典の集合を管理します。
attribution.add([
  {
    attribution: "国土地理院",
    attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
    children: [
      { attribution: "全国最新写真（シームレス）", minZoom: 14, maxZoom: 18 },
      { attribution: "GRUS画像（© Axelspace）", minZoom: 14, maxZoom: 18 },
    ],
  },
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    logo: "/credits/GoogleMaps.png",
    // このレイヤーのタイル単位のクレジットをこのソース配下にネスト。
    // レイヤーは id から view 内で解決されるため、別途渡す必要はありません。
    creditLayerId: photoreal.id,
  },
  {
    attributionHtml:
      '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a>',
  },
]);

// データが地図から外れたら、その出典を取り下げます。一致判定は構造ベースなので、
// add したときと同じ形（ここでは `logo` も含む）で渡します。
attribution.remove([
  {
    attribution: "Google Maps Photorealistic 3D Tiles",
    logo: "/credits/GoogleMaps.png",
    creditLayerId: photoreal.id,
  },
]);

// ポップオーバーは既定で開いています。hide() で畳み、show() で開き直します
// （ⓘ トリガーも同じ状態を切り替えます）。
attribution.hide();
attribution.show();
attribution.dispose();
```

## コンストラクタ

```typescript
new AttributionPlugin(options?: {
  style?: AttributionStyle;
  position?: "bottom-left" | "bottom-right";
});
```

`options.style` は初期の色を設定します（[AttributionStyle](#attributionstyle) を参照。省略すると既定値）。`options.position` は ⓘ トリガーとクレジットカードを置く下部の角を選びます（既定 `"bottom-right"`）。右下がページ独自の HUD などで埋まっている場合は `"bottom-left"` を使ってください。ロゴ枠はどちらのモードでも左下エリアに置かれますが、`"bottom-left"` では ⓘ が左端に入り、ロゴはその右隣にずれて並びます。プラグインは `view.init()` の**前に** `view.addPlugin()` で登録してください。

## メソッド

### add(items)

```typescript
add(items: AttributionItem[]): void
```

表示する出典を集合に追加します（現在のエントリにマージ）。完全に重複するエントリは除外されるため、同じクレジットを共有する複数のデータソースは 1 行にまとまります。`creditLayerId` を設定したソースは、そのレイヤーのフィーチャー単位のクレジットが動的に追跡されます。レイヤーは id から view 内で解決されるため、別途渡す必要はありません。

### remove(items)

```typescript
remove(items: AttributionItem[]): void
```

表示する出典を集合から削除します。エントリは（表示内容による）構造で一致判定されるため、追加時と同じ形のオブジェクトを渡してください。別途 id は不要です。一致しないエントリは無視されます。

静的に `add()` した出典を、カメラやアプリの状態に応じて出し入れするケースで使います（例: `children` のズーム帯では表せない範囲でトップレベル出典を出し入れしたいとき、カメラ移動に合わせて `add()` / `remove()` する）。`creditLayerId` で追跡している出典はレイヤー削除時に自動で消えるため、`remove()` は不要です。

### clear()

```typescript
clear(): void
```

表示中の出典をすべて削除しますが、プラグインは生かしたままにします（ポップオーバー・リスナー・注入したスタイルは残るため、あとで `add()` を呼べば UI が戻ります）。表示するものが無くなると ⓘ トリガーとロゴフレームは自動的に隠れます。DOM ごと破棄する場合は `dispose()` を使ってください。

### show()

```typescript
show(): void
```

出典ポップオーバーを開きます。既定で開いているため、`hide()` で閉じた後に開き直すときにのみ必要です（ⓘ トリガーも同じ状態を切り替えます）。ポップオーバーのカードにのみ作用し、常時表示のロゴフレームはそのままです。集合が空の間は見た目に変化しません（出典が 1 件も追加されるまで dock は隠れています）。

### hide()

```typescript
hide(): void
```

出典ポップオーバーを閉じます。ポップオーバーのカードにのみ作用し、追跡中の出典と常時表示のロゴフレームには触れません。エントリの削除は `remove()`、全体の破棄は `dispose()` を使ってください。

### dispose()

```typescript
dispose(): void
```

UI を削除し、プラグインが確保したすべてを解放します。

### setStyle(style)

```typescript
setStyle(style: AttributionStyle): void
```

実行時に UI の色を更新します。現在のスタイルにマージし、DOM を再構築せずその場で再テーマするため、ライト / ダークモードの切り替えに適しています。

```typescript
attribution.setStyle({
  backgroundColor: "rgba(20, 24, 28, 0.92)",
  textColor: "#e6e9ee",
  nestedTextColor: "rgba(230, 233, 238, 0.64)",
  linkColor: "#8ab4f8",
});
```

## 型

### AttributionItem

各エントリは、構造化されたソースか、生の HTML クレジットのいずれかです。

```typescript
type AttributionItem = AttributionSource | AttributionHtml;
```

### AttributionSource

| プロパティ            | 型                                 | 説明                                                 |
| ---------------- | --------------------------------- | -------------------------------------------------- |
| `attribution`    | `string`                          | トップレベルのソース／プロバイダ名                                  |
| `attributionUrl` | `string \| undefined`             | ソース名に付ける任意のリンク                                     |
| `logo`           | `string \| undefined`             | 任意のロゴ画像 URL。常時表示の左下フレームに表示される                      |
| `logoUrl`        | `string \| undefined`             | `logo` の任意のクリック遷移先。設定したときだけロゴがリンク化される              |
| `children`       | `AttributionChild[] \| undefined` | 該当ズーム範囲でのみ表示される任意のクレジット                   |
| `creditLayerId`  | `string \| undefined`             | 任意の `layer.id`。そのレイヤーのフィーチャー単位クレジットがこのソース配下にネストされる |

### AttributionHtml

| プロパティ             | 型        | 説明                               |
| ----------------- | -------- | -------------------------------- |
| `attributionHtml` | `string` | インライン `<a>` リンクを含む HTML 形式のクレジット |

### AttributionChild

| プロパティ      | 型                    | 説明                                      |
| --------------- | --------------------- | ----------------------------------------- |
| `attribution`   | `string`              | クレジットテキスト。インライン `<a>` リンクを含めてよい |
| `minZoom`       | `number \| undefined` | このクレジットが適用される最小ズーム（省略で下限なし） |
| `maxZoom`       | `number \| undefined` | このクレジットが適用される最大ズーム（省略で上限なし） |

### AttributionStyle

すべてのフィールドは任意です。未指定のフィールドは既定色を保ちます。色は CSS カスタムプロパティとして適用されるため、`setStyle()` でライブに再テーマできます。

| プロパティ             | 型                     | 説明                      |
| ----------------- | --------------------- | ----------------------- |
| `titleColor`      | `string \| undefined` | ソースタイトルのテキスト色           |
| `linkColor`       | `string \| undefined` | リンクと info アイコンの色        |
| `listStyleColor`  | `string \| undefined` | 箇条書き（リストマーカー）の色         |
| `textColor`       | `string \| undefined` | 本文テキスト色                 |
| `nestedTextColor` | `string \| undefined` | ネストした子クレジットのテキスト色 |
| `backgroundColor` | `string \| undefined` | ポップオーバーとトリガーの背景色        |
| `borderColor`     | `string \| undefined` | ヘッダ区切り線の色（ダークテーマで有用）    |

## 補足

- **ズーム範囲は、自分で宣言するラスタソース向けです。** GSI や OpenStreetMap などのタイルは自前のクレジットを持たないため、ズーム依存のクレジットは `children` で記述します。
- **レイヤー単位のクレジットはタイル由来です。** Google Photorealistic 3D Tiles のように copyright を埋め込むソースだけが `creditLayerId` 経由でクレジットを生成します。それ以外は `children` を使ってください。
- **掲出義務のあるロゴはロゴフレームへ（ポップオーバーではなく）。** 常時表示が必須のマークにのみ `logo` を使い、通常のソースはテキスト表示が適切です。ロゴは既定ではただの画像で、`logoUrl` を設定するとプロバイダのページへのリンクになります。表示は必須でもリンク化してはいけないマークもあるため、その場合は `logoUrl` を設定しないでください。
- **リンクはスキーム検証されます。** すべてのクレジットリンク（`attributionUrl`、`logoUrl`、`attributionHtml` / `attribution` 内のインライン `<a>`、レイヤーのフィーチャー単位クレジットに埋め込まれた `<a>`）は、安全なスキーム（`http` / `https` / `mailto`、または相対 URL）のみ保持され、それ以外（例: `javascript:`）はプレーンテキストに落とされます。これにより、信頼できないタイルメタデータ由来のリンクでも安全に描画できます。
- **生の URL は自動でリンク化されます。** クレジットテキスト内のプレーンな `http(s)` URL は自動でクリック可能なリンクになるため、公式の表記をそのまま貼り付けても URL を手で `<a>` で囲む必要がありません（文言も URL も変更されません）。

## 関連リソース

- [OverlayPlugin](../overlayplugin/) — ワールド座標からスクリーン座標への HTML オーバーレイ投影
- [About three_plugins](../about/) — パッケージの概要
