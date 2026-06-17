# カードイレブン (Card Eleven)

SFCレトロ風の**収集型カードサッカーゲーム**。スマートフォン縦持ち・オフライン対応の単一HTMLファイルで動作します。選手カードをガチャで集め、フォーメーションを組み、ステージ攻略やリーグ戦で優勝を目指します。

## 遊ぶ

GitHub Pages で公開すると、ブラウザだけで遊べます（インストール不要）。

> 公開URL: `https://<ユーザー名>.github.io/card-eleven/`

ローカルで遊ぶ場合は `index.html` をブラウザで開くだけです（ビルド不要・サーバー不要）。

## 特徴

- **収集型カード** — 24種の選手スプライト + レアリティ別キラ仕様、6ステータスの六角レーダー表示
- **6職業 × 属性** — ナイト/剣闘士/弓使い/魔法使い/僧侶/商人。職業ごとに戦闘スタイルが異なる
- **試合エンジン** — 陣形がボールに追従し、戦術(守備的/バランス/攻撃的)と攻撃スタイルで展開が変化
- **ガチャ** — データ駆動のパック定義 + フロート&バーストの開封演出
- **モード** — ステージ攻略 / 全9チーム総当たりのリーグ戦
- **完全オフライン** — スプライトもセーブも単一HTMLに内包

## リポジトリ構成

```
card-eleven/
├── index.html              ← 公開・実行用の完成ファイル(ビルド成果物。単一HTML・オフライン動作)
├── build.py                ← ビルドスクリプト(src/js, src/css を index.html へ結合・埋め込み)
├── SPEC.md                 ← 設計仕様書(Single Source of Truth)
├── README.md
└── src/
    ├── js/                 ← ゲーム本体の正本JS(役割ごとに分割。結合順はbuild.py参照)
    │   ├── data.js             名前/国旗/ポジション/フォーメーション/スキル/タイプ定義
    │   ├── state.js            セーブ状態・save/load/migrate・画面切替
    │   ├── ui-roster.js        カード描画・編成(フォーメーション)・図鑑
    │   ├── ui-gacha.js         ガチャ(パック定義・抽選・開封演出)
    │   ├── ui-competition.js   ステージ攻略一覧・リーグ戦モード
    │   ├── match-engine.js     試合の計算(eff/デュエル/シュート判定など)
    │   ├── match-flow.js       俯瞰フィールド描画・カットイン・試合進行ループ・途中交代
    │   └── boot.js             起動呼び出し(load().then(...)。結合順は必ず最後)
    ├── css/                ← スタイル定義(役割ごとに分割)
    │   ├── base.css            変数・レイアウト・カード等の基本スタイル
    │   └── sfc-skin.css        SFCレトロスキン(base.cssへの上書きレイヤー)
    └── tests/              ← headless Nodeの検証ハーネス
        ├── _setup.js           共通のDOM/Imageモック+src/js結合ヘルパー
        └── *.js                各テスト本体
```

`index.html` は**ビルド成果物**です。ゲームのロジックを変更するときは `src/js/*.js` を編集し、
`build.py` で `index.html` に反映します。CSSを変更するときは `src/css/*.css` を編集します。
複数ファイルへの分割は開発時の編集しやすさのためで、import/exportやビルドツールは使わず、
`build.py` が単純にファイルを結合して埋め込むだけです。

## 開発

### 必要環境
- Python 3（ビルド用）
- Node.js（テスト用）

### ビルド
```bash
python3 build.py          # src/js, src/css を index.html に再埋め込み
python3 build.py --check  # 埋め込み済みかチェックのみ
```

### テスト
headless Node で動作する検証ハーネス。試合の完走・無限ループ防止・勝率カーブの単調性などを確認します。
`integration`/`hangtest` は標準リリース手順の必須項目、`progtest2`/`curvetest` はバランス変更時のみ
実行する任意項目です(数百試合シミュレートするため数分かかります)。
```bash
cd src/tests
for t in integration hangtest scaletest progtest2 curvetest leaguetest legendtest; do
  echo -n "$t: "; node $t.js >/dev/null 2>&1 && echo OK || echo FAIL
done
```

## GitHub Pages での公開手順

1. リポジトリの **Settings → Pages** を開く
2. **Source** を `Deploy from a branch` に設定
3. **Branch** を `main` / フォルダ `/ (root)` に設定して保存
4. 数十秒後に `https://<ユーザー名>.github.io/card-eleven/` で公開されます

`index.html` がルートにあるため、追加設定なしでそのまま公開できます。

## ライセンス

個人制作。スプライト等のアセットを含むため、再配布時はご注意ください。
