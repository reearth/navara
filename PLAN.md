# MVT パース処理の Web Worker 化 実装プラン

## 目的

`construct_geometry_multi_layer` 周りの MVT パース処理（pbf デコード → 座標投影 → 頂点集約）を、
Polygon の geometry 構築（`construct_polygon_batched_feature`）と同様に Web Worker で行う。

**理想フロー:**
1. pbf バイナリをそのまま Web Worker にゼロコピーで transfer
2. Web Worker で parse（decode + 投影 + 頂点集約）
3. geometry の頂点のみをゼロコピーで transfer し、`navara_feature` に送る

## スコープの決定事項

- **worker で行う範囲**: パースのみ（decode + 投影 + 頂点集約）。その後の三角形分割
  （`construct_polygon_batched_feature` 等）は既存の別 worker タスクのまま維持する。
- **パースコアの配置**: 既存の lean な `navara_parser` クレット（bevy_ecs 非依存・geozero 有り・
  既存 `mvt` モジュール有り）に ECS 非依存のパースコアを配置する。

---

## 現状アーキテクチャ（調査結果）

すべてメインスレッド `navara_wasm` 内で同期実行されている:

1. pbf バイトは JS 側で fetch → メインスレッド WASM の `BufferStore` に handle で格納
   （`web/navara_three/src/event/index.ts:538-566`）
2. `transfer_mesh` システム（`navara_vector_tile/src/tile/system.rs:216-275`）
   → `MvtSource::construct_geometry`（`navara_mvt/src/source.rs:72-98`）
   → `construct_geometry_multi_layer`（`navara_mvt/src/geometry/process.rs:39-76`）
3. その中で:
   - `MvtTile::decode`（geozero/prost）
   - レイヤーごとに `MvtFeatureProcessor`（geozero の `GeomProcessor`）がジオメトリコマンドを走査、
     `PosConverter`（`navara_vector_tile/src/pos_converter.rs`）でタイル座標→地理座標へ投影、
     `MvtGeometryBuilder`（`navara_mvt/src/geometry/builder.rs`）へ集約
   - `MvtGeometryBuilder` は純粋な Vec 集約器（`GeometryGroups`）へ入れる**と同時に**
     `BatchTable`（ECS リソース）へ batch_id/global_batch_id 割当・タグ格納
   - `groups.finalize(commands, buf, ...)`（`navara_feature_component/src/geometry_builder.rs:304-359`）で
     `BufferStore` へアップロード + ECS エンティティ spawn

### 移行の要となる 2 点

- **クレット階層**: パースコアは重い `navara_mvt`（bevy_ecs 依存）にあり、小さく保つべき
  `navara_wasm_worker` からは呼べない → ECS 非依存のコアを `navara_parser::mvt` へ抽出する。
- **BatchTable 結合の分離**: 集約フェーズが `BatchTable`（ECS）と絡んでいる。集約を純粋化し、
  batch_id/global_batch_id 割当とタグ登録はメインスレッドの finalize に遅延させる。

### 好都合な事実

- `PosConverter` は完全に ECS 非依存（`geo_types`/`navara_core`/`navara_math` のみ）→ 移設可能
- 集約器（`PointGeometryAccumulator`/`PolylineGeometryAccumulator`/`PolygonGeometryAccumulator`、
  `navara_feature_component/src/batched_geometry.rs`）は既に純粋 Vec ベース。
  `navara_wasm_worker` は既に `navara_feature_component` に依存済み（`construct_polygon_feature` を呼ぶ）
  → 集約器は worker から到達可能
- ゼロコピーは 2 箇所で独立に発生する:
  - (a) JS↔WASM 線形メモリ: `navara_wasm_types/src/view.rs` の `transfer_*_array` ヘルパ
    （WASM メモリへの直接ビュー、`memory.grow` 後の失効に対応済み）
  - (b) スレッド間 `postMessage` の transfer list
- 委譲 Parameters はバッファを載せず handle/entity 参照のみ運ぶ設計 → MVT でも
  「pbf の BufferStore handle」を Parameters で運び、JS 側で Uint8Array に解決して worker へ transfer

---

## 実装プラン（フェーズ）

### フェーズ 1: パースコアを `navara_parser::mvt` へ抽出（ECS 非依存化）

1. **`PosConverter` を移設**: `navara_vector_tile/src/pos_converter.rs` → `navara_parser/src/mvt/pos_converter.rs`。
   `navara_parser` に `navara_core`/`navara_math` 依存を追加。`navara_vector_tile` は `navara_parser` から
   re-export して既存利用箇所を非破壊に保つ。
2. **パースコア関数を新設** `navara_parser/src/mvt/parse.rs`:
   - `MvtFeatureProcessor`（process.rs から移設。ECS 非依存）
   - `BatchTable` を触らない純粋な集約器を新設（現 `MvtGeometryBuilder` のうち ECS 非依存部分）。
     出力は「(layer_id, kind) ごとの `AccumulatedGeometry` + `feature_tags: Vec<Vec<u32>>` +
     `keys`/`values`」。global_batch_id 割当はせず、アイテム数のみ保持。
   - トップ関数 `parse_mvt_tile(mvt_bin, xyz, tile_extent, matched_layers) -> Vec<ParsedLayerGroup>` を提供。
   - `navara_parser` に `navara_material`（Appearance 判定用）依存を追加（lean か要確認）。
3. **既存ユニットテストを移植**: process.rs の豊富なテスト群（zigzag/command 生成〜検証）を、
   ECS に依存しない形でコア側へ移す。

### フェーズ 2: メインスレッド側 finalize の分離

4. `navara_mvt` の `MvtGeometryBuilder`/`process_layer_multi` を、コア呼び出し + finalize の 2 段に再構成。
   finalize 側で `BatchTable::init_mvt` / `gen_global_batch_id`（範囲割当）/ `acc.into_component(buf)` /
   `spawn_batched_entity` / タイル handle・order・marker 付与 を担当。同期パスは当面維持（回帰防止）。

### フェーズ 3: transferable 型と worker WASM 関数

5. **transferable 型を定義** `navara_wasm_types/src/feature/mvt/`: `TransferablePolygonBatchedFeature` と同様に、
   パース結果（outer_rings/holes/points/coords=f64、sizes/batch_indices=u32、winding_orders=u8、
   encoded points=f32）をゼロコピー transfer で返す型 + `keys`/`values`/`feature_tags`（構造化クローン）。
6. **worker WASM 関数** `navara_wasm_worker/src/task/parse_mvt_tile.rs`:
   `#[wasm_bindgen(js_name = parseMvtTile)]`。入力はゼロコピーの pbf `Uint8Array` + xyz/extent/appearance 記述。
   `navara_parser::mvt::parse_mvt_tile` を呼び、結果を transferable で返す。
   `navara_wasm_worker` に `navara_parser` 依存を追加。

### フェーズ 4: worker タスク配線（既存 5 ファイルパターン踏襲）

7. `navara_worker/src/tasks/parse_mvt_tile/`（component/delegated_task/mod/delegated_system/system）
   + `DelegatedWorkerTasksParameters`/`Result` に variant 追加 + `WorkerPlugin` に system 追加
   + `handle_completed_event` に arm 追加（委譲中破棄時のバッファクリーンアップ含む）。
8. `navara_wasm/src/event/worker/`: boundary 構造体（task/parse_mvt_tile.rs）+ Option フィールド
   + with-constructor + `trigger_worker_task_completed` arm。
9. **TS 配線**: `@navara/worker` `commonTasks` に `parseMvtTile` 追加
   + `web/navara_worker/src/tasks/parseMvtTile.ts` + `web/navara_three/src/tasks/parseMvtTile.ts`
   （queueTask + transfer list）+ `event/worker.ts` の `processWorkerTaskDelegatedEvent` 分岐
   + 結果を BufferStore へ再登録して `triggerWorkerTaskCompleted`。

### フェーズ 5: MvtSource を非同期委譲へ切替

10. `MvtSource::construct_geometry`（と `MvtPmtilesDecoder`）を、インライン `construct_geometry_multi_layer`
    呼び出しから **parse-mvt 委譲タスクを spawn** する形へ変更（pbf handle + params 搬送）。
    完了イベントでフェーズ 2 の finalize を実行しエンティティ生成。
    `transfer_mesh` → `RenderedTile.feature_ids` のリンクを非同期化
    （terrain/polygon タスクと同じ `WorkerTaskCompletedEvent` パターン）。
11. **全ワークフロー実行**: `cargo make build-example` / `format` / `lint` / `test`（web 含む）。

---

## リスクと進め方

- **フェーズ 5 の非同期化がリスク最大**。現在 `construct_geometry` は同期でエンティティを返し
  `RenderedTile` に紐づけている。既存の terrain/polygon 委譲と同じ非同期パターンに載せるが、
  タイルのライフサイクル（委譲中にタイルが破棄された場合のクリーンアップ等）への影響確認が必要。
- **推奨する進め方**: 段階的に進めるため、**フェーズ 1〜2（コア抽出と finalize 分離、同期パス維持）を
  先にマージ可能な単位**として実装し、動作確認後にフェーズ 3〜5 へ進む。

---

## 主要ファイル参照

### Rust
- パース本体: `crates/navara_mvt/src/geometry/{process.rs, builder.rs, mod.rs}`
- 集約器: `crates/navara_feature_component/src/{batched_geometry.rs, geometry_builder.rs}`
- 投影: `crates/navara_vector_tile/src/pos_converter.rs`
- MVT source: `crates/navara_mvt/src/{source.rs, pmtiles_decoder.rs, data_requester/helpers.rs}`
- パースコア配置先: `crates/navara_parser/src/mvt/{mod.rs, layer.rs}`
- worker ECS: `crates/navara_worker/src/{lib.rs, delegated_task.rs, system.rs, component.rs, tasks/}`
- worker WASM: `crates/navara_wasm_worker/src/{lib.rs, task/}`
- WASM 境界: `crates/navara_wasm/src/event/worker/{mod.rs, task/}`, `crates/navara_wasm/src/lib.rs:391-427`
- transferable 型: `crates/navara_wasm_types/src/{view.rs, feature/polygon/}`

### TypeScript
- worker プール: `web/navara_worker/src/{pool.ts, manager.ts, worker/, tasks/, helpers/}`
- ディスパッチ/グルー: `web/navara_three/src/event/{worker.ts, index.ts}`, `web/navara_three/src/tasks/`
