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

## 5. 理想の Example ギャラリー（ゼロから設計）

**設計思想:** チュートリアル的な導線（Getting Started）は作らず、**機能そのもの**でカテゴリを切る。ユーザーの「○○を出したい／○○の効果をかけたい」という機能単位の関心に、API ドメイン（データ → メッシュ → 光 → 演出 → 視点 → 拡張）でまっすぐ対応させる。各 Feature Example は「その機能が最も美しく見える 1 カット」を Art Director が具体的に指定する。

各表の列の意味:

- **目的** — その 1 機能で「何ができるようになるか」「Navara の何が伝わるか」。
- **ビジュアルコンセプト** — 舞台（場所）／時間帯・光／カメラ構図／操作したときに**目に見えて変わるもの**を具体的に。サムネイルもこの 1 カットで撮る。
- **使う API** — 主役となる呼び出し。
- 行頭の **★** = **Signature**（下記）。

命名規約: ディレクトリ第 1 階層をカテゴリ名にする（`vite` の挙動に合致）。例: `mesh/arcline`, `effect/selective-bloom`。

### 決定事項・トレードオフ（レビュー反映）

- **合成ショーケースは作らない（ユーザー方針）。** レビューでは「純粋な機能羅列は平板で、Navara の差別化が最初の 12 枚（ラスタ地図・地形など他エンジンでも出来る土台系）に埋もれる」という指摘があった。だが Showcase / Use Case は置かない方針なので、**合成作品は追加せず、代わりに "Signature"（★）で対処する。**
- **Signature（★）** = 単体機能のままで「これは他の 2D 地図ライブラリではない」と一目で伝わる、Navara の差別化ポイント。index では★を **最上段の "Featured" 帯**に大きく並べ、初見ユーザーが最初に強みへ触れられるようにする（合成ではなく "選りすぐりの単体 example" を先頭に出すだけ）。★候補: `tiles-3d/photoreal`, `sky/atmosphere`, `light/image-based`, `mesh/instanced`, `mesh/arcline`, `effect/selective-bloom`, `mesh/splat`, `effect/fog-light`, `plugin/person-view`, `terrain/raster`（綺麗な法線）, `gis/label-font`（Google Font 再現）, `evaluator/color`（データ駆動スタイリング）。
- **網羅（原則#4）と引き算（原則#2）が衝突したら、公開ギャラリーでは "curation（差別化・美しさ）" を優先する。** 全機能の総当たり網羅は非公開の debug セットに置き、公開ギャラリーは "作品集" として厳選する。

---

### 10. Basemap — 地図データを敷く（土台のバリエーション）

| example                      | 目的                                                                                                              | ビジュアルコンセプト                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | API                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `basemap/raster-tiles`       | 標準的な XYZ ラスタタイルを 1 枚敷く最短ルート                                                                    | 衛星写真ベースの日本を宇宙から俯瞰。雲ひとつない端正なグローブ                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `addLayer(tiles)`                                   |
| `basemap/vector-map`         | ベクタタイル（MVT）でズームしても輪郭が甘くならないことを示す                                                     | 東京中心部を斜め見下ろし。道路・水系・区画が細い実線でシャープに描かれ、ズームインしてもエッジが保たれる                                                                                                                                                                                                                                                                                                                                                                                                                         | `addLayer(mvt, vectorTile)`                         |
| `basemap/multiple-sources`   | 複数タイルソースを重ね・切替できる合成を示す                                                                      | 同じ都市で「標準図／衛星写真」をトグルで瞬時に切り替え、レイヤの重なり・差し替えが分かる                                                                                                                                                                                                                                                                                                                                                                                                                                         | 複数 `addLayer(tiles)`                              |
| `basemap/raster-overlay`     | ラスタ地図の上に半透明のラスタオーバーレイ（ハザードマップ等）を重ねられることを示す                              | 標準地図の上に洪水/土砂災害などのハザードラスタを不透明度スライダで重ね、下地との重なりを見せる                                                                                                                                                                                                                                                                                                                                                                                                                                  | `addLayer(tiles)` ×2（下地＋オーバーレイ, opacity） |
| `basemap/pmtiles`(WP)        | 単一 `.pmtiles` アーカイブ 1 個から街全体を配信できる手軽さを示す                                                 | Overture Maps の PMTiles を読み込み、世界の街（例: ロンドン中心部）を低めの俯瞰で。建物・道路・区画を表示。**メモ:** PMTiles（MVT）は多数のレイヤをスタイリングする必要があり、生の `addLayer` で手書きするより **`style.json` で一括指定するのが自然**。よって **`MapLibreStylePlugin` の完成を待ち、`style.json` を使った PMTiles example にするのが理想**（それまでは暫定実装）。完成後は `basemap/pmtiles` と `basemap/maplibre-style` を統合し、「Overture PMTiles × MapLibre `style.json`」の 1 example にまとめてもよい。 | `addLayer(mvt, pmtiles source)`                     |
| `basemap/maplibre-style`(WP) | 既存の MapLibre スタイル JSON をそのまま流用できる互換性を示す（＝`MapLibreStylePlugin` の公式 example を兼ねる） | 見慣れた MapLibre 配色の地図が、そのスタイル定義のまま 3D 地球上に載る                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `MapLibreStylePlugin`（`@navara/maplibre_style`）   |

### 20. Terrain — 地形で起伏を出す

| example                     | 目的                                                                                                                                              | ビジュアルコンセプト                                                                                                                                              | API                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| ★ `terrain/raster`          | ラスタ標高タイルから**非常に綺麗な法線**が得られ、陰影の効きをスライダで強調できることを示す（raster terrain の一番の強み）                       | 山岳（例: 富士 / アルプス）を斜光で。**法線強調スライダ**を上げると尾根・谷・沢のディテールが陰影でくっきり立ち上がり、地形の質感が一気に増す（＋誇張率スライダ） | `addLayer(terrain, rasterTerrain)`（法線強度 / 誇張） |
| `terrain/quantized-mesh`    | quantized-mesh 形式の特長である **watermask（水面マスク）** を示す（法線はラスタ地形ほど綺麗に出ないが、海・湖を面として扱える）                  | 海岸線を持つ地形を俯瞰。watermask により海・湖が陸と区別され、水面だけ滑らか＆反射的に、陸は地形として描き分けられる                                              | `addLayer(terrain, quantizedMesh)`（watermask）       |
| `terrain/hillshade`         | **ジオメトリを持ち上げず、法線由来の陰影だけ**で起伏を表現する技法を示す（`terrain/raster` の "実際に立体化" と対になる。こちらは平面＝陰影表現） | **平面（flat）**のグレー地形図。3D の隆起はないのに、法線から計算された陰影だけで谷・尾根が浮かび上がる。太陽方位スライダを回すと陰影が動き、平面上で地形が読める | `addLayer(terrain, hillshade)`（flat / 太陽方位）     |
| `terrain/elevation-heatmap` | 標高を色で定量的に見せるヒートマップを示す                                                                                                        | 山地を真俯瞰。**Turbo グラデーション**（青→緑→黄→赤）で標高が段階的に色分けされ、谷筋・尾根の高低が一目で読める                                                   | `addLayer(tiles, elevationHeatmap)`（Turbo colormap） |

### 30. 3D Tiles — 都市・巨大 3D データ

| example                | 目的                                                                     | ビジュアルコンセプト                                                                                            | API                                     |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `tiles-3d/buildings`   | PLATEAU など Cesium 3D Tiles（b3dm）の都市モデルを軽快に扱えることを示す | 東京・丸の内のビル群を歩行者目線に近い斜め俯瞰で。近づくほど LOD が上がり窓や屋上設備まで出る(LOD2 textureなし) | `addLayer(cesium3dtiles, model)`        |
| ★ `tiles-3d/photoreal` | Google フォトリアル 3D Tiles を実写級で表示できることを示す              | サンフランシスコの街を屋根すれすれの低空でスライド。橋や坂道が写真そのままの質感                                | `addLayer(cesium3dtiles)`（要 API key） |
| `tiles-3d/point-cloud` | 点群（pnts）をそのまま描画できることを示す                               | 城の点群を周回カメラで。無数の点が形を成し、回り込むと立体として認識できる                                      | `addLayer(cesium3dtiles, pnts)`         |

### 40. Geometry

**方針:** わかりやすさ最優先。各 example の**用途に合わせたシンプルな GeoJSON を自作**し、**GeoJSON だけ**で見せる。ここは **固定スタイル（evaluator なし）** で「その GeoJSON マテリアルをどう描く/装飾するか」に集中する。属性でスタイルを動かす話は次の **45. Data-driven Styling（Evaluator）** に分離。**MVT のスタイリングは `basemap/pmtiles`（Overture）で統合的に見せる**ため扱わない。ベースは無彩色に寄せ、データの色だけを主役に。

| example                | 目的                                                                                                                                  | ビジュアルコンセプト                                                                                                                          | API                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `gis/point`            | 点シンボルを固定スタイル（色・サイズ・形）で描く                                                                                      | 灰色の地図に均一な点群がくっきり乗る。色/サイズを変えると全点が一様に変わる                                                                   | `addLayer(geojson, point)`                                              |
| `gis/polyline`         | 線を固定スタイル（色・幅・破線）で描く                                                                                                | 川や街路を一定の色・太さのラインで。破線/実線の切替                                                                                           | `addLayer(geojson, polyline)`                                           |
| `gis/polygon-draped`   | ポリゴンを地形表面に貼り付ける（**GIS 面のドレープ**）                                                                                | 起伏地に行政界の面が皺なく貼りつき、丘を越えても地表に密着（※`mesh/draped` は 3D メッシュのドレープで別物）                                   | `addLayer(geojson, polygon draped)`                                     |
| `gis/polygon-extruded` | ポリゴンを固定高さで 3D 押し出しし、側面/上面を装飾                                                                                   | 街区が一定高さで箱状に立ち上がり、側面と屋根で色分け                                                                                          | `addLayer(geojson, polygon extruded)`                                   |
| `gis/billboard`        | 点にアイコン画像（ビルボード）を立てる                                                                                                | 都市 POI にカテゴリ別アイコンが常に正面を向いて並ぶ。カメラを回してもアイコンは正対                                                           | `addLayer(geojson, billboard)`                                          |
| ★ `gis/label-font`     | 点にテキストラベルを描き、**Navara の Font API** を示す。Google Fonts を **unicode-range 含めて再現**でき、必要な字形だけ読み込む設計 | 世界地図に各都市名を現地表記（ラテン／日本語／アラビア語／タイ語／絵文字）でラベリング。指定 Google Font の字形がそのまま出て、重ならず読める | `addLayer(geojson, text)` + **Font API**（Google Font / unicode-range） |

> ※ **GeoJSON の `model` マテリアルは未サポート**のため、データ点への 3D モデル配置は `mesh/`（`mesh/gltf-model` / `mesh/instanced`）で示す。color-emoji / 複数フォントフェイスは `gis/label-font` 内のバリエーションに寄せる。

### 45. Data-driven Styling

**主役は `FeatureEvaluator`**（＝フィーチャの属性値から、その場で色・表示可否を計算するコールバック）。Navara の GIS 表現力の核。40 の "固定スタイル" と対で、「**同じデータを値によって塗り分ける／絞り込む**」ことを見せる。題材は建物（3D Tiles）に統一。

| example             | 目的                                                          | ビジュアルコンセプト                                                   | API                                            |
| ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| ★ `evaluator/color` | 建物を**属性に応じて色分け**できることを示す                  | 都市の建物群を用途（住居/商業/公共）や高さなど属性で色分け             | `cesium3dtiles` + `FeatureEvaluator`           |
| `evaluator/filter`  | 建物を**属性に応じてフィルタ**（表示/非表示）できることを示す | 条件に合う建物だけが残り、しきい値スライダを動かすと即座に絞り込まれる | `cesium3dtiles` + `FeatureEvaluator`（filter） |

### 50. Mesh — シーンに 3D オブジェクトを置く

| example               | 目的                                                                                                                                                            | ビジュアルコンセプト                                                                                                                                                  | API                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `mesh/primitives`     | 箱・球・円柱・面・チューブを緯度経度指定で置ける基本を示す                                                                                                      | 皇居前の広場に基本形状を等間隔グリッドで整列。回転する太陽光で各形状に陰影                                                                                            | `addMesh(box/sphere/cylinder/plane/tube)`  |
| `mesh/gltf-model`     | 実寸の glTF モデルを地図上の座標にピン留めできることを示す                                                                                                      | ランドマーク広場に精緻な 1 体（彫像や車両）を実寸配置。周囲を回り込んで質感を見せる                                                                                   | `addMesh(GLTFModel)`                       |
| `mesh/gltf-animation` | glTF のアニメーションクリップを再生できることを示す                                                                                                             | 街角で 1 体のキャラクターが歩行モーション。クリップ切替・速度スライダで動きが変わる                                                                                   | `addMesh(GLTFModel)` + clips               |
| ★ `mesh/instanced`    | 同一メッシュを 1 draw call で **10⁵〜10⁶ 個**描く GPU インスタンシングの性能を示す（Rust/WASM エンジンの実力を可視化）                                          | 都市全域に数十万本の樹木（or ピン）が敷き詰められ、画面隅に **FPS＋インスタンス数のライブ表示**。それを保ったまま滑らかに周回。                                       | `addMesh(InstancedBox/GltfModel …)`        |
| ★ `mesh/arcline`      | **2 地点を結ぶアーク（大圏）線を描く**機能そのものを示す                                                                                                        | 昼の地球を俯瞰し、東京発の複数アークが放物線を描いて各都市へ伸びる。グラデーション・破線・太さを調整。※発光はここでは足さない（それは effect/selective-bloom の役目） | `addMesh(ArclineMesh)`                     |
| `mesh/smoothline`     | 制御点を Catmull-Rom で滑らかに繋ぐ曲線を示す                                                                                                                   | 蛇行する登山ルートを、折れ線ではなく滑らかな帯として地形上に敷く(アニメーションで見せれるとなお良し)                                                                  | `addMesh(SmoothLineMesh)`                  |
| `mesh/glow-globe`     | 地球外周のフレネルグロー（大気の光輪）を示す                                                                                                                    | 宇宙背景で地球のリムに沿って青い光輪。半径・色・強度スライダで大気感が増減                                                                                            | `addMesh(GlowGlobeMesh)`                   |
| `mesh/draped`         | **3D メッシュ**を地形表面にドレープ配置できることを示す（※GIS 面のドレープは `gis/polygon-draped`）                                                             | 起伏地に置いた箱・円柱が地形の凹凸に沿って底面が変形し、地面に密着                                                                                                    | `addMesh(..., draped: true)`               |
| ★ `mesh/splat`        | 3D Gaussian Splat アセットを表示できることを示す（他の web 地図ではまず見ない差別化点）                                                                         | 実測スキャンされたオブジェクトをカメラが周回                                                                                                                          | `addMesh(SplatMesh)`                       |
| `mesh/custom`         | **自作の MeshDesc**（独自ジオメトリ＋シェーダマテリアル）をシーンに持ち込めることを示す（拡張性）。※`api/custom-desc`（エンジン拡張の仕組み）の具体的な mesh 版 | 地図上に手書きシェーダの独自メッシュ（波打つ面 / 発光する形状など）を 1 つ配置し、uniform スライダで挙動が変わる                                                      | `registerMesh(custom)` + `addMesh(custom)` |

### 60. Lighting & Atmosphere — 光と空

| example               | 目的                                                                                                                                                                               | ビジュアルコンセプト                                                                                                                                                           | API                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| ★ `sky/atmosphere`    | 物理ベースの大気散乱による空を示す（主役=**空の色**。地面は中立に伏せる）                                                                                                          | 地平線近くから見上げると、地平の青みが上空の宇宙の黒へ滑らかに抜けるグラデーション。太陽高度を変えると空全体の色が連動。Google Photorealistic tilesを使用                      | `addDefaultPhotorealScene()` / `SkyMesh`                                 |
| `sky/sun-time`        | 日付・時刻・緯度から**太陽位置と空の色温度**が決まることを示す（主役=**空の色**。影は伏せる／中立地面）                                                                            | 空だけを主役に、時刻スライダを朝→正午→夕→夜へ。空の色温度が連続変化。`setDateFromCameraAt()` で飛んだ都市の地方太陽時に自動同期。夜は月（`getMoonDirection`）も                | `addLight(sun)` + 時刻                                                   |
| `sky/stars`           | 実星図に基づく星空（と月）を示す（主役=**夜空**。地上は邪魔しない）                                                                                                                | **単色（無彩色）の地形**の上に立ち、カメラを**空へ向けて見上げる**構図。地上をシルエット的に伏せることで、満天の星・月が主役として映える。                                     | `addMesh(Stars)` + `moon`                                                |
| `light/shadows`       | 太陽光によるリアルタイム**影**を示す（主役=**影**。空は中立に固定）                                                                                                                | 夕方の低い太陽で、山々が長い影を落とす。時刻が自動で動ごき影が伸縮・回転。                                                                                                     | `addLight(sun)` + shadow / `addLight(ambient)`                           |
| ★ `light/image-based` | **夜のシーンで LightProbe（IBL）が "月光" を与える**ことを示す。大気連動の `SkyLightProbe` は夜になると真っ暗闇になるが、`LightProbe` なら月明かりの環境光でオブジェクトを照らせる | 夜景。`SkyLightProbe` のみだと被写体は**ほぼ真っ暗**（＝夜は光源なし）。そこに **`LightProbe`（月光）** を足すと、金属質のモデルや建物に月明かりの淡い映り込みと陰影が浮かぶ。 | `addLight(LightProbe)`（月光 IBL） ↔ `addLight(SkyLightProbe)`（夜は暗） |

### 70. Post Effects — ポストプロセス（1 エフェクト 1 example）

| example                    | 目的                                                                                 | ビジュアルコンセプト                                                                                                                                                                                  | API                           |
| -------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| ★ `effect/selective-bloom` | **指定オブジェクトだけを発光させる**機能そのものを示す（主役は Bloom の ON/OFF）     | 共通の中立フレームに、対象として**シンプルな四角い polygon を 1 枚**置くだけ。Bloom を ON にした瞬間、その面がネオンのように滲んで光る。※アーク線や夜景など余計な要素は足さず、効果だけを純粋に見せる | `addEffect(SelectiveBloom)`   |
| `effect/selective-outline` | 指定オブジェクトに輪郭線を付ける機能そのものを示す                                   | 共通の中立フレームに、対象として**シンプルな四角い polygon を 1 枚**置くだけ。Outline を ON にすると、その面の周囲にクッキリした縁取りが出る                                                          | `addEffect(SelectiveOutline)` |
| `effect/color-grading-lut` | LUT で全体の色調を作品的に変えられることを示す                                       | 同一の夕景を「素→フィルム調→寒色→暖色」と LUT プリセットで切替、印象が一変                                                                                                                            | `addEffect(ColorGradingLUT)`  |
| `effect/depth-of-field`    | カメラの被写界深度（ボケ）を示す                                                     | 手前の 1 棟にピント、奥のビル群が柔らかくボケる。フォーカス距離スライダで合焦面が前後                                                                                                                 | `addEffect(DepthOfField)`     |
| ★ `effect/fog-light`       | 点光源からの**ボリューメトリック・ライト**（体積光・光芒）を示す。夜景演出の差別化点 | 夜の街路に並ぶ街灯から、霧の中を光が円錐状に広がる。                                                                                                                                                  | `addEffect(FogLight)`         |
| ★ `effect/ssr`             | 画面空間反射で水面に景色が映り込むことを示す                                         | 川沿いの都市を水面すれすれで。ビル群と空が川面に反射                                                                                                                                                  | `addEffect(SSR)`              |
| `effect/ssao`              | 環境遮蔽で接触部に自然な陰りが乗ることを示す                                         | 建物の隙間・軒下・地面との接点に薄い陰り。ON/OFF で密度感が変わる                                                                                                                                     | `addEffect(SSAO)`             |
| `effect/lens-flare`        | 太陽に向けたときのレンズフレアを示す                                                 | 逆光気味の構図で太陽方向に光条とゴースト。カメラを振ると光が流れる                                                                                                                                    | `addEffect(LensFlare)`        |
| `effect/tone-mapping`      | HDR を表示レンジに収めるトーンマッピングを示す                                       | 夕景でトーンマッピングモード切り替え                                                                                                                                                                  | `addEffect(ToneMapping)`      |
| `effect/anti-alias`        | FXAA / SMAA でエッジのジャギが取れることを示す                                       | 建物の輪郭を等倍で。OFF のギザギザが ON で滑らかになる拡大比較                                                                                                                                        | `addEffect(FXAA/SMAA)`        |
| `effect/custom`            | 独自シェーダのポストエフェクトを追加できる拡張性を示す                               | 自作 vignette（周辺減光）を適用し、パラメータで暗さ・範囲を調整                                                                                                                                       | `addEffect(custom)`           |

### 80. Weather & Particles — 天候・パーティクル

| example             | 目的                                                                        | ビジュアルコンセプト                                                                                                                                | API                                                   |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `weather/clouds`    | ボリューム的な**雲**を出せることを示す（主役=雲）                           | **晴れの日**の空にぽっかり浮かぶ白い雲。密度・高度スライダで雲量が変わる                                                                            | `addEffect(Clouds)`                                   |
| `weather/fog`       | ボリューム的な**霧**を出せることを示す（主役=霧）                           | 山あいの都市。谷底を這う朝霧が密度スライダで満ちていく                                                                                              | `addEffect(Clouds)`（fog 設定）                       |
| `weather/rain`      | 降雨パーティクルを示す（主役=雨。雨天の空気として**黒い雲＋霧**を伴わせる） | 昼の街に、垂れ込めた**黒い雲**と低い**霧**、そこへ斜めの雨脚。量スライダを上げると土砂降りに                                                        | `addMesh(RainMesh)` + `addEffect(Clouds)`（黒雲＋霧） |
| `weather/rain-drop` | カメラ（レンズ）に付く雨滴の演出を示す（主役=RainDrop）                     | **`weather/rain` と同じシーン**（雨＋黒雲＋霧）に、さらにレンズの雨滴を重ねる。画面ガラスに水滴が付着し重力で筋を引いて流れ落ち、車窓のような没入感 | `weather/rain` のシーン + `addEffect(RainDrop)`       |
| `weather/snow`      | 降雪パーティクルを示す（主役=雪。雪天の空気として**黒い雲**を伴わせる）     | 垂れ込めた**黒い雲**の下、街にふわりと舞う雪。                                                                                                      | `addMesh(SnowMesh)` + `addEffect(Clouds)`（黒雲）     |

### 90. Plugins — 公式プラグイン（1 プラグイン 1 example）

| example                 | 目的                                                                                                                                            | ビジュアルコンセプト                                                                                     | API                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `plugin/attribution`    | データ出典表示を自動で組み込めることを示す                                                                                                      | 画面隅にライト/ダーク対応の端正なクレジット。ソースを足すと自動で出典が増える                            | `AttributionPlugin`                    |
| `plugin/overlay-marker` | 3D 座標に追従する HTML オーバーレイを置けることを示す                                                                                           | ビルの屋上に吹き出し型 DOM ピンが刺さり、カメラを動かしても正しく追従。HTML なので中に画像やボタン       | `OverlayPlugin`                        |
| ★ `plugin/person-view`  | 一人称/追従キャラで**建物内部・地下**まで探索できることを示す（多くの web 地図が苦手な差別化点）                                                | 街路のキャラを WASD で操作し、そのまま**建物の中へ入る／地下へ潜る**（`hideUnderground=false`）。FPV/TPV | `PersonViewPlugin` + `hideUnderground` |
| `plugin/cesium-ion` ?   | Cesium Ion の**トークン認証ワークフロー**で任意の Ion アセットを読めることを示す（主役は認証。地形フォーマット自体は `terrain/quantized-mesh`） | トークンを入れると Ion アセットが読み込まれ、未認証→認証で表示が切り替わる                               | `CesiumIonPlugin`                      |

### 95. Camera — 視点操作

| example                   | 目的                                                                                                                         | ビジュアルコンセプト                                                                                                                        | API                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `camera/control`          | 緯度経度・高度・方位・ピッチで視点を厳密に置ける／`flyTo` で映画的に移動できることを示す（Google Photorealistic Tiles 上で） | 東京タワー上空から `flyTo` でパリのエッフェル塔へ、地球の丸みをかすめながら数秒で滑空。ボタンで世界の名所プリセットへ飛ぶ                   | `setCamera({lng,lat,height,heading,pitch})` / `flyTo` / `lookAt`          |
| `camera/controls-options` | カメラ操作の**制御・制約**をチューニングできることを示す（ズーム範囲の制限、回転/ズーム/チルトの有効無効、慣性の調整）       | 同じ都市で、ズーム下限/上限スライダを狭めると寄り引きが頭打ちに。回転・チルトをトグルで固定でき、慣性 duration を上げると "ぬるっと" 止まる | `camera.options`（min/maxZoomDistance, enableSpin/Zoom/Tilt, \*Duration） |

### A0. Geometry & Interaction API — 幾何・インタラクション

`navara_three_api`（座標変換・測地線・ローカル基準フレーム）と ThreeView の地形/ピック API を使った、「地図の上で**計算して置く／測る／拾う**」系。`partial-update` や `dispose` はギャラリーで見せる意味が薄いので除外（開発者向けに debug 側へ）。

| example                    | 目的                                                                                                                        | ビジュアルコンセプト                                                                                                                                                    | API                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `api/picking`              | クリックで地表点・オブジェクト・フィーチャを特定できることを示す                                                            | 建物やモデルをクリックすると対象がハイライトし、緯度経度・属性がパネルに出る。地表クリックでその地点の座標も取れる                                                      | `pickTerrainPosition` / `pickDepthPosition` / `featureUpdated`         |
| `api/place-on-terrain`     | 画面クリック点を world 変換し、**地形の高さに乗せて**オブジェクトを設置できることを示す（coordinate-transform ＋ 地形標高） | 起伏のある地形をクリックすると、その地点の**標高を含めた地表面**にマーカー/モデルがぴたりと乗る。LOD が上がって地形が更新されても高さが追従（`observeTerrainHeightAt`） | `convertScreenToWorld` + `sampleTerrainHeight` / `pickTerrainPosition` |
| `api/local-frame-cylinder` | ローカル基準フレーム（ENU）で向きを合わせ、**円柱を生成する最小実装**を示す                                                 | 地表の任意地点に、地面に対して垂直な円柱が 1 本立つ。基準フレームで正しく起き上がり、高さ/半径スライダで変わる                                                          | `eastNorthUpToFixedFrame` + 最小 cylinder ジオメトリ生成               |
| ★ `api/measure-geodesic`   | 2 点間の**大圏距離・方位**を計算し、測地線を地表に描ける計測ツールを示す                                                    | 地図上を 2 回クリックすると、2 点を結ぶ最短の測地線（大圏）が地表に沿って描かれ、距離（km）と方位が表示される                                                           | `EllipsoidGeodesic`（distance / heading / interpolatePoints）          |

### 網羅チェック（レビュー反映）

- **追加した機能:** `effect/fog-light`（ボリューメトリック光）、動的 IBL `SkyLightProbe`（`light/image-based` に統合）、`api/custom-desc`（拡張システム）、`mesh/instanced` に FPS/インスタンス数・LOD(`maxSse`)、`plugin/person-view` の屋内/地下探索。A0 に `api/place-on-terrain`（地形標高に設置）・`api/local-frame-cylinder`（ENU で円柱生成）・★`api/measure-geodesic`（大圏距離計測）を追加。
- **既存へ統合した要素:** solar-time 同期（`setDateFromCameraAt`）と月（`getMoonDirection`）→ `sky/sun-time`。環境光 → `light/shadows` の OFF 状態。coordinate-transform ＋ 地形高さ → `api/place-on-terrain`。
- **ギャラリーから外した要素:** `api/partial-update`・`api/dispose`（見せる価値が薄いため debug 側へ）。`gis/geojson-model`（GeoJSON `model` 未サポート → 3D モデル配置は `mesh/` で）。
- **意図的に省略:** `SkyEnvMap`（内部利用の core effect で単体の見せ場が薄いため非掲載）。`AxesHelper`/`ArrowHelper`（debug ヘルパー）。総当たりの effect×geometry 派生。

---

## 6. デザインの一貫性ガイドライン（Art Director 指針）

機能を「引き算」したあと、ギャラリー全体が作品集に見えるための統一ルール。

- **統一されたベースシーン（額縁）。** Feature Example は原則、同一の "ニュートラルな舞台"（地図＋地形＋空）を共有する。舞台は主役を邪魔しない中間トーン。機能に無関係な PLATEAU 全区・複数エフェクトは載せない。
- **可変にしてよいのは "時間帯・太陽" だけ。** 「作品集としての統一感」を守るため、ベース地図・地形・カメラ構図は原則ギャラリー全体で固定し、ドラマ性は time-of-day / 太陽位置の変化だけで付ける。個々のページで舞台ごと作り込まない（＝ per-page アート化を防ぐ）。※夕光・夜景など強い光は、その機能に本当に必要なとき（影・発光・天候）に限定。
- **カメラの初期構図を機能ごとに最適化。** 固定の舞台の中で「その機能が一番魅力的に見える 1 カット」に寄せる（線はアークが映える俯瞰、影は逆光ぎみ、DOF は前後に被写体、等）。サムネイルはその 1 カット。
- **舞台のロケーションは適度に散らす。** 建物・都市シーンが連続するとサムネイルが見分けづらい（`tiles-3d`/`evaluator/tiles-3d`/`effect/*` が皆ビル）。カテゴリ間で被写体（山岳・水辺・宇宙・屋内 等）を変え、一覧で識別できるようにする。
- **Before/After を効かせる。** エフェクト/ライティング系は必ず ON/OFF トグルを用意し、「何が変わるか」を体験で示す（`effect/anti-alias` は Off/FXAA/SMAA の 3-way）。
- **主役の重複を作らない。** 同一 API を 2 ページで見せない（例: Cesium Ion は `terrain/quantized-mesh`=フォーマット と `plugin/cesium-ion`=認証で主役を分ける。ドレープは `mesh/draped`=3D メッシュ と `gis/polygon-draped`=GIS 面で分ける）。似た名前（`effect/custom`=ポストエフェクト vs `api/custom-shader`=マテリアル）はタイトルで役割を明示。
- **UI（Tweakpane）は主役パラメータだけ。** その機能を体感するための最小限のコントロールに絞る。debug 用の雑多なトグルは出さない。パネルのタイトルに「何の example か」を書く。
- **命名規約を統一。** `<category>/<feature>`。ディレクトリ第 1 階層＝カテゴリ（`vite.config.example.ts` の挙動に合致）。index はセクション（10→A0）順・機能順にグルーピングし、**冒頭に ★Signature の Featured 帯**を置く。
- **サムネイルの品質・比率を統一。** 同一解像度・統一条件で撮る。ギャラリーが「作品集」に見えることを最優先。
- **ギャラリーは Feature Example のみ。** 複数機能を盛った作品（Showcase / Use Case）やマップ外ツールは置かない。網羅・総当たり（原則#4）と引き算（原則#2）が衝突したら公開ギャラリーは curation を優先し、総当たりは `debug/*` に置いて非掲載。

---

## 7. 次アクション（合意後）

1. この理想カタログ（セクション 5）とカテゴリ・命名への合意。
2. 統一ベースシーン（額縁）テンプレの策定。全 Feature Example がこれを継承する。
3. 各 Feature Example を「1 機能＋指定構図」で新規作成 or 既存素材から引き算して再構成。
4. 混在ページ（旧 use-cases / showcases / weather 等）は分解し、含まれていた機能を各 Feature Example に還元。作品ページとしては残さない。
5. index（`App.tsx` / `vite.config.example.ts`）を新カテゴリ（10→A0）表示に更新。
6. debug 派生をギャラリーから除外。
7. サムネイル一斉撮り直し（統一条件）。
