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
- `build.py` の `_sig_block()` が `src/assets/signatures/*.png` を走査し、
  **`data.js` の `SIGNATURES` に登録済みの id とファイル名(stem)が一致するものだけ**を
  `window.SIG_IMG={ "messi": "data:image/png;base64,..." }` として生成し、JSバンドル先頭
  (`"use strict";` 直後)に注入します。
- 登録前の生ソース画像(例: 複数ポーズが入った `ce_py5_messi.png` など)はここに置いても
  **埋め込まれません**(バンドル肥大化防止)。切り出して `<登録id>.png` にした時点で初めて反映されます。
- `data.js` がこれを `SIG_IMG_EL`(Imageオブジェクト)としてプリロードし、
  `spriteCanvas` が `c.sig` のカードでこのモチーフ画像を描画します。
- 画像が未配置でも動作します(★エンブレムのプレースホルダ表示)。

## 新しい固有選手を追加する手順
1. **画像を切り出す**: 生ソース(複数ポーズ)をこのフォルダに置き、クロップツールで1体を抽出。
   ```bash
   python tools/crop_signature.py <生ソース.png> <id>            # 中央を切り出して <id>.png 保存
   python tools/crop_signature.py <生ソース.png> <id> --seg left # 左/右/番号指定も可
   python tools/crop_signature.py <生ソース.png> <id> --dry-run  # 検出だけ確認(保存なし)
   ```
   (手元で切り出し済みなら、そのまま `<id>.png` を置くだけでも可。背景透過推奨。)
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
