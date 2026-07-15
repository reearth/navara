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
- ドキュメントの `attribution` クレジットを、ビュー組み込みのアトリビューション UI（[`view.attribution`](../../three/plugins/attributionplugin/)）を通じて自動的に表示します。

TileJSON にはラスター画像とベクトルタイルを確実に見分けるフィールドがないため、対象となるソースの `type`（`"raster-tile"` または `"vector-tile"`）は呼び出し側が指定します。

独自のクレジット UI を構築したい場合は、組み込み UI を無効化し（`new ThreeView({ defaultAttribution: false })`）、各ドキュメントのアトリビューションを [`loaded`](#イベント) イベントから受け取ってください。

## 使い方

```typescript
import ThreeView from "@navara/three";
import { DefaultPlugin } from "@navara/three_default_plugin";
import { TileJsonPlugin } from "@navara/three_plugins";

const view = new ThreeView({ container });

const tilejson = new TileJsonPlugin();

view.addPlugin(new DefaultPlugin());
view.addPlugin(tilejson);
await view.init();

// TileJSON ドキュメントを取得し、ラスターソースとして登録します。ドキュメントの
// `minzoom` / `maxzoom` / `scheme` はソースへ引き渡され、`attribution` は
// 組み込みのアトリビューション UI によって表示されます。
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
new TileJsonPlugin();
```

プラグインは `view.init()` の**前に** `view.addPlugin()` で登録してください。コンストラクタはオプションを取りません。アトリビューションはビュー組み込みの UI で処理され、独自の UI を使いたい場合は [`loaded`](#イベント) イベントを購読します。

## メソッド

### addSource(desc)

```typescript
addSource(desc: TileJsonSourceDescription): Promise<Source>
```

`desc.url` にある TileJSON ドキュメントを取得し、指定した `desc.type` のソースを 1 つ作成します。`view.init()` の**後に**呼び出してください。それ以前に呼ぶと例外が投げられます。

ドキュメントから作成されるソースへのマッピングは次のとおりです。

| TileJSON フィールド | `raster-tile` ソース      | `vector-tile` ソース              |
| ------------------- | ------------------------- | --------------------------------- |
| `tiles[0]`          | `url`                     | `url`                             |
| `minzoom`           | `minZoom`                 | —（エンジンに該当フィールドなし） |
| `maxzoom`           | `maxZoom`                 | `maxZoom`                         |
| `scheme: "tms"`     | `tms: true`               | —（エンジンに該当フィールドなし） |
| `attribution`       | `view.attribution` で表示 | `view.attribution` で表示         |

TileJSON の `tiles` 配列には、同じタイルセットに対する複数のミラーエンドポイントが列挙されることがあります。Navara のソースは単一の URL を取るため、最初のエンドポイントのみを使用し、残りは `console.warn` を出して無視します。

`attribution` クレジットはビュー組み込みのアトリビューション UI（`view.attribution`）に追加されます。複数回の `addSource()` から得たクレジットは重複が除去されるため、共有・重複するクレジットは 1 度だけ表示されます。組み込み UI を無効化している場合（`defaultAttribution: false`）はこの処理はスキップされます。その場合は [`loaded`](#イベント) イベントからアトリビューションを取得してください。

ソースの登録後、作成されたソース・解析済みドキュメント・そのアトリビューションを伴って [`loaded`](#イベント) イベントが発火します。

戻り値は作成された [`Source`](../../three/source/about/) ハンドルです。レイヤーは、返されたハンドルまたは `desc.id` のいずれかで参照できます。

### on / once / off

```typescript
on<E extends keyof TileJsonPluginEventMap>(event: E, listener: TileJsonPluginEventMap[E]): void
once<E extends keyof TileJsonPluginEventMap>(event: E, listener: TileJsonPluginEventMap[E]): void
off<E extends keyof TileJsonPluginEventMap>(event: E, listener: TileJsonPluginEventMap[E]): void
```

プラグインの[イベント](#イベント)を購読・1 回だけ購読・購読解除します。ペイロードは [`loaded`](#イベント) を参照してください。

### dispose()

```typescript
dispose(): void
```

このプラグインが `view.attribution` に追加したクレジットを（HTML による構造的マッチで）取り除き、すべてのイベントリスナーを解除します。組み込み UI はプラグインではなくビューが所有するため、削除されるのはこのプラグインが追加したクレジットのみで、UI 全体ではありません。ビューが先に破棄された場合、`view.attribution` は既に存在せず、この処理は何もしません。

## イベント

[`on`](#on--once--off) / `once` で購読し、`off` で購読解除します。

### loaded

`addSource()` が成功するたびに、ソースの登録後に 1 度発火します。ペイロードにより、組み込み UI に頼らず独自のクレジット UI を駆動できます。

| プロパティ    | 型                    | 説明                                                         |
| ------------- | --------------------- | ------------------------------------------------------------ |
| `source`      | `Source`              | ドキュメントに対して作成された Navara ソース。               |
| `tilejson`    | `TileJson`            | 取得・検証済みの TileJSON ドキュメント。                     |
| `attribution` | `string \| undefined` | ドキュメントが `attribution` を宣言している場合、その HTML。 |

```typescript
const view = new ThreeView({ container, defaultAttribution: false });
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);
await view.init();

tilejson.on("loaded", ({ source, attribution }) => {
  if (attribution) renderMyCredit(source.id, attribution);
});
```

## 型

### TileJsonSourceType

```typescript
type TileJsonSourceType = "raster-tile" | "vector-tile";
```

TileJSON ドキュメントをどの Navara ソースタイプとして具体化するか。TileJSON にはラスター画像とベクトルタイルを確実に見分けるフィールドがないため、呼び出し側が指定します。

### TileJsonSourceDescription

| プロパティ | 型                    | 説明                                                                                                                                            |
| ---------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`     | `TileJsonSourceType`  | 作成する Navara ソースタイプ（`addSource` と同様）。                                                                                            |
| `url`      | `string`              | 取得・展開する TileJSON 3.0.0 ドキュメントの URL（タイルテンプレートではありません）。                                                          |
| `id`       | `string \| undefined` | 任意の呼び出し側指定ソース ID。返されたハンドルを保持せずに id でレイヤーからソースを参照するのに便利です。省略した場合はエンジンが生成します。 |

### TileJsonLoadedEvent

[`loaded`](#loaded) イベントのペイロード。上記の表を参照してください。

### TileJson

このプラグインが利用する TileJSON 3.0.0 ドキュメントの部分集合です。その他の仕様フィールド（`bounds`、`center`、`grids` など）は無視されます。

| プロパティ    | 型                    | デフォルト | 説明                                                                                          |
| ------------- | --------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `tilejson`    | `string`              | —          | ドキュメントが準拠する TileJSON 仕様の semver（例: `"3.0.0"`）。必須です。                    |
| `tiles`       | `string[]`            | —          | タイル URL テンプレート（`{z}/{x}/{y}`）。仕様上、必須かつ空でない配列です。                  |
| `attribution` | `string \| undefined` | —          | ビュー組み込みのアトリビューション UI を通じて表示されるアトリビューション／クレジット HTML。 |
| `minzoom`     | `number \| undefined` | `0`        | 最小ズームレベル。ラスターソースにのみ適用されます。                                          |
| `maxzoom`     | `number \| undefined` | `30`       | 最大ズームレベル。                                                                            |
| `scheme`      | `"xyz" \| "tms"`      | `"xyz"`    | タイルスキーム。`"tms"` は Y 軸を反転します（ラスターソースのみ）。                           |

ドキュメントは取得時に検証されます。`tilejson` が欠けている、または `major.minor.patch` 形式のバージョンでない場合、あるいは `tiles` が欠けている、または空の場合、`addSource()` は失敗します。

## 補足

- **タイルテンプレートではなくドキュメントの URL。** `desc.url` は TileJSON JSON ドキュメントのアドレスです。タイル URL テンプレートはドキュメントの `tiles` フィールドから得られます。ここに `{z}/{x}/{y}` テンプレートを渡さないでください。
- **ソースの `type` は指定が必要。** TileJSON はタイルセットがラスターかベクトルかを示さないため、ドキュメントが配信するタイルに合わせて `"raster-tile"` または `"vector-tile"` を選んでください。
- **ベクトルソースは `minzoom` と `scheme` を無視します。** エンジンのベクトルタイルソースには `minZoom` や `tms` フィールドがないため、`"vector-tile"` では `maxzoom` のみが引き継がれます。

## 関連リソース

- [AttributionPlugin](../../three/plugins/attributionplugin/) — `view.attribution` で参照できる組み込みのアトリビューション（クレジット）UI。このプラグインが既定で供給します
- [About three_plugins](../about/) — パッケージ概要
- [Raster Layer](../../three/layer/raster-layer/) — Raster レイヤーのリファレンス

