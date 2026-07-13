---
title: TileJsonPlugin
description: TileJSON 3.0.0 ドキュメントの URL から navara_three にタイルソースを登録するプラグイン。
sidebar:
  order: 6
---

## 概要

`TileJsonPlugin` は [TileJSON 3.0.0](https://github.com/mapbox/tilejson-spec/tree/master/3.0.0) ドキュメントを取得し、それを 1 つの Navara ソースとして登録します。タイル URL テンプレート、ズーム範囲、アトリビューションを手作業で `view.addSource()` にコピーする代わりに、ドキュメントの URL をプラグインに渡すだけで、これらのフィールドをドキュメントから導出します。

`addSource()` は [`ThreeView.addSource`](../../three/source/about/) と同じ形をしています。判別用の `type` と任意の `id` を渡しますが、`url` はタイルテンプレートではなく TileJSON ドキュメントを指します。プラグインは次の処理を行います。

- ドキュメントから最初のタイルエンドポイント、`minzoom` / `maxzoom`、`scheme` を読み取り、ソースへ引き渡します。
- ドキュメントの `attribution` クレジットを、呼び出し側が渡す [AttributionPlugin](../attributionplugin/) を通じて表示します。

TileJSON にはラスター画像とベクトルタイルを確実に見分けるフィールドがないため、対象となるソースの `type`（`"raster-tile"` または `"vector-tile"`）は呼び出し側が指定します。

## 使い方

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { AttributionPlugin, TileJsonPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container });

// TileJsonPlugin は各ドキュメントの `attribution` をこのプラグイン経由で表示する
// ため、AttributionPlugin は必須です。別途登録してください。ライフサイクルは
// 呼び出し側が管理します。
const attribution = new AttributionPlugin();
const tilejson = new TileJsonPlugin({ attribution });

view.addPlugin(new DefaultPlugin());
view.addPlugin(attribution);
view.addPlugin(tilejson);
await view.init();

// TileJSON ドキュメントを取得し、ラスターソースとして登録します。ドキュメントの
// `minzoom` / `maxzoom` / `scheme` はソースへ引き渡され、`attribution` は
// AttributionPlugin によって表示されます。
const source = await tilejson.addSource({
  type: "raster-tile",
  id: "basemap",
  url: "https://example.com/tiles.json",
});

// 返されたハンドルでソースを参照するか…
view.addLayer({ type: "raster", source });
// …上で渡した id で直接参照します。
view.addLayer({ type: "raster", source: "basemap" });
```

## コンストラクタ

```typescript
new TileJsonPlugin(options: TileJsonPluginOptions)
```

プラグインは `view.init()` の**前に** `view.addPlugin()` で登録してください。

### TileJsonPluginOptions

| プロパティ    | 型                  | 説明                                                                                                                                             |
| ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `attribution` | `AttributionPlugin` | 各 TileJSON の `attribution` クレジットを表示するための AttributionPlugin。必須です。ライフサイクルは呼び出し側の責任で、`view.addPlugin()` で登録します。 |

渡す AttributionPlugin は TileJSON 由来のクレジット専用にしてください。プラグインは収集したクレジットを表示リストごと置き換えて描画するため、同じ AttributionPlugin を他の用途と共有することはできません。

## メソッド

### addSource(desc)

```typescript
addSource(desc: TileJsonSourceDescription): Promise<Source>
```

`desc.url` にある TileJSON ドキュメントを取得し、指定した `desc.type` のソースを 1 つ作成します。`view.init()` の**後に**呼び出してください。それ以前に呼ぶと例外が投げられます。

ドキュメントから作成されるソースへのマッピングは次のとおりです。

| TileJSON フィールド | `raster-tile` ソース | `vector-tile` ソース    |
| ------------------- | -------------------- | ----------------------- |
| `tiles[0]`          | `url`                | `url`                   |
| `minzoom`           | `minZoom`            | —（エンジンに該当フィールドなし） |
| `maxzoom`           | `maxZoom`            | `maxZoom`               |
| `scheme: "tms"`     | `tms: true`          | —（エンジンに該当フィールドなし） |
| `attribution`       | AttributionPlugin で表示 | AttributionPlugin で表示 |

TileJSON の `tiles` 配列には、同じタイルセットに対する複数のミラーエンドポイントが列挙されることがあります。Navara のソースは単一の URL を取るため、最初のエンドポイントのみを使用し、残りは `console.warn` を出して無視します。

ドキュメントの `attribution` クレジットは収集され、AttributionPlugin を通じて表示されます。複数回の `addSource()` から得たクレジットはマージされ重複が除去されるため、同じ AttributionPlugin を繰り返し使っても 1 つの結合されたリストが保たれます。

戻り値は作成された [`Source`](../../three/source/about/) ハンドルです。レイヤーは、返されたハンドルまたは `desc.id` のいずれかで参照できます。

### dispose()

```typescript
dispose(): void
```

このプラグインが収集したクレジットをクリアします。渡された AttributionPlugin は破棄**されません**。呼び出し側が所有しているため、ビューを破棄する際に自分で破棄してください。

## 型

### TileJsonSourceType

```typescript
type TileJsonSourceType = "raster-tile" | "vector-tile";
```

TileJSON ドキュメントをどの Navara ソースタイプとして具体化するか。TileJSON にはラスター画像とベクトルタイルを確実に見分けるフィールドがないため、呼び出し側が指定します。

### TileJsonSourceDescription

| プロパティ | 型                    | 説明                                                                                                        |
| ---------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `type`     | `TileJsonSourceType`  | 作成する Navara ソースタイプ（`addSource` と同様）。                                                        |
| `url`      | `string`              | 取得・展開する TileJSON 3.0.0 ドキュメントの URL（タイルテンプレートではありません）。                     |
| `id`       | `string \| undefined` | 任意の呼び出し側指定ソース ID。返されたハンドルを保持せずに id でレイヤーからソースを参照するのに便利です。省略した場合はエンジンが生成します。 |

### TileJson

このプラグインが利用する TileJSON 3.0.0 ドキュメントの部分集合です。その他の仕様フィールド（`bounds`、`center`、`grids` など）は無視されます。

| プロパティ    | 型                    | デフォルト | 説明                                                                          |
| ------------- | --------------------- | ---------- | ----------------------------------------------------------------------------- |
| `tilejson`    | `string`              | —          | ドキュメントが準拠する TileJSON 仕様の semver（例: `"3.0.0"`）。必須です。      |
| `tiles`       | `string[]`            | —          | タイル URL テンプレート（`{z}/{x}/{y}`）。仕様上、必須かつ空でない配列です。     |
| `attribution` | `string \| undefined` | —          | AttributionPlugin を通じて表示されるアトリビューション／クレジット HTML。       |
| `minzoom`     | `number \| undefined` | `0`        | 最小ズームレベル。ラスターソースにのみ適用されます。                           |
| `maxzoom`     | `number \| undefined` | `30`       | 最大ズームレベル。                                                            |
| `scheme`      | `"xyz" \| "tms"`      | `"xyz"`    | タイルスキーム。`"tms"` は Y 軸を反転します（ラスターソースのみ）。            |

ドキュメントは取得時に検証されます。`tilejson` が欠けている、または `major.minor.patch` 形式のバージョンでない場合、あるいは `tiles` が欠けている、または空の場合、`addSource()` は失敗します。

## 補足

- **タイルテンプレートではなくドキュメントの URL。** `desc.url` は TileJSON JSON ドキュメントのアドレスです。タイル URL テンプレートはドキュメントの `tiles` フィールドから得られます。ここに `{z}/{x}/{y}` テンプレートを渡さないでください。
- **ソースの `type` は指定が必要。** TileJSON はタイルセットがラスターかベクトルかを示さないため、ドキュメントが配信するタイルに合わせて `"raster-tile"` または `"vector-tile"` を選んでください。
- **ベクトルソースは `minzoom` と `scheme` を無視します。** エンジンのベクトルタイルソースには `minZoom` や `tms` フィールドがないため、`"vector-tile"` では `maxzoom` のみが引き継がれます。

## 関連リソース

- [AttributionPlugin](../attributionplugin/) — データアトリビューション（クレジット）UI。このプラグインで必須
- [About three_plugins](../about/) — パッケージ概要
- [Raster Layer](../../three/layer/raster-layer/) — Raster レイヤーのリファレンス
