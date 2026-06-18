# 固有選手(シグネチャー)のモチーフ画像

このフォルダに `<id>.png` を置くと、`build.py` が自動で base64 データURI化して
`index.html` に埋め込みます(オフライン単一HTMLを維持)。`<id>` は
`src/js/data.js` の `SIGNATURES` 配列の各要素の `id` と一致させてください。

例: メッシ → `messi.png`(`SIGNATURES` に `id:"messi"` があるため)

## 画像の推奨仕様
- **1ポーズだけ**を切り出した画像(複数ポーズが1枚に入っているものは不可)。
- **背景は透過**(PNGアルファ)推奨。白背景のままだとカード上で白い箱に見えます。
- 縦長〜正方形。カード内では縦横比を保ったまま縮小し、下端をそろえて中央配置します。
- 目安サイズ: 高さ 200〜400px 程度。`.webp` / `.jpg` も可(透過が必要なら png/webp)。

## 仕組み
- `build.py` の `_sig_block()` が `src/assets/signatures/*.png` を走査して
  `window.SIG_IMG={ "messi": "data:image/png;base64,..." }` を生成し、JSバンドル先頭
  (`"use strict";` 直後)に注入します。
- `data.js` がこれを `SIG_IMG_EL`(Imageオブジェクト)としてプリロードし、
  `spriteCanvas` が `c.sig` のカードでこのモチーフ画像を描画します。
- 画像が未配置でも動作します(★エンブレムのプレースホルダ表示)。

## 新しい固有選手を追加する手順
1. `src/js/data.js` の `SIGNATURES` に1要素追加(id/名前/国籍/ポジション/固定ステ/スキル)。
   - 6ステ合計=100・いずれか1つ以上を20に。
2. このフォルダに `<id>.png` を置く。
3. `python build.py` を実行 → ブラウザで確認。
