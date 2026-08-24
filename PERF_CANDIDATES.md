# PERF_CANDIDATES

トラバース／データ読み込みの改善候補（2026-07-13 調査）。対象: 3D Tiles / Terrain / raster tile / vector tile。
行番号は調査時点（`fix/improve-memory-management` ブランチ）のもの。
2026-07-14 に追加調査分（WASM↔JS 境界 B-系 / Three.js レンダリング TR-系 / Rust ECS 常時コスト N-系）を追記。

## 横断テーマ（全系統共通 — 共通基盤で一度に直せる）

### 1. skip-LOD 不在 — ズームインで中間レベルを全段フェッチ【最大の伸びしろ】

深いズームへ移動すると、ルート→目標レベルまでの全中間タイルをダウンロード・パース・GPU アップロードする。
すぐ子に置換されて捨てられるデータに帯域・CPU・メモリ予算（ReservedCost 台帳）を払い、ロードゲートを不必要に閉めやすい。

- vector: `crates/navara_vector_tile/src/tile/traverse.rs:437-455` — 未レンダーの中間レベルも `prepare_tile`
- raster: `crates/navara_tile/src/raster/traverse.rs:104-119` — 降下パス上の全レベルを要求（z=18 表示で 19 枚/カラム）
- 3D Tiles: `traversal.rs:358-366, 483-501` — 子未ロード中の中間タイルも `leaf=true` でコンテンツ要求
- terrain: `traverse.rs:368-374` の `parent_mesh_ready` ゲートが自分の DEM を持つ子まで親メッシュ完成を待たせ、
  レベル逐次ロードを直列化（初期表示が「レベル数 × メッシュ化レイテンシ」で律速）

**改善案**: CesiumJS の `skipLevelOfDetail` 相当。フォールバックは「ロード済みの最も近い祖先」だけ使い、
未ロード中間レベルは数レベルおきのアンカーのみ（または全く）要求しない。
raster の `resolve_loaded_tile` walk-up は任意の祖先距離に対応済みなので受け側変更は不要。
terrain はまずゲート条件を「アップサンプルが必要な子（`should_overscale` または fetch 失敗）だけ」に限定する 1 条件の変更で大きく効く。

**インパクト**: 深ズーム時の転送量・パース量を数分の 1 に削減し得る。実装コストは大（簡易版なら中）。

### 2. フラスタム外タイルをフェッチする

- 3D Tiles（最重症）: REPLACE の親→子切替が画面外の兄弟のロード完了まで待つ設計で、そのために
  `mark_for_preload`（`traversal.rs:380-432`）がカリング済み兄弟を強制フェッチ・レンダリングまでする。
  切替レイテンシが画面外タイルに律速され、傾きビューで帯域・メモリを大量消費。
  CesiumJS は「見えている子だけ揃えば切替」方式。
- raster: `raster/traverse.rs` で frustum チェック（137 行）が request（108-119 行）の後にあり、画面外タイルも Medium でフェッチ
- terrain: カルされたタイル自身は `Priority::Extreme` で通常どおり要求（`traverse.rs:431-452`）

**改善案**: 3D Tiles は `all_children_rendered` 集計時にフラスタム外の子を「準備完了扱い」でカウントし
`mark_for_preload` を削除（または Cesium の `preloadWhenHidden` 相当としてオプション化）。
raster/terrain の 1 段 demote は**試行→リバート済み**（親チラつき、進捗節参照）。

**インパクト**: 傾きビューでのフェッチ数・メモリを大幅削減。宿題「傾きビュー直下タイル過剰ロード」に直結
（Terrain 固有の dynamicScreenSpaceError と合わせて解消する筋）。変更は数行〜中規模。

### 3. spawn→reject→despawn チャーン（4 系統同型）

`max_pendings`（既定 50）超過分やゲート閉鎖中の requester を毎フレーム
「entity spawn → URL 構築 → register → ソート → `Deleted+Ignored` → despawn」し、次フレーム再スポーン。

- terrain: `crates/navara_tile/src/data_requester/system.rs:81-93`
- vector: `crates/navara_vector_tile/src/data_requester/system.rs:15-106`
- raster: `crates/navara_tile/src/raster/system.rs:36-87`
- 3D Tiles: `data_requester/systems.rs:94-97`（URL 構築＝クエリペア HashMap 生成込みで毎回、`component.rs:280-296`）

飽和中は待ちタイル数 × 毎フレームの ECS チャーンが空回りし、一度ディスパッチ待ちに入った後の優先度再評価もできない。

**改善案**: requester を破棄せず「待機列」として保持し、毎フレーム (Priority, OrderByDistance) を更新して
空きスロット分だけディスパッチ（CesiumJS RequestScheduler と同型）。
DataManager の register/unregister 往復が消え、`fetch_enqueued` リセット漏れ系のバグ源も減る。

**インパクト**: 高負荷時の CPU 削減＋動的再優先度付けが一度に手に入る。コスト中（各パイプラインに波及）。

### 4. パイプライン横断のリクエストスケジューラ不在 + fetch priority 未伝達

- `RequestLimits { max_pendings: 50 }`（`crates/navara_data_requester/src/lib.rs:44-58`）を
  terrain / raster / hillshade / vector / 3D Tiles が独立に適用 → 合算最大 250 本が無秩序に競合
  （遠くの vector が近くの terrain と帯域を取り合う）。ホスト単位の制限もない。
- JS 側は `fetch(url, {signal})` のみ（`web/navara_three/src/event/index.ts:443,538`）で
  Rust 側の Priority がブラウザに伝わらない。3D Tiles はそもそも Priority 常時 High（`traversal.rs:480`）。

**改善案**: EventStore へ push する直前の共通ゲート 1 箇所でグローバル in-flight 上限＋サーバ毎上限＋
全系統共通の優先度スコア（SSE × 距離 × ビュー中心線からの角度 = foveation）。
あわせて `fetch(url, {priority: "high"|"low"})`（Priority Hints、Chrome/Safari 対応）を小改修で。
「Worker 統一予算」のネットワーク版。

**インパクト**: 多レイヤーシーンでの体感ロード順が大きく改善（中〜大）。Priority Hints 単体はコスト小。

### 5. 失敗タイルが永久に再試行されない

- raster: `web/navara_three/src/loaders/AbortableImageLoader.ts:28` の固定 5 秒タイムアウトで失敗すると
  `TextureFragmentStatus::Fail` entity が残存し、`request.rs:88-93` の `already_requested` が true を返し続けて恒久的に空白。
- 3D Tiles: `helpers.rs:50-54` に `// TODO: Request again if the request failed`。
  tileset.json 失敗も `system.rs:150-152` の `// TODO: Handle fail` で放置 → レイヤーが空のまま回復しない。

**改善案**: 指数バックオフ付きリトライ（N 回まで）。恒久失敗（404）は終端状態にして再要求を止める。
固定 5 秒タイムアウトは撤廃か大幅延長（キャンセルは removed イベントの abort が既に担う）。

**インパクト**: 低速回線・モバイルでの信頼性向上（体感中〜大）。コスト小。

### 6. プリフェッチが皆無

prefetch 機構はどこにもない（全クレート grep でゼロ）。ロードは常に「今フレームの選択結果」の後追い。

**改善案**: パン/回転中はカメラ速度ベクトル方向にフラスタムを少し拡張して traverse し `Priority::Low` で発行。
アイドル時は選択タイルの隣接・現 LOD+1 の子を温める。優先度機構とロードゲートが既にあるので
「ゲート閉鎖時は発行しない」で予算と自然に整合する。

**インパクト**: パン・ズーム時の白タイル/低解像度露出の体感改善（中）。

## 3D Tiles 固有

### 3DT-1. 変更検知が毎フレーム発火し、ツリー全走査が常時実行される【コスト極小・効果大】

`traverse_cesium_3d_tiles_tree` は `Changed<RenderedCesium3dTileContent>` を再実行トリガにしている
（`system.rs:276-299`）が、`toggle_rendered_tile_visible` が値比較なしに毎回書き込む（`traversal.rs:701-708`）ため
変更フラグが毎フレーム立ち、カメラ静止中も全ツリー再帰＋タイルごとの 3 段エンティティ参照チェーン
（`component.rs:320-336`）が走り続ける。

**改善案**: 書き込み前に値比較（`cleanup_system.rs:62-85` の `sync_tile_feature_active` に同パターンの前例あり）。
`mark_rendered_tiles` 内の他の無条件書き込みも点検。

### 3DT-2. tileset.json のパースがメインスレッド同期

`construct_cesium_3d_tiles_tree` がフレーム内で `serde_json::from_slice::<Tileset>`（`system.rs:155-163`）。
PLATEAU の複合 tileset.json は数 MB になり得て数十 ms のヒッチ。
→ worker 委譲、または最低限 1 フレーム 1 件に制限。

### 3DT-3. ネスト tileset.json メタデータが視界から外れると即破棄

`!touched` で requester 削除＋ `Cesium3dTilesNestedTreeMap` から除去（`traversal.rs:547-548, 629-652`）。
コンテンツには retention pool があるが JSON メタデータにはなく、パン往復のたびにリフェッチ＋再パース。
ロードゲート閉鎖中はメタデータフェッチも止まるため復帰がさらに遅れる。
→ URL キーの LRU（バイト上限つき、MemoryLedger 計上）で untouched でも保持。費用対効果高。

### 3DT-4. implicit tiling（3D Tiles 1.1 `implicitTiling` / `.subtree`）未対応

機能ギャップ。subtree availability ビットストリームの遅延ロードは、既存のネスト tileset ピボット機構
（`Cesium3dTilesNestedTreeMap` の「requester ID をキーに遅延解決」）が流用できる。コスト大。

## Terrain 固有

### T-1. dynamicScreenSpaceError 相当がない（傾きビュー過剰ロードの本丸）

SSE は純 Cesium 式のみ（`crates/navara_tile_component/src/tile.rs:108-128`）。
水平に近い視線では遠方まで高 LOD が選択されタイル数が爆発する。
可視部分ベース SSE は overscale 回帰で 2026-07-10 に全リバート済み。

**改善案**: カメラ高度と視線傾斜から密度関数を作り、傾いているときだけ遠方の error を減衰
（CesiumJS `dynamicScreenSpaceError` 方式）。既存の `SseDegrade::effective_max_sse`（距離依存で max_sse を
引き上げる仕組み）に傾斜係数を掛ける形で載せられる。overscale 判定（`is_over_max_zoom` 系）に触れないため
リバートされた方式より回帰リスクが低い。

**インパクト**: 傾きビューのフェッチ数・メモリを数十%削減（Cesium 実測と同オーダー）。モバイル予算逼迫の主因対策。

### T-2. quantized-mesh の layer.json availability 未使用

`QuantizedMeshSource`（`crates/navara_source/src/source.rs:265-276`）は url テンプレート＋zoom 範囲のみで、
欠損タイルは fetch→404→`is_terrain_failed`→親からアップサンプル（`tile/system.rs:561-571`）で発見。
疎な QM 地形では存在しないタイルへのリクエストが恒常発生し `max_pendings` 枠と時間を浪費。
→ ソース追加時に layer.json を 1 回 fetch して availability を保持し、`should_overscale` 判定に
「availability 外→即アップサンプル」を追加。zoom 範囲も自動設定。

### T-3. occludee point の毎フレーム再計算（小）

`begin_traverse_terrain`（`traverse.rs:651-660`）が訪問タイル全部で `update_tile_occludee_point` を毎フレーム再計算。
min/max_height が変わったときだけでよい。

## Raster 固有

### R-1. Object URL リーク + main thread デコード【実バグ】

`web/navara_three/src/loaders/AbortableImageLoader.ts:89` — `fetch→blob→URL.createObjectURL→<img>` で
`URL.revokeObjectURL` がどこにもない（revoke しているのは hillshadeNormalMapGenerator.ts:185 のみ）。
Object URL 登録が blob をページ寿命まで保持 → フェッチしたタイル数に比例してリーク
（`texture.dispose()` では解放されない）。さらに `<img>` からの texImage2D は main thread 同期デコード。

**改善案**: `onImageLoad`/`onImageError` で必ず revoke。加えて
`createImageBitmap(blob, {colorSpaceConversion:"none"})` へ移行（off-main-thread デコード、three.js 直受け可、
DEM 用に worker 側 `getImageDataFromBlob` の前例あり）。

### R-2. タイルごとの 3MB MRT アトラスがプーリングなしで alloc/dispose

`TileMesh` が composite atlas（512²×RGBA×3 アタッチメント ≈ 3MB）を acquire（`tile.ts:228`）、
`TileTextureCache.ts:90` は release 時に即 `atlas.dispose()`。全アトラス同一仕様なのに再利用されない。
パン/ズーム中の terrain タイル churn のたびに GPU の RT 確保/解放。
→ `TileTextureCache` に free-list（上限付き LRU）。raster 1 レイヤのみのタイルは composite を経由せず
フラグメント直サンプルにする選択肢も。実装小・効果高。

### R-3. フラグメントテクスチャの mipmap が無駄【1 行級】

`event/index.ts:647` の Texture が three デフォルト（`generateMipmaps=true`）。
フラグメントはアトラスに等倍〜拡大ペーストされるだけで縮小サンプリングされない。
→ `generateMipmaps=false; minFilter=LinearFilter`。VRAM −25%/フラグメント＋アップロード時間短縮。

### R-4. 表示専用カラーラスタも RGBA 生バイトで CPU/BufferStore に着地

`web/navara_three/src/event/index.ts:437-483` — 画像は worker で `createImageBitmap`+`getImageData`→`buf.setU8`。
DEM/hillshade はバイトが必要だが、表示専用カラーラスタも同経路で 512² あたり約 1MB の RGBA コピーが CPU に滞在。
→ 表示専用は `ImageBitmap` のまま Three.js テクスチャへ直アップロードし、台帳にはバイト数のみ計上
（`Buffer::External` の画像版）。効果中・工数大きめ。

### R-5. hillshade と raster が同じ pendings 枠を食い合う（小）

`filter_requestable_raster_texture_fragment` の pendings カウントは hillshade 用フラグメントも
同じ `Requested` プールで数える。

## Vector 固有

### V-1. GeoJSON はタイル切り出し＋tessellation が全てメインスレッド同期

`crates/navara_geojson/src/tile/source.rs:35-100` — `prepare_tile` が `vt.get_tile()`（clip/simplify）を同期実行、
`construct_geometry`（tessellation 含む）もメインで実行。MVT は worker 化済み
（`navara_mvt/src/geometry/async_finalize.rs:49` の `spawn_parse_mvt_task`）なのに GeoJSON だけ残っている。
大きい GeoJSON でカメラ移動のたびに数十 ms 級のフレームスパイク。
→ MVT と同じ worker タスク形（packed streams で返す）に載せる。`ParseMvtTileResult` の finalize パスはほぼ再利用可能。

### V-2. 優先度が逆転 — 表示目標タイル＝Low、祖先フォールバック＝Medium

`traverse.rs:194-202`（目標タイル → `Priority::Low`）と `traverse.rs:443-452`（祖先フォールバック → `Priority::Medium`）。
`max_pendings` の枠を祖先が先に埋めるため time-to-full-detail が構造的に遅れる。
→ 「画面に今出せるタイル」を High/Medium、純フォールバックを Low に反転。変更小。

### V-3. 同一 URL ソースが TraversalConfig 違いで pbf を二重ダウンロード

`crates/navara_vector_tile/src/source_cache/resource.rs:55-72` — `SourceId` のハッシュに
`TraversalConfig`（max_zoom, max_sse_bits, has_clamp_to_ground…）が含まれ、これがキャッシュキー。
MVT requester は unmanaged（`navara_mvt/src/data_requester/helpers.rs:30`）なので DataManager の URL dedup も効かない。
→ ソースキャッシュのキーを URL のみにし、TraversalConfig はレイヤー側へ。少なくとも pbf フェッチ層を URL キーで共有。

### V-4. clampToGround の overscale がクアッドツリーを z24 まで肥大させる

`traverse.rs:73-76, 100-102, 168-172` — `has_clamp_to_ground` だと terrain 細分に追随し
`overscaled_max_zoom`（既定 24、`source_cache/resource.rs:21`）までノード生成。
overscaled ノードは描画されず親を再利用するだけなのに 4^depth で増える。
→ overscale はノード実体を作らず「terrain タイル→drape source」対応表（resolve 側）で表現するか、遅延生成。

### V-5. per-tile ECS 間接チェーンとアロケーション（地味だが常時効く）

`traverse.rs:465-487` `get_renderable_feature` が 3 段クエリで `Vec` を 3 回 collect、
内部ノード毎に indices 用 `Vec` を 4 本確保（`traverse.rs:223-228`）。
再トラバースのトリガーも `Changed<Rendered>` が全 `RenderableFeature` 対象（`tile/system.rs:80-82` の TODO どおり
他レイヤーの変化でも発火）。
→ タイル単位の activation 集計を `RenderedTile` にキャッシュして差分更新、indices はビットマスク化、
トリガーにソース別マーカー。

### V-6. タイル境界のラベル/シンボル重複排除・衝突判定なし（品質ギャップ）

collision/dedup 実装なし。MVT buffer 内の重複フィーチャが隣接タイルで二重描画される。
ロード効率には中立だが、cross-tile symbol index＋スクリーンスペース衝突を worker 側で。

## WASM↔JS 境界・イベント系（2026-07-14 追加調査）

### B-1. Events ペイロードが毎アクティブフレーム 2 回ディープクローンされる【境界系で最大】

`read_events`（`crates/navara_wasm/src/lib.rs:158-161`）の `.into()` が `navara_wasm::Events` を構築する際、
全フィールド（String url/extension、各イベント struct の Vec）を所有クローン（1回目、
`crates/navara_wasm/src/event/mod.rs:201-272` の `From` impl）。さらに `Events` は
`#[wasm_bindgen(getter_with_clone)]`（`event/mod.rs:16`）のため、JS 側 `pushEvents`
（`web/navara_core/src/event/EventManager.ts:105-115`）が getter を読むたびに **Vec 全体を再クローン**し、
要素ごとに wasm box + JS wrapper を割り当て（2回目）、消費後に要素ごと `.free()`（`EventManager.ts:130`）。
カメラ移動・タイルストリーミング中は数百 struct × 2 ディープクローン/フレームで、GC 圧と main thread CPU を常時消費。

**改善案**: 2回目のクローンを排除する。(a) `std::mem::take` で Vec を move する take 系アクセサを生やし
JS が各配列を一度だけ読む形にする、または (b) `Events` 全体をフラット/カラムナな transferable バッファ
（ids + typed-array カラム）1 本に serialize して JS 側で decode（コピー 1 回・要素 boxing/free ゼロ）。

**インパクト**: インタラクション/ストリーミング中に高（アイドル時は `read_events` が `None` を返すためゼロ）。

### B-2. `pushEvents` が 18 個のイベント getter を毎フレーム全部叩く

`EventManager.ts:106-113` — `Object.keys(this.stacks)` で全 18 キーの `events[k]` にアクセス。
カメラ移動中は `camera_transform_updated` が毎フレーム存在するため毎フレーム走り、
空の 16-17 getter も FFI 呼び出し + 空 Vec のクローン（使い捨て空配列 alloc）を払う。

**改善案**: B-1 のカラムナ化で自然消滅。暫定なら `Events` に「どの配列が non-empty か」の
ビットマスク getter を 1 本追加し、立っているものだけ読む。

### B-3. mesh_added/updated ごとに全 `Globe`（elevation_colormap 含む）を 2 回クローン

`MeshAdded.globe` / `MeshChanged.globe`（`event/mod.rs:58-59, 71-72`、いずれも `getter_with_clone`）が
`elevation_colormap: Vec<f32>`（`crates/navara_wasm_types/src/globe.rs:41-42`、256×3 級になり得る）を含む
Globe 全体を内包し、`.into()` で 1 回（`globe.rs:85`）、JS の `mesh.globe` 読み（`web/navara_three/src/mesh/tile.ts:661, 1120`）で
もう 1 回クローン。Globe は全タイル同一なのに per-event で送出され、`mesh_updated` は
`max: Infinity` 処理（`event/index.ts:115-117`）のため terrain LOD churn 中に多数/フレーム。

**改善案**: 参照ベースの `GlobeHandler` API（`event/context.ts:124-143`）が既にあるので、
イベントから `globe` フィールドを落とし、`tile.ts` は使用する少数のスカラー
（color/transparent/opacity/wireframe/useNormal）をハンドラ経由で取得。

### B-4. pointer move ごとに `serde_wasm_bindgen` のリフレクションデシリアライズ

`web/navara_three/src/input.ts:35-95`（mousemove/wheel/touchmove）が毎イベントで JS オブジェクトを
新規構築して `core.input(...)` に渡し、Rust 側 `serde_wasm_bindgen::from_value`
（`crates/navara_wasm/src/input.rs:40-43`）が 9 フィールドの `Input` を Reflect ベースでデシリアライズ。
ドラッグ中はポインタイベントレート（60〜120+/s）で発火し、input-to-render レイテンシに直接乗る。

**改善案**: `mouseMove(x, y)` / `wheel(dx, dy, terrainDistance)` / `touchMove(id, x, y)` など
プリミティブ引数の専用 wasm-bindgen エントリポイントを追加（serde 回避 + オブジェクト alloc 回避）。
低頻度の keydown/up のみ汎用 `input(JsValue)` を残す。

### B-5. タスク settle ごとに `getWasmMemoryUsage` の worker 往復（小）

`web/navara_worker/src/recyclingPool.ts:243-257`（onSettled → probeSlot）が settle のたびに
`exec("getWasmMemoryUsage")` の postMessage 往復を追加（slot ごと `probing` フラグで coalesce 済み）。
heap ベース worker recycling の意図的トレードオフ（`recyclingPool.ts:1-29`）だがチューニング余地あり。

**改善案**: K settle に 1 回 or 時間間隔でのプローブ（idle sweep は `recyclingPool.ts:348-361` に既存）、
またはタスク結果メッセージに heap サイズをピギーバックして専用 exec を廃止。

## Three.js レンダリング（2026-07-14 追加調査）

### TR-1. シャドウマップが毎レンダーフレーム強制再描画【高・カメラ操作中】

`web/navara_three/src/passes/CustomRenderPass.ts:142-150` — `renderer.shadowMap.autoUpdate = false`
（`index.ts:836`）で手動制御にしているのに、`render` 内で無条件に `needsUpdate = true` を立てて
globe + mrt + opaque を shadowScene に集めてフルシャドウパスを実行。太陽方向もジオメトリも変わらず
カメラだけが動くフレーム（最頻ケース）でも全キャスターをもう 1 回描画しており、
パン/ズーム中のキャスター頂点・draw 負荷が実質 2 倍。

**改善案**: `needsUpdate` をシャドウ関連の実変更（ライト方向変更、キャスター add/remove）の
dirty シグナルで駆動し、カメラのみのフレームでは false のまま。

**試行→リバート（2026-07-14）**: `RenderFlag.shadowNeedsUpdate` を新設し、カメラ/mesh/feature
イベント処理＋`forceUpdate()` でフラグを立てる実装を入れたが、Custom Mesh（`MeshDesc` 系のユーザー
提供オブジェクト）がイベントフローの外で自由に変化し得るため dirty 検知の網羅が複雑になる、
との判断でリバート。なお SunLight は CSM でカスケードがカメラ追随のため、スキップできるのは
「カメラ静止中のテクスチャストリーミング等」のフレームに限られ、当初想定より効果は小さい。
再挑戦するなら `preRender` フックでユーザーが明示的に `shadowNeedsUpdate` を立てる opt-in API 形式か、
three r160+ の `childadded`/`childremoved` イベント併用で。

### TR-2. シーン/タイルメッシュの matrixAutoUpdate が無効化されていない

6 つの `Scene`（`src/orchestrators/RenderPassOrchestrator.ts:27-34`）も TileMesh（`src/mesh/tile.ts`）も
バッチ feature メッシュ（polygon/polyline/sdfText/instancedSprite）もデフォルトのまま
（無効化しているのはユーザー提供 `MeshDesc` 系のみ、`core/MeshDesc.ts:326-327`）。
`renderer.render` ごとに `scene.updateMatrixWorld()` が全子を再帰し静的メッシュの行列を再合成。
CustomRenderPass は同一コンテンツを複数回 render（shadow / globe / mrt / opaque）するため
可視タイル + feature 数 × 2〜3 回/フレームの純粋な無駄。

**改善案**: 長寿命シーンに `matrixWorldAutoUpdate = false` を設定しフレーム 1 回だけ
`updateMatrixWorld()`、またはタイル/feature メッシュに配置直後 `matrixAutoUpdate = false`
（タイルは RTC/頂点で位置決めされ transform は identity のため即静的化可）。

### TR-3. `vectorSignature()` が可視 terrain タイルごとに毎フレーム文字列構築

`src/mesh/tile.ts:376-392`、`_onBeforeRender`（`tile.ts:410`）から無条件呼び出し。
slot × source ごとに `findSceneByLayerId` の Map lookup + template string 構築 + join を行い
前回値と文字列比較。draped タイル多数で毎フレーム数千の一時 string/iterator alloc → GC 圧。
これが守る再ベイク自体は dirty ゲート済み（`tile.ts:411, 423`）で、文字列は変更検知のためだけに存在。

**改善案**: 数値比較に置換 — scene 側の `revision`（`scene.ts:26, 97`）を per-slot に集計した
整数比較、または `refreshVectorSlots`/`markDirty` からの dirty フラグで O(1) チェック化。

### TR-4. light Group が render 呼びごとに add/remove される（小〜中）

`CustomRenderPass.ts:118-126` `_renderWithLight` が毎回 `scene.add(light)` → render →
`scene.remove(light)`。共有 light Group が 4〜5+ 回/フレーム（draped があればさらに）再ペアレントされ、
children 配列変異 + added/removed イベント + world matrix dirty 化（TR-2 に還流）を毎回払う。

**改善案**: 各シーンに常駐のライトを持たせるか、add したまま `visible` トグルで制御。

### TR-5. draped stencil パスが feature ごとに 3 render + 再ペアレント

`CustomRenderPass.ts:261-278` `_renderDrapedMesh` + `src/mesh/DrapedMesh.ts:41-81` — draped feature
1 件ごとに drapedScene → drapedTempScene へ再ペアレントし、back/front/final の 3 回
`_renderWithLight`（各回 TR-2/TR-4 のコストも同伴）。clampToGround feature N 件で 3×N render 呼び。

**改善案**: material/stencil 設定が同じ feature をグルーピングして stencil パスを共有（3×N → 3×グループ数）、
per-child add/remove は visible トグルに置換、TR-2/TR-4 と併せて定数係数を削る。

### TR-6. RTE `onBeforeRender` の `calcCameraPosition` が毎メッシュ毎フレーム新規オブジェクト返し（小）

`src/mesh/rtcRteHelper.ts:61-66`（+ `instancedSprite.ts:372-381`、`sdfText.ts:321-336` の同型）—
行列テンポラリはプール済みだが `calcCameraPosition` の戻り値 `{high, low}` は毎回新規で、
RTE feature メッシュ数 × フレームの steady な garbage。

**改善案**: 直前行の `calcModelMatrixRTE(..., out)` と同じ out-param 版
`calcCameraPosition(..., outHigh, outLow)` を追加。

## Rust ECS 常時コスト（2026-07-14 追加調査）

### N-1. clampToGround polygon が毎フレーム再計算 + `Changed<RenderableFeature>` 発火【実バグ級】

`crates/navara_feature/src/polygon/system.rs:224-287` `update_height_by_terrain` — clamp_to_ground な
polygon はガード（239 行 `!material.clamp_to_ground && !should_recalculate_height`）を素通りし、
毎フレーム `feature.as_mut()`（249 行）→ `Changed` 発火 → `event::commit`
（`crates/navara_feature/src/event.rs:21-23`）が `renderable_feature_changed` に積み、
JS 側がその feature を毎フレーム再同期。`min_max_heights` の Vec alloc + AABB/bounding sphere
再計算も毎フレーム。タイル由来は `should_be_texturized` で逃げるが、非タイル（GeoJSON）の
clampToGround polygon は恒久的に対象。3DT-1 と同型の「無条件書き込みが Changed を回し続ける」パターン。

**改善案**: polyline 側の実装をミラー — `polyline/system.rs:163-219` は
`Query<&TileMeshMarker, Added<TileMeshMarker>>` を取り、新 terrain タイルが着地していないフレームは
skip（182 行）。point/billboard/text も同様のゲート済みで、polygon だけ欠落している。

### N-2. `sync_retained_bytes` が retention cache 全体を毎フレーム合算

`crates/navara_ecs/src/memory.rs:273-294`（PostUpdate 毎フレーム、`app.rs:91-94`）—
terrain / raster / 3D Tiles / vector の retained pool（`FxHashMap` で予算いっぱいなら数百〜数千 entry）を
`values().map(|e| e.cost.total()).sum()` で full-scan。他の台帳フィードは
`BufferStore::total_bytes()`（`crates/navara_buffer_store/src/store.rs:73`）や
`BatchTable::total_bytes()` のように O(1) の維持カウンタで、retained 合計だけ毎フレーム再計算。
キャッシュ占有が大きい（= 既に負荷が高い）ときほど重くなる。

**改善案**: 各 cache manager に insert/evict/remove で更新する running `retained_bytes` カウンタを持たせ、
`sync_retained_bytes` は O(1) 読みの 4 加算に。

### N-3. terrain upsample が頂点ごとに `format!` String キーを作る

`crates/navara_geometry/src/terrain/upsample/mod.rs:420-445` `ClippedCoordMap` — dedup map が
`FxHashMap<String, usize>` で、`get`（428 行）と `insert`（431 行）がそれぞれ
`format!("{}_{}_{}",...)` の String を alloc。upsample はズーム/パン中の refine で頻発し、
数千頂点 × 最大 2 alloc + string hash。単一スレッド WASM ではフレームヒッチに直結。

**改善案**: 成分は u16 (u) / u16 (v) / u32 (h.to_bits()) なのでパック整数（u64）キーの
`FxHashMap<u64, usize>` に。同パスの `new_indices.append(&mut v.to_vec())`
（`construct_polygon` 389, 398, 406 行、三角形ごとに使い捨て Vec）も `extend_from_slice(&v)` に。

## 着手順のおすすめ

| 規模 | 項目 |
|---|---|
| すぐ効く小変更（1 日級） | R-1（revoke）、R-3（mipmap off）、3DT-1（値比較）、横断 2 の demote 部分、横断 4 の Priority Hints、V-2（優先度反転）、TR-1（shadow dirty ゲート）、N-1（polygon ガード追加）、N-3（整数キー化）、TR-6（out-param）、TR-3（signature の数値化） |
| 費用対効果が高い中規模 | 横断 5（失敗リトライ）、横断 1 の terrain ゲート条件限定、R-2（アトラスプール）、横断 3（待機列方式）、N-2（running counter）、TR-2（matrixAutoUpdate 整理）、B-3（Globe 参照化）、B-4（input 専用エントリ）、TR-4（light 常駐化） |
| 大物（設計が必要） | 横断 1（skip-LOD 本体）、横断 2 の 3D Tiles REPLACE 切替、T-1（dynamicScreenSpaceError）、横断 4（グローバル RequestScheduler）、B-1/B-2（Events カラムナ transferable 化）、TR-5（draped バッチ化） |

傾きビュー過剰ロードの宿題は「3D Tiles REPLACE 切替から画面外兄弟を除外」＋「demote」＋「dynamicScreenSpaceError」の組で解消する筋。

## 実装プラン

### 進捗（2026-07-14 実装済み）

- **N-1（clampToGround polygon の毎フレーム Changed 発火）: 修正済み** — 調査の結果、polygon は
  polyline と違い terrain 高さをサンプリングせず（クランプ高は spawn 時固定の楕円体面距離
  `distance_to_center_from_ellipsoid_surface` から導出）、入力の material 変更は全経路で
  `should_recalculate_height = true` を立てることを確認。ガードをフラグのみに単純化し、
  clamp_to_ground の毎フレーム `as_mut()` を完全に排除（`Added<TileMeshMarker>` ゲートすら不要だった）。
- **B-1（Events の 2 回目ディープクローン排除）: 実装済み** — `navara_wasm::Events` のフィールドを
  private 化し、`take_*` メソッド（`std::mem::take` で move、クローンなし）に一本化。
  `EventManager.pushEvents` は `take_${key}()` を呼び、`JsEvents` 型は take メソッドの戻り値から導出。
  テストモックは Proxy で take 形状を再現。1 回目のクローン（`.into()` での owned 化）は ECS 借用の
  materialize として必要なので残る。B-2（空 getter 18 本）は take でも FFI 回数は同じだが
  空 Vec の move はクローンなしなので実害は微小、ビットマスク化は見送り。
- **R-1（Object URL リーク + main thread デコード）: 修正済み** — `AbortableImageLoader` を
  `createImageBitmap(blob, {imageOrientation:"flipY", premultiplyAlpha:"none"})` 移行
  （オフメインスレッドデコード、object URL 自体を廃止）。非対応ブラウザは `<img>` フォールバックで
  全経路 revoke。`AbortableTextureLoader` は ImageBitmap 時に `flipY=false`（orientation はデコード時に
  焼き込み済みのため `<img>` 経路と同一の GPU 内容）。ImageBitmap の明示 `close()` は
  「dispose 済みテクスチャの再ベイク再アップロード」経路で例外化するリスクがあるため見送り（GC 任せ）。
- **R-3（フラグメント mipmap off）: 修正済み** — `processTextureFragmentRequested` で
  `generateMipmaps=false` + `minFilter=LinearFilter`。
- **R-2（MRT アトラスプール）: 実装済み** — `TileTextureCache` に上限付き free-list
  （既定 4 枚 ≈ 12.6MB）。acquire は pool 優先、全 dirty 開始なので再利用時の明示クリア不要
  （初回ベイクが `_onBeforeRender` で描画前に走るため stale 表示なし）。プール滞留分は
  per-tile 台帳会計の外なので上限は小さく維持。`pooledCount` を stats 用に公開。
  台帳への pool bytes 計上は宿題。
- **TR-1（shadow dirty ゲート）: 実装 → リバート** — TR-1 節の追記参照。

### 進捗（2026-07-13 実装済み）

- **3DT-1（変更検知の値比較）: 修正済み** — `toggle_rendered_tile_visible`
  （`crates/navara_cesium3dtiles/src/cesium3dtiles/traversal.rs`）で書き込み前に値比較。
  カメラ・SsePressure 側の書き込みはすべてガード済みであることを確認したので、静止時は
  `needs_update` が立たなくなり全ツリー再帰が止まる。
- **2c（フラスタム外タイルの demote）: 実装済み・ブラウザ目視 OK（2026-07-13）** —
  `Priority::demote()`（`navara_component/src/priority.rs`）を terrain（hillshade/通常/Extreme の
  3箇所）、raster（Medium→Low）、vector（目標 Low→VeryLow・フォールバック Medium→Low）に適用。
  当初 2b と同時に入れて「親チラつき」が出たが、主因は 2b（REPLACE 切替の変更）で、
  2b リバート後の単体再適用ではチラつきなしを目視確認済み。
- **2b（REPLACE 切替から画面外兄弟を除外）: 実装 → 全リバート（2026-07-13）** — 2c リバート後も
  親チラつきが残るとの報告を受け撤回（`mark_for_preload`・culled ゲートを復元）。パン中は
  フラスタム先端で未ロード子が次々入ってくるため、preload なしだと親↔子スワップが縁で
  連発して見える。再挑戦案: culled 兄弟の「フェッチだけ」残して切替ゲートから外す
  （`mark_rendered_tiles` の `!is_visible` 分岐でも request する = レンダリングはしないが
  ロードは進む）、またはスワップに猶予フレームを入れる。
- **Phase 0（terrain `parent_mesh_ready` ゲート限定）: 実装済み** — ゲート導入コミット #601 の
  意図（DEM 失敗タイルの flat fallback 抑止）を保ったまま、「自前 DEM が Success の子」は
  親メッシュを待たずに spawn。upsample 系の子は `is_parent_ready`（= 親 `cached_mesh_handle`
  必須）で従来どおり自己ゲートされる。深ズーム初期表示のレベル直列待ちが解消（要目視確認:
  スカート/クラック）。
- **2a（dynamicScreenSpaceError）: 実装済み** — `navara_fog::DynamicSse`（Fog と同一エンティティ、
  既定 ON: density 2e-4 / factor 24 / heightFalloff 0.25 / 0–8000m、CesiumJS 1.108 既定と同値）。
  各トラバースがカメラから `DynamicSseTerm` を毎回計算（真下=ゼロ、水平＋低空=最大）し、
  terrain/raster/vector の `calc_sse` と 3DT `mark_leaves` で第2減算項として適用。
  JS API: `Core.setDynamicSse` / ThreeView `dynamicSse` オプション＋ setter
  （`getDefaultDynamicSse`）。factor は実測で 8–24 の範囲でチューニング予定。

### プラン2: 傾きビュー過剰ロード対策（3点セット）

**Fog SSE 減衰では代替にならない理由（調査済み）**: 現行は
`sse -= fog(distance, density) * sse_factor`（terrain: `navara_tile_component/src/tile.rs:123-124`、
3DT: `traversal.rs:239-240`）で、density=2.0e-4 / sse_factor=2.0 が**静的**・**距離のみの関数**。

- 減衰量は d=2km で 0.30px、d=5km で 1.26px、15km 以遠で飽和して最大 2.0px。
  傾きビューのタイル爆発は数百 m〜数 km の中距離帯で起きるが、そこにほぼ効かない。
- 効かせようと density / sse_factor をグローバルに上げると、真下視点（distance≈高度）でも
  一律に LOD が落ち、見たいタイルの品質が下がる。静的パラメータでは傾きビューと真下ビューを両立できない。
- CesiumJS の dynamicScreenSpaceError は**同じ減算式**で、係数（density）をカメラ高度と視線傾斜から
  毎フレーム再計算するもの（真下向き→ほぼゼロ、水平＋低高度→強）。CesiumJS 1.108 で既定 ON になった際の
  factor 既定値は 24.0 — 現行 fog の 2.0 より一桁大きい減衰を「傾いたときだけ」入れるのが本質。

**2a. dynamicScreenSpaceError（terrain + 3D Tiles 共通）**

1. `navara_fog`（または `navara_camera`）に `DynamicSse { density: FloatType }` リソースを追加し、
   毎フレーム 1 システムでカメラから計算: カメラ楕円体高 h（`system.rs:306-309` で計算済みの値を再利用）と
   視線傾斜 t = 1 − |view·up|（局所 up との内積）から
   `density = base_density * falloff(h) * ramp(t)`。真下（t≈0）で 0、地表近く＋水平で最大。
   Cesium の `dynamicScreenSpaceErrorDensity` 計算（heightFalloff=0.25）を移植。
2. SSE 計算 2 箇所（`Tile::calc_sse` と 3DT `mark_leaves`）に第2減算項
   `sse -= fog(distance, dyn.density) * dyn.factor` を追加。既存の LOD fog はそのまま残す。
3. JS API `setDynamicSse({enabled, factor, heightFalloff})` を `setLodFog` と同型で追加
   （`LodFogConfig` のバッファリングパターンを踏襲）。既定は enabled、factor は 8〜24 で実測調整。
4. トリガー: `DynamicSse` はカメラ変化時のみ書き込み（値比較ガード）。カメラ静止時に再トラバースを誘発しない。

回帰リスク: リバートされた可視部分ベース SSE と違い overscale 判定（`is_over_max_zoom` 系）に一切触れず、
実効しきい値を動かすだけなので低い。検証は傾きビュー/真下ビューでの ledger stats（タイル数・バイト数）比較。

**2b. 3D Tiles: REPLACE 切替から画面外兄弟を除外**

- `mark_leaves` の子ループ（`traversal.rs:358-372`）: culled な子（`!child_tile.state.is_visible`）は
  `all_children_rendered` の集計で「準備完了扱い」にし、`any_child_in_frustum` にも数えない
  （現状は culled でも Selected なら true になっており誤り気味）。
- `mark_for_preload`（`traversal.rs:380-389, 417-432`）を削除、または `preload_when_hidden`
  オプション（既定 off）に格下げ。
- 検証ポイント: カメラ回転で culled → in-frustum になった子のロード中、親が retention pool /
  `touched` 維持で復元表示されること（穴が出ないこと）。`traversal.rs` 内の preload 系テスト
  （~1020-1040 行）の期待値更新。

**2c. フラスタム外タイルの優先度 demote（数行）**

- terrain: `navara_tile/src/tile/traverse.rs:431-452` の culled パスを `Priority::Extreme → High` に。
- raster: `raster/traverse.rs` で `is_culled_by_frustum`（137 行）の判定を request（108-119 行）の前に移すか、
  culled は `Medium → Low` に。
- vector / 3DT も同様の 1 段 demote。挙動（親の穴埋め用フェッチ自体）は変えない。

実施順: 2c（即日）→ 2b → 2a。2b と 2a が本体で、宿題「傾きビュー直下タイル過剰ロード」はこの組で解消を狙う。

### プラン1: skip-LOD（フェーズ分割）

**Phase 0 — terrain の `parent_mesh_ready` ゲート限定（即効・1条件）**

- `navara_tile/src/tile/traverse.rs:372-374` — 現在は `!use_terrain || parent_mesh_ready` が
  **全子タイル**の entity spawn を止めている。これを「親メッシュからの upsample が必要な子
  （`should_overscale` または terrain fetch 失敗）」だけに限定し、自分の DEM を持つ子は親を待たずに spawn。
- 事前確認: `spawn_tile_entity` → メッシュ構築パスが親メッシュ（`ready_parent_tile_handle`）を
  upsample 時以外に参照していないか。スカート/クラック処理が親メッシュ前提でないか（目視確認必須）。
- 効果: 深ズームの初期表示が「レベル数 × メッシュ化レイテンシ」の直列待ちでなくなる。

**Phase 1 — vector: 中間レベルをフェッチしない（MapLibre 方式）**

- `navara_vector_tile/src/tile/traverse.rs:437-455` の祖先フォールバック fetch を
  「ロード済み祖先が Δz 以内に存在しない場合のみ」に制限（まず Δz=∞ ＝ フォールバックは
  既ロードのものだけ使い新規フェッチしない、で開始）。
- 深ズームジャンプ時は「最後にロード済みだった粗いレベル」が表示され続け、目標レベルが直接届く。
  MapLibre と同じ挙動で、vector はテクスチャと違い拡大表示の見た目劣化が小さい。
- 合わせて優先度反転（V-2: 目標タイル Low → High）を同時に入れる。

**Phase 2 — raster: アンカーレベル方式**

- `navara_tile/src/raster/traverse.rs:104-119` — 降下パス全レベル要求をやめ、
  「目標レベル + z%3==0 のアンカーレベル + ロード済み祖先が Δz 以内になければ補充」に。
- 受け側の `resolve_loaded_tile` walk-up は任意の祖先距離対応済みのため変更不要。
  ズームアウト時のフォールバック品質は Δz=2〜3 から実測調整。

**Phase 3 — 3D Tiles: 簡易 skipLevelOfDetail（設計が必要・最後）**

- 第一歩: `sse > max_sse * skip_factor`（例 skip_factor=16）の中間タイルはコンテンツ要求をスキップし
  描画候補にもしない。REPLACE の切替条件 `all_children_rendered` が「直接の子」前提なので、
  スキップされた中間タイルは「子孫がカバーしたら rendered 扱い」にする再帰判定が必要 — ここが本体。
- 表示の穴埋めは「ロード済みの最も近い祖先を維持表示」（現行の parent-stays-until-children-ready
  機構を祖先距離 >1 に一般化）。
- Phase 0〜2 と 2a/2b の効果を実測してから着手判断（PLATEAU 級の深いツリーで転送量数分の1の見込み）。

## 変更不要と判断した点（調査済み）

in-flight フェッチの abort 伝播（`Deleted` → `data_requester_removed` → JS `AbortController.abort()`）、
DataManager の URL 重複排除（byte range 込み）、(Priority, OrderByDistance) 二次ソート、
terrain の親→子スワップの原子性（穴が開かない設計）、retention pool＋距離/訪問時刻順 eviction、
in-flight 予約会計（ReservedCost）、MVT の in-flight パースキャンセル・stale result 破棄・pbf の JS 側ゼロコピー化。

2026-07-14 追加調査でクリーンと確認した点:

- **境界/イベント**: ジオメトリの境界越えは zero-copy（adopt*/`Buffer::External`）済みで二重コピー残存なし。
  terrain 属性は `mesh/tile.ts:862-925` で JS 所有 BufferAttribute へちょうど 1 回コピー。
  worker 結果は `workerpool.Transfer` で transferable。アイドル時は `read_events` が `None`
  （`navara_event/src/events.rs:198`）でイベントマーシャリングなし。render loop の per-frame FFI は
  `update`/`readEvents`/`vectorRevision` の 3 本のみ（per-tile の `vectorRevision` は hoist 済み）。
  stats/メモリサンプリングは 1/sec ゲート済み（`stats.ts:80-84`）。
- **Three.js**: picking の `readRenderTargetPixels` 同期ストールはクリック時のみで per-frame ではない。
  tile の `customProgramCacheKey`（JSON.stringify 含む）はプログラム再コンパイル時のみ呼ばれ、
  material `needsUpdate` は change ゲート済み（`tile.ts:1178-1180`）。atmosphere / SkyEnvMap /
  tileComposite（MRT ベイク）はいずれも dirty/empty ゲート済み。material は共有 enhancer +
  `customProgramCacheKey` でプログラム再利用されており per-tile シェーダコンパイルストームなし。
  draw call は batchedFeature/InstancedMesh でバッチ・インスタンス化済み。
- **Rust ECS**: camera の `update_frustum`/`commit` は `Changed<Transform>` ゲート済みでアイドル時に
  spurious Changed なし。fog は `config.is_changed()` early-return。occluder は `Changed<Transform>` ゲート。
  `SsePressure` は書き込みガード済み。point/billboard/text の height 系は
  `should_recalculate || should_update_for_changed_terrain`（`Added<TileMeshMarker>`）でゲート済み
  （polygon のみ欠落 = N-1）。skirt 生成は境界エッジのみ・整数キー FxHashMap で問題なし。
  `attach_terrain_mesh_cost` は `Added<Mesh>` ゲート済み。
