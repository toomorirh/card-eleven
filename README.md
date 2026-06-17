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
├── index.html              ← 公開・実行用の完成ファイル(ビルド成果物)
├── build.py                ← ビルドスクリプト(game.src.js を index.html へ埋め込み)
├── SPEC.md                 ← 設計仕様書(Single Source of Truth)
├── README.md
└── src/
    └── jsbundle/
        ├── game.src.js     ← ゲーム本体の正本JS(スプライトはdata URIで内包)
        └── tests/          ← headless Nodeの検証ハーネス
```

`index.html` は**ビルド成果物**です。ゲームのロジックを変更するときは `src/jsbundle/game.src.js` を編集し、`build.py` で `index.html` に反映します。CSS・HTMLマークアップは `index.html` を直接編集します。

## 開発

### 必要環境
- Python 3（ビルド用）
- Node.js（テスト用）

### ビルド
```bash
python3 build.py          # game.src.js を index.html に再埋め込み
python3 build.py --check  # 埋め込み済みかチェックのみ
```

### テスト
headless Node で動作する検証ハーネス。試合の完走・無限ループ防止・勝率カーブの単調性などを確認します。
```bash
cd src/jsbundle/tests
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
