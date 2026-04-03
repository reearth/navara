---
title: Libraries
description: A guide in my new Starlight docs site.
sidebar:
  order: 3
---

## navara_three

- `navara_wasm`と Three.js を接続する JavaScript ライブラリ
- `ThreeView`クラスを通じて、地形・地物・ポイント等を描画
- WASM の初期化・データ読み込み・シーンへの反映を非同期で管理
- JS アプリケーションから地図表現を柔軟に制御できる
- 詳しくは [navara_three](../../../three/introduction/what-is-navara-three/) のページへ

## navara_wasm

- Rust 製の GIS エンジンを WASM 化したモジュール
- Web ブラウザ上で高速・安全に GIS 処理を実行可能
- 座標変換、LOD 制御、空間インデックス、タイル管理などを担当
- Bevy ECS によりプラグイン単位で処理を整理・実行
- 詳しくは [navara_wasm](../../../wasm/introduction/what-is-navara-wasm/) のページへ

## navara_three_api

- `navara_wasm_api`と Three.js を接続する JavaScript ライブラリ
- 座標変換のような GIS 処理を独立して実行可能
- レンダリングエンジンと GIS 計算処理を高度に連携可能
- 詳しくは [navara_three_api](../../../three/introduction/what-is-navara-three-api/) のページへ

## navara_wasm_api

- Rust 製の GIS 処理モジュールを独立した API として WASM 化したモジュール
- Web ブラウザ上で高速・安全に GIS 処理を実行可能
- 座標変換、楕円体幾何計算などを独立して実行可能
- 詳しくは [navara_wasm_api](../../../wasm/introduction/what-is-navara-wasm-api/) のページへ
