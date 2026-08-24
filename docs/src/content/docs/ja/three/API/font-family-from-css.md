---
title: Font Family from CSS
description: CSS の @font-face ルールからフォントファミリを構築する API リファレンス
sidebar:
  order: 1020
---

これらのユーティリティは、CSS の `@font-face` ルールから `FontFamily`（[`addFontFamily()`](../../../three/api/threeview-functions/#addfontfamily) を参照）を構築します。フェイスと Unicode 範囲を手書きする必要はありません。各 `@font-face` ブロックが 1 つのフェイスになり、その `src` URL と `unicode-range` が取り込まれます。フォントファイルの遅延ダウンロードは維持されます: 事前に取得されるのはスタイルシートだけで、各フェイスのファイルはラベルがそのコードポイントを最初に必要としたときにダウンロードされます。

[Google Fonts CSS API](https://developers.google.com/fonts/docs/css2)、セルフホストのスタイルシート、CDN 上のフォントパッケージなど、`unicode-range` 付きの `@font-face` ルールを宣言するあらゆるスタイルシートで利用できます。

## Basic Usage

```typescript
import ThreeView, { fetchFontFamilyFromCss } from "@navaramap/three";

const view = new ThreeView({ container: element });
await view.init();

view.addFontFamily(
  await fetchFontFamilyFromCss(
    "MapFont",
    "https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Noto+Sans+JP:wght@800",
  ),
);

// その後、テキストレイヤのマテリアルで:
// text: { font: "MapFont" }
```

## フェイスの優先順位

各コードポイントには、Unicode 範囲にそのコードポイントを含む最初のフェイスが使用されるため、フェイスの並び順が重要です。パース結果のフェイスは CSS のセマンティクスに従います: Unicode 範囲が重複する場合は後に定義された `@font-face` ルールが優先されるため、フェイスはスタイルシートの逆順に並びます。スタイルシートはこの挙動を前提としています。たとえば Google Fonts の `latin-ext` ブロックは、後に宣言される `latin` ファイルにしか存在しないコードポイントを含む広い範囲を宣言しています。

ファミリをまたぐ優先順位を制御するには、`fontFamily` オプションにファミリ名の配列を渡します。フェイスは配列内のファミリの位置順に並べ替えられます。これは、リクエスト順に関係なく `@font-face` ブロックをアルファベット順に並べる Google Fonts CSS API のようなスタイルシートで重要です:

```typescript
const family = await fetchFontFamilyFromCss("MapFont", cssUrl, {
  // 優先順位: CJK サブセット間で共有されるコードポイントは JP が優先。
  fontFamily: ["Archivo", "Noto Sans JP", "Noto Sans SC", "Noto Sans KR"],
});
```

:::note
スタイルシートによっては、フォントファイルが完全にはカバーしていない Unicode 範囲を宣言していることがあります（サブセットごとに共有される定型的な範囲など）。グリフを持たないフェイスにルーティングされたコードポイントは豆腐（□）として描画されます。その場合は、そのコードポイントを実際に含むフォントのファミリを `fontFamily` 配列で先に並べてください。
:::

## Functions

### fetchFontFamilyFromCss()

1 つ以上のスタイルシートを取得し、その `@font-face` ルールから `FontFamily` を構築します。相対的な `src` URL は（リダイレクト後の）スタイルシート URL を基準に解決されます。

**Syntax:**

```typescript
fetchFontFamilyFromCss(
  family: string,
  cssUrl: string | string[],
  options?: FetchCssFontFamilyOptions,
): Promise<FontFamily>
```

**Parameters:**

- `family`: フェイスを登録するファミリ名。`material.font` から参照されます。
- `cssUrl`: 取得するスタイルシートの URL。複数指定した場合、フェイスの優先順位は URL の順、次に各スタイルシート内のブロック順に従います。
- `options`: 任意の[ブロックフィルタ](#cssfontfacefilter-type)と `requestInit`（プライベートなフォントホストの認証情報など、追加の `fetch` オプション）。

**Returns:**

パースされた `FontFamily` を解決する Promise。

**Example:**

```typescript
import { fetchFontFamilyFromCss } from "@navaramap/three";

// セルフホストのスタイルシートとフォントパッケージ付属のスタイルシートを結合。
const family = await fetchFontFamilyFromCss("CityWithEmoji", [
  "/fonts/world-cities.css",
  "https://cdn.jsdelivr.net/npm/@infolektuell/noto-color-emoji@0.2.0/index.css",
]);
view.addFontFamily(family);
```

### parseFontFamilyFromCss()

スタイルシートのテキストから `FontFamily` を構築します。CSS がインライン化されている場合や別途取得済みの場合に使用します。フィルタに一致する `@font-face` ルールがない場合は例外を投げます。

**Syntax:**

```typescript
parseFontFamilyFromCss(
  family: string,
  cssText: string,
  options?: ParseCssFontFamilyOptions,
): Promise<FontFamily>
```

**Parameters:**

- `family`: フェイスを登録するファミリ名。
- `cssText`: `@font-face` ルールを含むスタイルシートのテキスト。
- `options`: 任意の[ブロックフィルタ](#cssfontfacefilter-type)と `baseUrl`（相対的な `src: url(...)` 参照の解決に使うベース URL）。

**Returns:**

パースされた `FontFamily` に解決される Promise。パース処理は WebAssembly で実行されるため、初回使用時にモジュールが初期化されます。

**Example:**

```typescript
import { parseFontFamilyFromCss } from "@navaramap/three";

const family = await parseFontFamilyFromCss(
  "MapFont",
  `@font-face {
    font-family: "Latin";
    src: url(./fonts/latin.woff2) format("woff2");
    unicode-range: U+0000-00FF, U+0131;
  }`,
  { baseUrl: "https://example.com/styles/fonts.css" },
);
```

### parseCssUnicodeRange()

CSS の `unicode-range` ディスクリプタ値を、両端を含むコードポイント範囲にパースします。単一コードポイント（`U+26`）、区間（`U+0102-0103`）、ワイルドカード（`U+4??`）をサポートします。不正なトークンには例外を投げます。

**Syntax:**

```typescript
parseCssUnicodeRange(value: string): Promise<UnicodeRange[]>
```

**Parameters:**

- `value`: `unicode-range` ディスクリプタ値。例: `"U+0-7F, U+131, U+4??"`。

**Returns:**

`{ from, to }` コードポイント範囲（両端を含む）の配列に解決される Promise。

**Example:**

```typescript
import { parseCssUnicodeRange } from "@navaramap/three";

await parseCssUnicodeRange("U+0102-0103, U+20AB");
// [{ from: 0x0102, to: 0x0103 }, { from: 0x20ab, to: 0x20ab }]
```

## CssFontFaceFilter Type

スタイルシートのどの `@font-face` ブロックをフェイスにするかを選択するフィルタです。両方の関数で利用できます。

- `fontFamily`: `font-family` が一致するブロックのみを含めます（引用符は除去、大文字小文字は区別しません）。配列で指定した場合はフェイスの優先順位も設定します（[フェイスの優先順位](#フェイスの優先順位)を参照）。
- `fontWeight`: `font-weight` が一致するブロックのみを含めます。例: `800`、`"100 900"`。
- `fontStyle`: `font-style` が一致するブロックのみを含めます。例: `"normal"`、`"italic"`。

```typescript
type CssFontFaceFilter = {
  fontFamily?: string | string[];
  fontWeight?: string | number;
  fontStyle?: string;
};

type ParseCssFontFamilyOptions = CssFontFaceFilter & { baseUrl?: string };

type FetchCssFontFamilyOptions = CssFontFaceFilter & {
  requestInit?: RequestInit;
};
```
