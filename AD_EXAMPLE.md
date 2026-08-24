# AD_EXAMPLE_IDEA — Example 整理方針（テキスト設計）

> Art Director 視点で、`web/navara_three/example` を「一目で意図が伝わる」example 群へ再設計するための **テキストベースの設計書** です。実装（ファイル移動・コード変更）はまだ行いません。まずこの分類・命名・引き算の方針に合意を取ることが目的です。
>
> **セクション 5 以降の構造案は、既存 example を踏襲せず、原則から「一から作り直す」つもりで設計しています。** 既存ページはあくまで「素材」であって、理想形の制約にはしません。
>
> 参照: `docs/`（`three/Resource Layer`, `three_default_descs/Mesh|Effect|Light Desc`, `three_plugins`, `three/API`, `three/Tutorial`）

---

## 1. 現状の課題（なぜ整理するか）

現状の example は **debug のために作られた**ため、次の問題を抱えています。

- **1 ページに複数機能が混在**していて、サムネイルやページを見ても「何を説明している example なのか」が分からない。コードを精読しないと意図がつかめない。
- **デザインに一貫性がない**（カメラ位置・データ・UI・ライティングがページごとにバラバラ）ので、ギャラリーとして目を惹かない。
- **同じ機能の debug 派生が大量にある**（例: `selective-bloom-effect/*` と `selective-outline-effect/*` がジオメトリ種別ごとに各 10 ページ）。ユーザー向けには冗長で、ギャラリーを薄める。
- **カテゴリが実質フラット**。`vite.config.example.ts` はディレクトリ第 1 階層をカテゴリにするだけなので、大半が `uncategorized` に落ちている。

---

## 2. 整理の原則（Art Director の判断基準）

ユーザーにとってのわかりやすさ = **1 example 1 機能**。これを絶対の軸にします。

1. **1 example = 1 機能に絞る（混ぜない）。** その example を開いた人が「これは○○の説明だ」と 1 秒で言い切れること。
2. **引き算する。** 説明したい機能に関係ない要素（余計なレイヤー、無関係なエフェクト、装飾）はすべて削る。ベースシーン（地図＋地形＋空）は "機能を美しく見せるための最小限の額縁" に留める。
3. **必要最小限の組み合わせは OK。ただし主役を明示する。** ある 1 機能を成立させるために不可欠な要素（instancing の対象、update() の対象レイヤなど）は載せてよいが、「これは何の機能の example か」がタイトル・説明・UI から即座に分かること。主役が霞むなら、それは混ぜすぎ。分割する。
4. **全機能を 1 つずつ網羅する。** API に存在する機能（Resource Layer / Mesh / Effect / Light / Plugin / Camera）は、原則それぞれ独立した feature example を 1 つ持つ。「機能一覧 = example 一覧」になるのが理想。
5. **ギャラリーは Feature Example だけ。** 複数機能を盛った "作品（Showcase / Use Case）" や、マップと無関係なツールはギャラリーに置かない。網羅テスト用の debug 派生も非公開（開発者用に残すだけ）。

> 飛行機の Use Case はこの原則の象徴（＝反面教師）。あれは アークライン＋グロー＋ブルーム＋夜景 を 1 ページに盛った混在物なので、そのままでは example にしない。**「アークを描く」機能**（`ArclineMeshDesc`）と **「線を光らせる」機能**（`SelectiveBloomEffectDesc`）に**分解し、それぞれ独立した Feature Example** として単体で用意する。1 つの美しい合成シーンではなく、1 つ 1 つの機能が主役の example に還元するのがこの整理の狙い。

---

## 3. 機能タクソノミー（＝ example の骨格）

docs から抽出した「Navara Three に存在する機能」の全体像。**この一覧がそのまま Feature Example の候補一覧**になります。

### Resource Layer（`view.addLayer`） — 地理データの表示

| データ形式            | 使える Material（役割）                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `tiles`（ラスタ）     | rasterTile, elevationHeatmap                                                                             |
| `mvt`（ベクタタイル） | point, billboard, text, polyline, polygon, vectorTile                                                    |
| `geojson`             | point, billboard, text（Font API）, polyline, polygon（※`model` は未サポート → 3D モデル配置は Mesh で） |
| `cesium3dtiles`       | model（b3dm / pnts / 3D Tiles 1.1）                                                                      |
| `terrain`             | rasterTerrain, quantizedMesh, hillshade                                                                  |
| データソース特殊系    | pmtiles（MVT/ラスタ payload）, maplibre style（※実装中・将来対応）                                       |

### Mesh Desc（`view.addMesh`） — シーンへの 3D オブジェクト配置

- プリミティブ: Box / Sphere / Cylinder / Plane / Tube
- Instanced: InstancedBox / Sphere / Cylinder / Plane / GltfModel（1 draw call で大量描画）
- モデル: GLTFModel（静的 / アニメーション）
- 線: **ArclineMesh（アーク線）** / SmoothLineMesh（Catmull-Rom）
- 大気・天体: Sky / SkyBox / Stars / **GlowGlobeMesh（地球のフレネルグロー）**
- パーティクル: Rain / Snow
- 特殊: **SplatMesh（3D Gaussian Splat）**
- Helper（debug）: Axes / Arrow

### Effect Desc（`view.addEffect`） — ポストプロセス

Clouds（雲・霧） / **ColorGradingLUT** / DepthOfField / **RainDrop（レンズの雨滴）** / **SSR（水面反射）** / SSAO / **SelectiveBloom（発光）** / **SelectiveOutline（輪郭）** / AerialPerspective / FogLight / LensFlare / ToneMapping / FXAA / SMAA / SkyEnvMap（core） / Custom

### Light Desc（`view.addLight`） — ライティング

Ambient / **SunLight** / **LightProbe（IBL）** / SkyLightProbe

### Atmosphere / Camera / Plugin / API

- Atmosphere: `DefaultPlugin.addDefaultPhotorealScene()`（空・星・太陽光・大気を一括追加）、太陽方向・時刻・日付、`atmosphere.setDateFromCameraAt()`（都市の地方太陽時に自動同期）、`getMoonDirection()`
- Camera: `setCamera` / `flyTo` / 追従・シネマティック
- Plugin: **AttributionPlugin / OverlayPlugin / PersonViewPlugin / CesiumIonPlugin**（MapLibreStylePlugin は実装中・将来対応）
- API: FeatureEvaluator（データ駆動スタイリング）、`update()`（部分更新）、dispose ライフサイクル、WASM ジオメトリ API（※flat / 2D 投影は未対応）

---

## 4. 現状 example の棚卸し（single か mix か）

理想形を作るための「素材の在庫確認」。踏襲はしないが、どの素材が使えるかを把握しておく。

- **すでに 1 機能でクリーン（素材として良質）:** `styling/*`（15）, `terrain/hillshade|hillshade-flat|elevation-heatmap|quantized-mesh`, `cloud-fog`, `color-grading-lut`, `depth-of-field-effect`, `rainDropEffect`, `globe-glow`, `splat`, `point-cloud`, `photoreal-tiles`, `pmtiles`, `multiple-tiles`, `gltf-animation`, `draped-meshes`, `debug/dispose`, `mesh-layers/custom-pickable`, `plugins/attribution`, `custom-effect`
- **複数機能が混在（分解して素材を取り出す）:** `atmosphere`, `sky-box`, `night`, `weather`, `camera-studio`, `line`, `flat`, `globe`, `instanced-sprites`, `partial-update`, `wasm-api`, `water-reflection`, `shadows`, `selective-bloom-effect/*`(10), `selective-outline-effect/*`(10), `use-cases/*`(3), `showcases/photoreal`
- **機能 example ではない:** `index`（ランチャー）, `sh-generator`（Tool）, `debug/*`（開発用）

---

## 5. 理想の Example ギャラリー（10 セクション構成）

**設計思想:** 入口の **Getting Started** は、各項目を**単一 example**で構成した短い導線（地図を出す → レイヤーを扱う → メッシュを足す → ソースを扱う → カメラを動かす）。そこから機能カタログ（**2D → 2.5D → 3D → ベースマップ → 地形 → ソース → スタイリング → インタラクション・UI → ライティング・エフェクト**）へ広げる。各 Feature Example は「その機能が最も美しく見える 1 カット」を Art Director が具体的に指定する。

**表示セクションはディレクトリと分離する（`examples/sections.ts`）。** 各 example は隣接する `meta.ts` の `section` で表示セクションが決まり、`group` でセクション内のサブグループに分かれる。よって**ディレクトリ名（`gis/*`, `mesh/*`, `effect/*` …）は機能ベースのまま**にし、表示上のカテゴリだけを付け替える。例: `gis/*` は 2D/2.5D に、`mesh/*` は 3D に、`weather/*`・`effect/*` は「ライティング・エフェクト」に畳む。Getting Started には各機能への入口となる単一 example だけを置く。

表示セクション（`SECTION_KEYS` 順）:

1. **Getting Started**（`getting-started`）— 単一 example の導線
2. **2D**（`2d`）
3. **2.5D**（`2.5d`）
4. **3D**（`3d`）
5. **ベースマップ**（`basemap`）
6. **地形**（`terrain`）
7. **ソース**（`source`）
8. **スタイリング**（`styling`）
9. **インタラクション・UI**（`interaction`）
10. **ライティング・エフェクト**（`lighting-effect`）

> ※ 現状の `sections.ts` は `2d` / `2.5d` / `3d` セクションを持たないため、実装時に `SECTION_KEYS` と `SECTION_LABELS` に追加する（`gis/*` は `2d` / `2.5d`、`mesh/*` は `3d` を各 `meta.ts` の `section` に設定）。

各表の列の意味:

- **example** — ディレクトリパス（機能ベース。表示セクションは `meta.ts` の `section` で決まる）。
- **目的** — その 1 機能で「何ができるようになるか」「Navara の何が伝わるか」。
- **ビジュアルコンセプト** — 舞台（場所）／時間帯・光／カメラ構図／操作したときに**目に見えて変わるもの**を具体的に。サムネイルもこの 1 カットで撮る。
- **API** — 主役となる呼び出し。

### 決定事項・トレードオフ（レビュー反映）

- **合成ショーケースは作らない（ユーザー方針）。** レビューでは「純粋な機能羅列は平板で、Navara の差別化が土台系（ラスタ地図・地形など他エンジンでも出来る系）に埋もれる」という指摘があった。だが Showcase / Use Case は置かない方針なので、合成作品は追加しない。
- **網羅（原則#4）と引き算（原則#2）が衝突したら、公開ギャラリーでは "curation（差別化・美しさ）" を優先する。** 全機能の総当たり網羅は非公開の debug セットに置き、公開ギャラリーは "作品集" として厳選する。

---

### 0. Getting Started — はじめの導線（単一 example）

初見ユーザーが「地図を出す → レイヤーを扱う → メッシュを足す → ソースを扱う → カメラを動かす」を最短で辿れる学習導線。**各項目は 1 example**。各機能の作り込んだ example は 2D / 2.5D / 3D / ソース などの専用セクションに置き、ここは "入口" に徹する。

| example                       | 目的                                                                                                                | ビジュアルコンセプト                                                                                                                                                             | API                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `getting-started/hello-world` | HTML に地図を表示する最短コード（コピペで動く）を示す                                                                | 衛星写真ベースのグローブが 1 枚。UI もプラグインもない、最小の出発点                                                                                                            | `addSource(raster)` + `addLayer`                           |
| `getting-started/layers`      | **1 レイヤー完結**で、複数ジオメトリ（点・線・面・押し出し）を持つ GeoJSON を追加・更新・削除するライフサイクルを示す | **1 画面に点・ポリライン・ポリゴン・押し出しポリゴン（2.5D）を同時表示**。ボタンで一括「追加 → スタイル更新 → 削除」。1 個の GeoJSON（複数ジオメトリ）＝ 1 レイヤーにまとめて操作 | `addSource(geojson)` + `addLayer` / `updateLayer` / `removeLayer` |
| `getting-started/add-mesh`    | シーンに 3D メッシュを 1 つ追加する最短経路を示す（`addMesh` の入口）                                                | 地図上のランドマークに箱を 1 つ置くだけ。太陽光で陰影が付く。作り込みは 3D セクション                                                                                           | `addMesh(box)`                                             |
| `getting-started/source`      | データソースの追加・更新を示し、**Source と Layer の分離**を掴ませる                                                 | 1 個のソースを `addSource` → Layer で描画。ソースの URL/データを差し替えると表示が更新される。形式ごとの詳細は ソース セクション                                                | `addSource` / `updateSource` + `addLayer`                  |
| `camera/control`              | 緯度経度・高度・方位・ピッチで視点を厳密に置ける／`flyTo` で映画的に移動できることを示す（カメラの基本）              | 東京タワー上空から `flyTo` でパリのエッフェル塔へ、地球の丸みをかすめながら数秒で滑空。ボタンで世界の名所プリセットへ飛ぶ                                                       | `setCamera({lng,lat,height,heading,pitch})` / `flyTo` / `lookAt` |

### 1. 2D — ポイント・ポリライン・ポリゴン

**方針:** 各マテリアルを **1 機能ずつ**、シンプルな GeoJSON（固定スタイル）で見せる。属性でスタイルを動かす話は スタイリング/式 に分離。ベースは無彩色に寄せ、データの色だけを主役に。

| example              | 目的                                                                 | ビジュアルコンセプト                                                                                                       | API                                 |
| -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `gis/point`          | 点シンボルを固定スタイル（色・サイズ・形）で描く                     | 灰色の地図に均一な点がくっきり乗る。ニュージーランドの山にポイントを置く。`https://papers.reearth.land/styles/white/tilejson.json`を使用                                                | `addLayer(geojson, point)`          |
| `gis/polyline`       | 線を固定スタイル（色・幅・破線）で描く                               | ベネツィアの水路を一定の色・太さのラインで。`https://papers.reearth.land/styles/white/tilejson.json`を使用                                                                        | `addLayer(geojson, polyline)`       |
| `gis/polygon` | globe.geojsonをclampToGroundで貼り付ける               | ベースマップはなしで、ポリゴンだけで地球儀を見せる |
| `gis/billboard`      | 点にアイコン画像（ビルボード）を立てる                               | エベレストにmarker icon(web/navara_three/example/public/example.png)を立てる。マーカーの色が微妙なら調整する。ベースマップ=`https://papers.reearth.land/styles/white/tilejson.json`                                        | `addLayer(geojson, billboard)`      |
| `gis/text`      | 点にテキストを立てる                               | エベレストにテキストを置く(英語)。font=`https://fonts.google.com/specimen/Arsenal?query=Arsenal`, ベースマップ=`https://papers.reearth.land/styles/white/tilejson.json`                                        | `addLayer(geojson, billboard)`      |

### 2. 2.5D — 押し出しポリゴン

| example                | 目的                                              | ビジュアルコンセプト                                       | API                                   |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `gis/extruded-polygon` | ポリゴンを固定高さで 3D 押し出し | エベレストに山小屋を1つ表示。ベースマップ=`https://papers.reearth.land/styles/white/tilejson.json`      | `addLayer(geojson, polygon extruded)` |

### 3. 3D — シーンに 3D オブジェクトを置く

| example               | 目的                                                                                                                                                            | ビジュアルコンセプト                                                                                                                                                  | API                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `mesh/gltf-model`     | 実寸の glTF モデルを地図上の座標にピン留めできることを示す                                                                                                      | ランドマーク広場に精緻な 1 体（彫像や車両）を実寸配置。周囲を回り込んで質感を見せる                                                                                   | `addMesh(GLTFModel)`                       |
| `mesh/gltf-animation` | glTF のアニメーションクリップを再生できることを示す                                                                                                             | 山あいで 1 体のキャラクターが歩行モーション。クリップ切替で動きが変わる。モデル=https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Fox/README.md, ベースマップ=`https://papers.reearth.land/styles/white/tilejson.json`                                                                                  | `addMesh(GLTFModel)` + clips               |
| `mesh/instanced`    | 同一メッシュを 1 draw call で **10⁵〜10⁶ 個**描く GPU インスタンシングの性能を示す                                          | 都市全域にたくさんのモデルが敷き詰められ、画面隅に **FPS＋インスタンス数のライブ表示**。それを保ったまま滑らかに周回。モデル=https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Lantern/README.md, ベースマップ=`https://papers.reearth.land/styles/black/tilejson.json`                                       | `addMesh(InstancedBox/GltfModel …)`        |
| `mesh/arcline`      | **2 地点を結ぶアーク（大圏）線を描く**機能そのものを示す                                                                                                        | 夜の地球を俯瞰し、羽田/成田発国際線の複数アークが放物線を描いて各空港へ伸びる。グラデーション・破線・太さを調整。basemap=`https://papers.reearth.land/blackmarble/tilejson.json` | `addMesh(ArclineMesh)`                     |
| `mesh/smoothline`     | 制御点を Catmull-Rom で滑らかに繋ぐ曲線を示す                                                                                                                   | 蛇行する登山ルートを、折れ線ではなく滑らかな帯として地形上に敷く(アニメーションで見せれるとなお良し)。basemap=`https://papers.reearth.land/viewer/?id=protomaps-white#0.75/0/57.8`                                                                  | `addMesh(SmoothLineMesh)`                  |
| `mesh/glow-globe`     | 地球外周のフレネルグロー（大気の光輪）を示す                                                                                                                    | 宇宙背景で地球のリムに沿って青い光輪。ベースマップ=`https://papers.reearth.land/styles/black/tilejson.json`                                                                                        | `addMesh(GlowGlobeMesh)`                   |
| `mesh/splat`        | 3D Gaussian Splat アセットを表示できることを示す（他の web 地図ではまず見ない差別化点）                                                                         | モデル=Sunny Meadow.sog, basemap=https://papers.reearth.land/s2cloudless_2016/tilejson.json                                                                                                                           | `addMesh(SplatMesh)`                       |
| `mesh/custom`         | **自作の MeshDesc**（独自ジオメトリ＋シェーダマテリアル）をシーンに持ち込めることを示す（拡張性）。※`api/custom-desc`（エンジン拡張の仕組み）の具体的な mesh 版 | `web/navara_three/example/pages/custom-shader/run.ts`と同じようにMarchingCubeを追加。影も出す。雲や大気は不要。basemap=`https://papers.reearth.land/styles/papers-light/tilejson.json`                                                      | `registerMesh(custom)` + `addMesh(custom)` |

### 4. ベースマップ — 地図データを敷く（土台のバリエーション）

#### ラスタ／ベクタタイル

| example                      | 目的                                                                                | ビジュアルコンセプト                                                                                   | API                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `basemap/raster-tiles`       | 標準的な XYZ ラスタタイルを 1 枚敷く最短ルート                                       | basemap=`https://papers.reearth.land/bluemarble/tilejson.json`                                          | `addLayer(tiles)`                                   |
| `basemap/vector-map`         | ベクタタイル（MVT）でズームしても輪郭が甘くならないことを示す                        | エジプトのカイロ・ナイル川を斜めから見下ろし、道路・水系・区画が細い実線でシャープに描かれ、ズームインしてもエッジが保たれる. vector=`https://papers.reearth.land/protomaps/tilejson.json` | `addLayer(mvt, vectorTile)`                         |
| `basemap/raster-overlay`     | ラスタ地図の上に半透明のラスタオーバーレイを重ねられることを示す | basemap=`https://papers.reearth.land/bluemarble/tilejson.json`に`url: "https://assets.cms.reearth.io/assets/11/ea0a6a-a94f-47e0-a163-4c675261a1f6/blue-marble-clouds/{z}/{x}/{y}.webp", attribution: "NASA Blue Marble Clouds(Converted as raster tiles)"`を重ねる         | `addLayer(tiles)` ×2（下地＋オーバーレイ） |

#### PMTiles

| example                      | 目的                                                                                                            | ビジュアルコンセプト                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | API                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `basemap/pmtiles`(WP)        | 単一 `.pmtiles` アーカイブ 1 個から街全体を配信できる手軽さを示す                                                | Overture Maps の PMTiles を読み込み、世界の街（例: ロンドン中心部）を低めの俯瞰で。建物・道路・区画を表示。**メモ:** PMTiles（MVT）は多数のレイヤをスタイリングする必要があり、生の `addLayer` で手書きするより **`style.json` で一括指定するのが自然**。よって **`MapLibreStylePlugin` の完成を待ち、`style.json` を使った PMTiles example にするのが理想**（それまでは暫定実装）。完成後は `basemap/pmtiles` と `basemap/maplibre-style` を統合し、「Overture PMTiles × MapLibre `style.json`」の 1 example にまとめてもよい。 | `addLayer(mvt, pmtiles source)`                   |
| `basemap/maplibre-style`(WP) | 既存の MapLibre スタイル JSON をそのまま流用できる互換性を示す（＝`MapLibreStylePlugin` の公式 example を兼ねる） | 見慣れた MapLibre 配色の地図が、そのスタイル定義のまま 3D 地球上に載る                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `MapLibreStylePlugin`（`@navaramap/maplibre_style`） |

#### Google

| example                | 目的                                                        | ビジュアルコンセプト                                                                            | API                                     |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| `tiles-3d/google-photoreal-tiles` | Google フォトリアル 3D Tiles を表示する | モン・サン・ミシェルを中心に表示。defaultPhotorealSceneを追加                | `addLayer(cesium3dtiles)`（要 API key） |

### 5. 地形 — 地形で起伏を出す

| example                     | サブ分類            | 目的                                                                                                                                             | ビジュアルコンセプト                                                                                                                                             | API                                                   |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `terrain/raster`          | terrarium / mapbox-rgb | ラスタ標高タイルを地形・ヒルシェードとして表示する                       | アルプス山脈を地形の陰影が綺麗に見えるように表示。basemap=https://papers.reearth.land/styles/papers-light/tilejson.json | `addLayer(terrain, rasterTerrain)`（法線強度 / 誇張） |
| `terrain/hillshade`         | hillshade           | ヒルシェードを表示する | `terrain/raster`と同じ位置を真上から見て、起伏だけを見せる | `addLayer(terrain, hillshade)`（flat / 太陽方位）     |
| `terrain/elevation-heatmap` | 地形強調            | 標高を色で定量的に見せるヒートマップを示す                                                                                                        | 山地を真俯瞰。**Turbo グラデーション**（青→緑→黄→赤）で標高が段階的に色分けされ、谷筋・尾根の高低が一目で読める。 南アルプス全体が見えるように引きで映す。map=https://terrain.reearth.land/terrarium/elevation/{z}/{x}/{y}.png"                                                   | `addLayer(tiles, elevationHeatmap)`（Turbo colormap） |
| `terrain/quantized-mesh`    | quantized-mesh      | quantized-mesh 形式の地形と watermask を示す。                  | マレーシアのトレンガヌ周辺をwatermask により湖が陸と区別され、水面だけ滑らか＆反射的に、陸は地形として描き分けられる。太陽は反射が見える角度に。basemap=`TILE_DATASETS.eox`をURLとattributionを直接コピーして利用                                              | `addLayer(terrain, quantizedMesh)`（watermask）       |

### 6. ソース — データを読み込む（形式ごと）

**方針:** Getting Started の `source` が「Source と Layer の分離」を掴ませる入口なのに対し、ここは「その**データ形式をソースとして読み込む**最短経路」を形式ごとに単体で見せる。GeoJSON / MVT は「単一のデータを読み込んで表示するだけ」に絞る。

#### GeoJSON

| example          | 目的                                                                             | ビジュアルコンセプト                                                                                     | API                          |
| ---------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `source/geojson` | 単一の GeoJSON データソースを読み込んで表示する最短経路を示す（ソースとしての GeoJSON） | 1 個の GeoJSON（例: 行政界や POI）を `addSource` で読み込み、そのまま地図に載せる。データを差し替えると表示が変わる | `addSource(geojson)` + `addLayer` |

#### MVT

| example      | 目的                                                          | ビジュアルコンセプト                                                                                                    | API                          |
| ------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `source/mvt` | 単一の MVT（ベクタタイル）データソースを読み込んで表示する最短経路を示す | 1 個の MVT ソースを `addSource` で読み込みレイヤとして描画。※見た目の作り込みは `basemap/vector-map`、スタイル一括指定は `basemap/pmtiles` | `addSource(mvt)` + `addLayer` |

#### 3D Tiles

| example                | 目的                                                                     | ビジュアルコンセプト                                                                                            | API                              |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `tiles-3d/buildings`   | PLATEAU など Cesium 3D Tiles（b3dm）の都市モデルを軽快に扱えることを示す | 東京駅を丸の内ビルあたりから斜め上から注視する。setCameraとdistanceを使い東京駅を見るようにする。データは`TILES_3D_DATASETS`から`plateauChiyoda`と`plateauChuo`のURLとAttributionをコピーして設定して表示。ReEarth quantized terrainを指定。normalなどは不要。basemap=https://papers.reearth.land/styles/papers-light/tilejson.json | `addLayer(cesium3dtiles, model)` |
| `tiles-3d/point-cloud` | 点群（pnts）をそのまま描画できることを示す                               | `TILES_3D_DATASETS`から`plateauKakegawaCastle`をコピーして設定。ReEarth quantized terrainを指定。normalなどは不要。basemap=https://papers.reearth.land/styles/papers-light/tilejson.json          | `addLayer(cesium3dtiles, pnts)`  |

### 7. スタイリング — 見た目を作る

#### テキスト

| example            | 目的                                                                                                                                  | ビジュアルコンセプト                                                                                                                          | API                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `evaluator/text`      | 点にテキストラベルを描き、**Navara の Font API** を示す。Google Fonts を 自動で読み込む。                               | 海洋の名前を白文字、黒アウトラインの文字で示す(英語)。font=`https://fonts.google.com/specimen/Arsenal?query=Arsenal`, ベースマップ=`https://papers.reearth.land/oceanbottom/tilejson.json`                                        | `addLayer(geojson, billboard)`      |

> ※ color-emoji / 複数フォントフェイスは `gis/label-font` 内のバリエーションに寄せる。

#### 式（データ駆動スタイリング）

**主役は `FeatureEvaluator`**（＝フィーチャの属性値から、その場で色・表示可否を計算するコールバック）。Navara の GIS 表現力の核。「**同じデータを値によって塗り分ける／絞り込む**」ことを見せる。題材は建物（3D Tiles）に統一。

| example             | 目的                                                          | ビジュアルコンセプト                                                   | API                                            |
| ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| `evaluator/color` | 建物を**属性に応じて色分け**できることを示す                  | 都市の建物群を用途高さ属性で色分け. data=`TILES_3D_DATASETS.plateauChiyodaのURLやattributeをコピーして埋め込み`, basemap=https://papers.reearth.land/styles/papers-light/tilejson.json, 色は`ORANGES_COLOR_MAP`と同じものを再定義し使用。             | `cesium3dtiles` + `FeatureEvaluator`           |
| `evaluator/filter`  | 建物を**属性に応じてフィルタ**（表示/非表示）できることを示す | 条件に合う建物だけが残り、しきい値スライダを動かすと即座に絞り込まれる。高さで絞り込み, data=`TILES_3D_DATASETS.plateauChiyodaのURLやattributeをコピーして埋め込み`, basemap=https://papers.reearth.land/styles/papers-light/tilejson.json | `cesium3dtiles` + `FeatureEvaluator`（filter） |

### 8. インタラクション・UI — 操作・情報表示・拡張

#### カメラ

| example                   | 目的                                                                                                                 | ビジュアルコンセプト                                                                                                                       | API                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `camera/controls-options` | カメラ操作の**制御・制約**をチューニングできることを示す（ズーム範囲の制限、回転/ズーム/チルトの有効無効、慣性の調整） | 同じ都市で、ズーム下限/上限スライダを狭めると寄り引きが頭打ちに。回転・チルトをトグルで固定でき、慣性 duration を上げると "ぬるっと" 止まる | `camera.options`（min/maxZoomDistance, enableSpin/Zoom/Tilt, \*Duration） |

#### 情報表示（ピック・計測・オーバーレイ）

| example                    | 目的                                                                                                                        | ビジュアルコンセプト                                                                                                                                                    | API                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `api/picking`              | クリックで地表点・オブジェクト・フィーチャを特定できることを示す                                                            | 建物やモデルをクリックすると対象がハイライトし、緯度経度・属性がパネルに出る。パネルは`OverlayPlugin`を使用して表示。HTMLで少しリッチに見せる。basemap=https://papers.reearth.land/styles/papers-light/tilejson.json, data=https://papers.reearth.land/protomaps/tilejson.json のplaces layerを使用し、ポイントをクリックしたら表示される。色は白黒ベースでポイントは青でクリックしたらオレンジに。                                                      | `pickTerrainPosition` / `pickDepthPosition` / `featureUpdated`         |
| `api/place-on-terrain`     | 画面クリック点を world 変換し、**地形の高さに乗せて**オブジェクトを設置できることを示す | 起伏のある地形をクリックすると、その地点の**標高を含めた地表面**にマーカー/モデルがぴたりと乗る。LOD が上がって地形が更新されても高さが追従（`observeTerrainHeightAt`）, basemap=https://papers.reearth.land/styles/papers-dark/tilejson.json, terrain=ReEarth quantized-mesh | `convertScreenToWorld` + `sampleTerrainHeight` + `observeTerrainHeightAt` |
| `api/local-frame-cylinder` | ローカル基準フレーム（ENU）で向きを合わせ、**円柱を生成する最小実装**を示す                                                 | 地表の任意地点に、地面に対して垂直な円柱が 1 本立つ。基準フレームで正しく起き上がり、switch UIで基準フレームを動的変更。basemap=https://papers.reearth.land/styles/papers-dark/tilejson.json, terrain=ReEarth quantized-mesh                                                          | `eastNorthUpToFixedFrame` + 最小 cylinder ジオメトリ生成               |
| `api/measure-geodesic`   | 2 点間の**大圏距離・方位**を計算し、測地線を地表に描ける計測ツールを示す                                                    | 地図上を 2 点クリックすると、2 点を結ぶ最短の測地線（大圏）が地表に沿って描かれ、距離（km）と方位が表示される。basemap=https://papers.reearth.land/styles/papers-dark/tilejson.json, terrain=ReEarth quantized-mesh                                                           | `EllipsoidGeodesic`（distance / heading / interpolatePoints）          |
| `plugin/person-view` | 一人称/追従キャラで**建物内部・地下**まで探索できることを示す（多くの web 地図が苦手な差別化点）                                                | 街路のキャラを WASD で操作し、そのまま**建物の中へ入る／地下へ潜る**（`hideUnderground=false`）。FPV/TPV切り替え。操作方法はUIで右上に示す。普段は`?`アイコンでまとめておく。basemap=https://papers.reearth.land/styles/papers-dark/tilejson.json, モデルはgltf-animationと同様にFoxモデルを使用 | `PersonViewPlugin` + `hideUnderground` |

### 9. ライティング・エフェクト — 光・空・天候・ポストプロセス

#### ライティング・大気

| example               | 目的                                                                                                                                                                              | ビジュアルコンセプト                                                                                                                                                          | API                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `sky/atmosphere`    | 物理ベースの大気散乱による空を示す（主役=**空の色**。地面は中立に伏せる）                                                                                                         | 地平線近くから見上げると、地平の青みが上空の宇宙の黒へ滑らかに抜けるグラデーション。太陽高度を変えると空全体の色が連動。Google Photorealistic tilesを使用                     | `addDefaultPhotorealScene()` / `SkyMesh`                                 |
| `sky/sun-time`        | 日付・時刻・緯度から**太陽位置と空の色温度**が決まることを示す（主役=**空の色**。影は伏せる／中立地面）                                                                           | 空だけを主役に、時刻スライダを朝→正午→夕→夜へ。空の色温度が連続変化。`setDateFromCameraAt()` で飛んだ都市の地方太陽時に自動同期。夜は月（`getMoonDirection`）も                | `addLight(sun)` + 時刻                                                   |
| `sky/stars`           | 実星図に基づく星空（と月）を示す（主役=**夜空**。地上は邪魔しない）                                                                                                               | **単色（無彩色）の地形**の上に立ち、カメラを**空へ向けて見上げる**構図。地上をシルエット的に伏せることで、満天の星・月が主役として映える。                                    | `addMesh(Stars)` + `moon`                                                |
| `light/shadows`       | 太陽光によるリアルタイム**影**を示す（主役=**影**。空は中立に固定）                                                                                                               | 夕方の低い太陽で、山々が長い影を落とす。時刻が自動で動ごき影が伸縮・回転。                                                                                                    | `addLight(sun)` + shadow / `addLight(ambient)`                           |
| `light/image-based` | **夜のシーンで LightProbe（IBL）が "月光" を与える**ことを示す。大気連動の `SkyLightProbe` は夜になると真っ暗闇になるが、`LightProbe` なら月明かりの環境光でオブジェクトを照らせる | 夜景。`SkyLightProbe` のみだと被写体は**ほぼ真っ暗**（＝夜は光源なし）。そこに **`LightProbe`（月光）** を足すと、金属質のモデルや建物に月明かりの淡い映り込みと陰影が浮かぶ。 | `addLight(LightProbe)`（月光 IBL） ↔ `addLight(SkyLightProbe)`（夜は暗） |

#### 天候

| example             | 目的                                                                        | ビジュアルコンセプト                                                                                                                                | API                                                   |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `weather/clouds`    | ボリューム的な**雲**を出せることを示す（主役=雲）                           | **晴れの日**の空にぽっかり浮かぶ白い雲。密度・高度スライダで雲量が変わる                                                                            | `addEffect(Clouds)`                                   |
| `weather/fog`       | ボリューム的な**霧**を出せることを示す（主役=霧）                           | 山あいの都市。谷底を這う朝霧が密度スライダで満ちていく                                                                                              | `addEffect(Clouds)`（fog 設定）                       |
| `weather/rain`      | 降雨パーティクルを示す（主役=雨。雨天の空気として**黒い雲＋霧**を伴わせる） | 昼の街に、垂れ込めた**黒い雲**と低い**霧**、そこへ斜めの雨脚。量スライダを上げると土砂降りに                                                        | `addMesh(RainMesh)` + `addEffect(Clouds)`（黒雲＋霧） |
| `weather/rain-drop` | カメラ（レンズ）に付く雨滴の演出を示す（主役=RainDrop）                     | **`weather/rain` と同じシーン**（雨＋黒雲＋霧）に、さらにレンズの雨滴を重ねる。画面ガラスに水滴が付着し重力で筋を引いて流れ落ち、車窓のような没入感 | `weather/rain` のシーン + `addEffect(RainDrop)`       |
| `weather/snow`      | 降雪パーティクルを示す（主役=雪。雪天の空気として**黒い雲**を伴わせる）     | 垂れ込めた**黒い雲**の下、街にふわりと舞う雪。                                                                                                      | `addMesh(SnowMesh)` + `addEffect(Clouds)`（黒雲）     |

#### ポストエフェクト（1 エフェクト 1 example）

| example                    | 目的                                                                                 | ビジュアルコンセプト                                                                                                                                                                                  | API                           |
| -------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `effect/selective-bloom` | **指定オブジェクトだけを発光させる**機能そのものを示す     | `gis/extruded-polygon`と同じデータを使用し、bloomを適用する。basemap=`https://papers.reearth.land/styles/papers-dark/tilejson.json` | `addEffect(SelectiveBloom)`   |
| `effect/selective-outline` | 指定オブジェクトに輪郭線を付ける機能そのものを示す                                   | `gis/extruded-polygon`と同じデータを使用し、outlineを適用する。basemap=`https://papers.reearth.land/styles/papers-white/tilejson.json`                                                          | `addEffect(SelectiveOutline)` |
| `effect/color-grading-lut` | LUT で全体の色調を作品的に変えられることを示す。                                      | 同一の夕景を「素→フィルム調→寒色→暖色」と LUT プリセットで切替、印象が一変。Google Photorealistic Tilesを使用。`color-grading-lut`を参考にエモいfilterを中心に。シーンも色の変化がわかりやすいところを選んで。                                                                                                                            | `addEffect(ColorGradingLUT)`  |
| `effect/depth-of-field`    | カメラの被写界深度（ボケ）を示す                                                     | 手前の 1 棟にピント、奥のビル群が柔らかくボケる。フォーカス距離スライダで合焦面が前後。overturemapのbuildingを使用。`pmtiles-overture`を参考に。basemap=`https://papers.reearth.land/styles/papers-white/tilejson.json`                                                                                                                 | `addEffect(DepthOfField)`     |
| `effect/fog-light`       | 点光源からの**ボリューメトリック・ライト**（体積光・光芒）を示す。夜景演出の差別化点 | 夜の山の中の道路を街灯が照らす。basemap=`https://papers.reearth.land/styles/papers-white/tilejson.json`, ReEarth quantized-mesh terrain                                                                                                                                                  | `addEffect(FogLight)`         |
| `effect/ssr`             | 画面空間反射で水面に景色が映り込むことを示す                                         | 川沿いの都市を水面すれすれで。ビル群と空が川面に反射。overturemapのbuildingを使用。`pmtiles-overture`を参考に。basemap=`https://papers.reearth.land/styles/papers-white/tilejson.json`. ReEarth quantized mesh terrainのnormalとwatermaskを有効にするとSSR effectが適用される                                                                                                                                                  | `addEffect(SSR)`              |
| `effect/ssao`              | 環境遮蔽で接触部に自然な陰りが乗ることを示す                                         | 建物の隙間・軒下・地面との接点に薄い陰り。ON/OFF で密度感が変わる                                                                                                                                     | `addEffect(SSAO)`             |
| `effect/lens-flare`        | 太陽に向けたときのレンズフレアを示す                                                 | 逆光気味の構図で太陽方向に光条とゴースト。カメラを振ると光が流れる                                                                                                                                    | `addEffect(LensFlare)`        |
| `effect/tone-mapping`      | HDR を表示レンジに収めるトーンマッピングを示す                                       | 夕景でトーンマッピングモード切り替え                                                                                                                                                                  | `addEffect(ToneMapping)`      |
| `effect/anti-alias`        | FXAA / SMAA でエッジのジャギが取れることを示す                                       | 建物の輪郭を等倍で。OFF のギザギザが ON で滑らかになる拡大比較                                                                                                                                        | `addEffect(FXAA/SMAA)`        |
| `effect/custom`            | 独自シェーダのポストエフェクトを追加できる拡張性を示す                               | 自作 vignette（周辺減光）を適用し、パラメータで暗さ・範囲を調整                                                                                                                                       | `addEffect(custom)`           |

### 網羅チェック（レビュー反映）

- **Getting Started は単一 example の導線に限定。** `getting-started/hello-world`（地図表示）・`getting-started/layers`（複数ジオメトリ GeoJSON を 1 レイヤーで追加・更新・削除）・`getting-started/add-mesh`（メッシュ追加の入口）・`getting-started/source`（Source と Layer の分離）・`camera/control`（カメラ基本）の 5 本。作り込んだ example は各専用セクションに置く。
- **セクションの付け替え（ディレクトリは維持）:** 現状 Geometry（`gis/*`）→ **2D / 2.5D** セクション。Mesh（`mesh/*`）→ **3D** セクション。`camera/control` → Getting Started、`camera/controls-options` → インタラクション・UI。`tiles-3d/photoreal` → ベースマップ/Google、`tiles-3d/buildings`・`tiles-3d/point-cloud` → ソース/3D Tiles。`gis/label-font` → スタイリング/テキスト、`evaluator/*` → スタイリング/式。`weather/*`・`effect/*` → ライティング・エフェクト。
- **追加した機能:** `effect/fog-light`（ボリューメトリック光）、動的 IBL `SkyLightProbe`（`light/image-based` に統合）、`api/custom-desc`（拡張システム）、`mesh/instanced` に FPS/インスタンス数・LOD(`maxSse`)、`plugin/person-view` の屋内/地下探索。インタラクション・UI に `api/place-on-terrain`・`api/local-frame-cylinder`・`api/measure-geodesic`。ソースに `source/geojson`・`source/mvt`。Getting Started に `getting-started/layers`・`getting-started/add-mesh`・`getting-started/source`（いずれも最小構成の入口 example）。
- **既存へ統合した要素:** solar-time 同期（`setDateFromCameraAt`）と月（`getMoonDirection`）→ `sky/sun-time`。環境光 → `light/shadows` の OFF 状態。coordinate-transform ＋ 地形高さ → `api/place-on-terrain`。
- **ギャラリーから外した要素:** `api/partial-update`・`api/dispose`（見せる価値が薄いため debug 側へ）。`gis/geojson-model`（GeoJSON `model` 未サポート → 3D モデル配置は `mesh/` で）。
- **意図的に省略:** `SkyEnvMap`（内部利用の core effect で単体の見せ場が薄いため非掲載）。`AxesHelper`/`ArrowHelper`（debug ヘルパー）。総当たりの effect×geometry 派生。

---

## 6. デザインの一貫性ガイドライン（Art Director 指針）

機能を「引き算」したあと、ギャラリー全体が作品集に見えるための統一ルール。

- **統一されたベースシーン（額縁）。** Feature Example は原則、同一の "ニュートラルな舞台"（地図＋地形＋空）を共有する。舞台は主役を邪魔しない中間トーン。機能に無関係な PLATEAU 全区・複数エフェクトは載せない。
- **可変にしてよいのは "時間帯・太陽" だけ。** 「作品集としての統一感」を守るため、ベース地図・地形・カメラ構図は原則ギャラリー全体で固定し、ドラマ性は time-of-day / 太陽位置の変化だけで付ける。個々のページで舞台ごと作り込まない（＝ per-page アート化を防ぐ）。※夕光・夜景など強い光は、その機能に本当に必要なとき（影・発光・天候）に限定。
- **カメラの初期構図を機能ごとに最適化。** 固定の舞台の中で「その機能が一番魅力的に見える 1 カット」に寄せる（線はアークが映える俯瞰、影は逆光ぎみ、DOF は前後に被写体、等）。サムネイルはその 1 カット。
- **舞台のロケーションは適度に散らす。** 建物・都市シーンが連続するとサムネイルが見分けづらい（`tiles-3d`/`evaluator/*`/`effect/*` が皆ビル）。カテゴリ間で被写体（山岳・水辺・宇宙・屋内 等）を変え、一覧で識別できるようにする。
- **Before/After を効かせる。** エフェクト/ライティング系は必ず ON/OFF トグルを用意し、「何が変わるか」を体験で示す（`effect/anti-alias` は Off/FXAA/SMAA の 3-way）。
- **主役の重複を作らない。** 同一 API を 2 ページで見せない（例: Cesium Ion は `terrain/quantized-mesh`=フォーマット と `plugin/cesium-ion`=認証で主役を分ける。ドレープは `mesh/draped`=3D メッシュ と `gis/polygon-draped`=GIS 面で分ける）。似た名前（`effect/custom`=ポストエフェクト vs `api/custom-shader`=マテリアル）はタイトルで役割を明示。
- **UI（Tweakpane）は主役パラメータだけ。** その機能を体感するための最小限のコントロールに絞る。debug 用の雑多なトグルは出さない。パネルのタイトルに「何の example か」を書く。
- **命名規約と表示セクションを分離。** ディレクトリは機能ベース（`gis/*`, `mesh/*`, `effect/*` …）のまま、表示セクションは各 example の `meta.ts` の `section` / `group` で決める（`examples/sections.ts`）。index は `SECTION_KEYS` 順（Getting Started → 2D → 2.5D → 3D → ベースマップ → 地形 → ソース → スタイリング → インタラクション・UI → ライティング・エフェクト）でグルーピングする。
- **サムネイルの品質・比率を統一。** 同一解像度・統一条件で撮る。ギャラリーが「作品集」に見えることを最優先。
- **ギャラリーは Feature Example のみ。** 複数機能を盛った作品（Showcase / Use Case）やマップ外ツールは置かない。網羅・総当たり（原則#4）と引き算（原則#2）が衝突したら公開ギャラリーは curation を優先し、総当たりは `debug/*` に置いて非掲載。
