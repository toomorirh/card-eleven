# 固有選手(シグネチャー)のモチーフ画像

## フォルダ構成
- **`src/assets/signatures/` 直下**: 使用中の**切り出し済み** `<id>.webp`(または `.png`)。
  ここに `<id>` を置くと `build.py` が base64 データURI化して `index.html` に埋め込みます
  (オフライン単一HTML維持)。`<id>` は `src/js/data.js` の `SIGNATURES` の `id` と一致させます。
- **`src/assets/signatures/raw/`**: **生ソース**(複数ポーズが横並びの `ce_pyXX_*.png` 等)。
  クロップの元画像を集約。`build.py` は直下しか走査しない(非再帰)ため、raw は**埋め込まれません**。
- (エモーショナルも同様に `src/assets/emotionals/` 直下=クロップ、`emotionals/raw/`=生ソース)

例: メッシ → 直下 `messi.webp`(`SIGNATURES` に `id:"messi"` があるため)。元画像は `raw/ce_py5_messi.png`。

## 画像の推奨仕様
- **1ポーズだけ**を切り出した画像(複数ポーズが1枚に入っているものは不可)。
- **背景は透過**(PNGアルファ)推奨。白背景のままだとカード上で白い箱に見えます。
- 縦長〜正方形。カード内では縦横比を保ったまま縮小し、下端をそろえて中央配置します。
- 目安サイズ: 高さ 200〜400px 程度。`.webp` / `.jpg` も可(透過が必要なら png/webp)。

## 仕組み
- `build.py` の `_sig_block()` が `src/assets/signatures/` **直下のみ**(非再帰)を走査し、
  **`data.js` の `SIGNATURES` に登録済みの id とファイル名(stem)が一致するものだけ**を
  `window.SIG_IMG={ "messi": "data:image/png;base64,..." }` として生成し、JSバンドル先頭
  (`"use strict";` 直後)に注入します。
- 生ソース(`raw/` 配下)は走査対象外=**埋め込まれません**(バンドル肥大化防止)。
  切り出して直下に `<登録id>.webp` を置いた時点で初めて反映されます。
- `data.js` がこれを `SIG_IMG_EL`(Imageオブジェクト)としてプリロードし、
  `spriteCanvas` が `c.sig` のカードでこのモチーフ画像を描画します。
- 画像が未配置でも動作します(★エンブレムのプレースホルダ表示)。

## 新しい固有選手を追加する手順
1. **画像を切り出す**: 生ソース(複数ポーズ)を `raw/` に置き、クロップツールで1体を抽出
   (出力は直下の `<id>.webp`)。src はバレ名でも `raw/` から自動解決されます。
   ```bash
   python tools/crop_signature.py <生ソース.png> <id>            # 中央を切り出して <id>.webp 保存
   python tools/crop_signature.py <生ソース.png> <id> --seg left # 左/右/番号指定も可
   python tools/crop_signature.py <生ソース.png> <id> --dry-run  # 検出だけ確認(保存なし)
   ```
   (手元で切り出し済みなら、そのまま直下に `<id>.webp`/`<id>.png` を置くだけでも可。背景透過推奨。)
2. **`src/js/data.js` の `SIGNATURES` にエントリ追加**(下のテンプレ参照)。
   - 不変条件: 6ステ合計=**100** / いずれか1つ以上を**20** / `subGroup(sub)===pos` / `type` はそのposの有効値。
3. **検証**: `node src/tests/signaturetest.js` で不変条件を機械チェック(合計/20/ポジション/type/id重複)。
4. **ビルド**: `python build.py`(登録済みidに画像が無ければ警告が出る) → ブラウザで確認。

### SIGNATURES エントリのテンプレート
```js
{id:"<id>", name:"<表示名>", flag:"🇽🇽", pos:"FW", sub:"CF", type:"striker",
 stats:{off:20,def:14,pow:18,tec:14,spd:18,sta:16}, // 合計100・いずれか20
 skill:{name:"<スキル名>", desc:"<説明>", fx:{shoot:1.4,duelPow:1.3}}},
```
- `pos`/`sub`/`type` の対応: pos=GK/DF/MF/FW、sub=§3.4の細分pos、type=§4の各posのタイプ。
- `fx` の効果キーは §5.1 を参照(shoot/duelSpd/duelPow/duelTec/duelD/save/mid/teamChance/teamDef/iron/clutch/losing/miracle)。
- 国旗が `NATIONS` に無い国は `data.js` の `NATIONS` に `"🇽🇽":"国名"` を追加(国名表示・ケミストリー用)。
