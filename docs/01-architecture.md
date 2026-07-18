> [← ドキュメント索引 (SPEC.md)](../SPEC.md)  ｜ card-eleven 仕様書

---

## 1. アーキテクチャと技術仕様

| 項目 | 仕様 |
|---|---|
| 構成 | 単一 `.html`。`<style>` + `<script>`(`"use strict"`)に全て内包 |
| 永続化 | `window.storage`(キー `"ci-save"`)に JSON 文字列で保存。get 3秒 / set 2.5秒のタイムアウト付き |
| 画像 | 頭部・ボディのスプライトатлась 2枚を WebP base64 データURIで埋め込み(`HEAD_IMG` / `BODY_IMG`) |
| 起動堅牢化 | 画像は `decode()` ではなく onload+4秒タイムアウト。失敗時は簡易シルエットで描画継続 |
| 診断 | 起動時、画面最上部に `BOOT 1/3〜3/3` の進捗バー。本体JSと独立したES5エラーハンドラで行番号付きエラーを表示。成功で3秒後に自動非表示 |
| フォント | `DotGothic16`(ドットフォント)。角丸全廃、RPGウィンドウ枠、CRTスキャンライン、ディザ背景 |
| アクセシビリティ | `prefers-reduced-motion` でアニメーション停止 |

### 1.1 ソース構成(開発時は分割 → build.py で単一HTMLへ結合)
`src/js/*.js` を `build.py` の `JS_FILES` 順(`data, qr, state, ui-roster, ui-gacha, ui-competition, match-core, match-render, match-flow, boot`)に連結し index.html の `<script>` へ埋め込む(成果物は単一HTML)。`src/css/*.css` も同様に連結して `<style>` へ埋め込む(§9.9 デザインシステムの2層 base→sfc-skin)。
- **アセット注入**: `build.py` は `"use strict"` 直後に画像データURIのグローバルを注入する — `SIG_IMG`(固有選手/エモーショナル)・`GEN_IMG`(汎用ボディ・現状空)・`MGR_SHEET`/`MGR_SHEET2`(監督ポートレート2枚)・`SEC_SHEET`(秘書)・`CARD_BG`(カード背景tier別)・`TOP_BG`(タイトル)。各 `_*_block` が `src/assets/**` を走査し WebP/JPEG 化して埋め込む(§10.2・[アセット](07-legend-and-assets.md))。`--dev` で `_dev.js` を含む `index.dev.html`(gitignore)を出力。
- **参照表の自動生成**: `tools/gen_reference.js` が `data.js` の `SIGNATURES`/`EMOTIONALS`/`TYPES` から `docs/reference/*.md` を生成(データ二重管理の回避)。

試合の中核は関心ごとに3ファイルへ分離している:

| ファイル | 責務 | 主な中身 |
|---|---|---|
| `match-core.js` | **純粋シミュレーション&バランス**(DOM非依存) | `eff` `fatigue` `situ` `midPower` `recalcAuras` / `pick*` / 起点選択(`pickChannel` `pickOriginPlayer` `rollTurnover` `pickWinner` `buildupSuccess` `pressPower` `buildSecurity`) / 連鎖(`matchupDefender` `linkWeight` `resolveLink` `laneOf` `stamOf`) / `buildTeam` `myTeam` `oppTeam` `oppPickStyle` / `statRating` / 勝敗判定の純粋関数 `resolveDuel` `resolveShot` |
| `match-render.js` | **描画・演出**(DOM/アニメ) | フィールド座標変換・`movePlayer` `ballTo` `buildField` `updateField` / カットイン(`vsCutin` `wordCutin`(super=`big`) `sigCutin`(スポットライト) `pkCutin`(PK一騎打ち) `spCutin`(セットプレー) `kickoffCutin` `gameSetCutin`) / `crowdPulse` `scorePop` / `feed` / スキル発動演出(`skillHit` `skillPulse`(系統色) `auraSkill` `skillAny`) |
| `match-flow.js` | **進行制御・起点→連鎖** | 起点(`recordOrigin`) / 連鎖(`LINKS` レジストリ・`runChain` `egoRun` `linkAvailable` `depthFrac` `recordLink` `recMatch`) / `tryShot` / `tickAsync` `runLoop` / `startMatch` `endMatch` / スタッツ表示 / 途中交代 |

- **TUNING**(`data.js`): 横断的なバランスダイヤルを集約(`rng` `fatigue` `tactic` `midTactic` `midStyle` `mid` `th` `aura` `reward` `drop` `origin` `link`)。バランス調整はまずここを見る。相性 `COUNTER_BONUS/PENALTY`・キーポジ `KEY_MUL`・ケミストリーは個別定数。
- **起点(オリジン)レイヤー**(開放play): tick毎に `midPower` 比で主導権チーム T を決め、`rollTurnover` で守備側の奪取(=カウンター)を判定。奪取なら攻撃が反転し channel="win"。それ以外は `pickChannel`(build/overlap/feed)＋`pickOriginPlayer` で**起点選手**を選ぶ(全選手が起点になりうる/MF優位)。`buildupSuccess` で攻撃が形になるか判定。専用ロングカウンター抽選は撤去し `rollTurnover` に一本化。`TUNING.origin`(turnoverBase/channelBase/styleBias/buildup/counterBonus)。
- **連鎖チェーン**(起点→リンク×N→シュート): `runChain` が毎ステップ「シュート移行(深さ・つなぎ数で増加)/リンク」を判定。リンクは `LINKS` レジストリ(拡張可)で **combination(連結)/through/cross/dribble/cutin**。可能性は `linkAvailable`(ジオメトリ=幅/中央)、**選択は `linkWeight`(選手パラメータ＝個性)**。dribble/cutin は `(off,spd,tec)×スタミナ×type.drive` で重み付け＝**エゴイスト個性**(ドリブラー/ウインガーが自分で持ち込む)。受け手に対する守備者は `matchupDefender`(左右ミラー `100-lane`・静的レーン主体)で決定し `resolveLink` で競る。`TUNING.link`(maxLink/directShoot/progStep/base/egoStat/advanced)。
- **セットプレー**(別レイヤー・連鎖の副次結果から派生): フィニッシュ系リンク(dribble/cutin/cross/through)で `rollFoul` が当たると **PK/FK**(`setPiece`→`spShot` 直接 or `aerialBox` クロス)。危険なクリア/GKセーブから確率で **CK**(`setCorner`→`aerialBox`)。スローインは通常保持に吸収(イベント化せず)。`_spActive` で再帰防止。`TUNING.setpiece`(foulBase/boxChance/pkBase/fkDirectShare/cornerOnClear/cornerOnSave)。低頻度(実測 PK≈0.2/試合・CK≈0.5/試合)で味付け。
- **tickの流れ**: `tickAsync` → `midPower` で主導権 → 奪取判定/チャンネル・起点選択 → `buildupSuccess` → `runChain`(リンク連鎖) → 各リンクが演出しつつ `resolveLink`/`resolveShot` で判定 → ゴール/セーブ。
- **演出(match-flow/render)**: 得点は `goalCelebrate` に集約(種別=ヘディング/個人技/PK/直接FK/スーパー、スコアpop・歓声`crowdPulse`・同点/勝ち越し/ハットトリックの実況)。スーパーゴールは遠距離×高off/powで判定し`wordCutin`の`big`で増強。セットプレーは専用カットイン(PK=`pkCutin` 一騎打ち / FK・CK=`spCutin` 蹴る選手表示)。試合開始`kickoffCutin`(両チーム主将)・終了`gameSetCutin`。試合の流れは連続攻撃の「猛攻」(`MC._streak`)・85分以降の時計赤(`#clock.late`)・終了間際コール。スキル発動は系統色パルス(`skillPulse`: 攻/守/支配)。カットインは中央マークを画面中央に固定、語句型は縦中央スタックで選手を中段表示。
- **ボルテージ(熱気)** `MC.volt`(0..1): 試合の熱気。攻撃成立/シュート/得点/猛攻で上がり、停滞で冷め、時間で下限上昇(`TUNING.volt`)。**スキル発動「演出」の表示確率(`skillShow`=gateBase+volt)をゲート**し、序盤(volt低)のキックオフ直後に唐突な発動演出が出ないようにする。**勝敗計算の係数(eff/resolve)は常時適用で不変**=演出のみの制御。0.7初到達で「ヒートアップ」告知。
- **拡張ポイント(レジストリ・追加=1エントリ)**:
  - 攻撃リンク → `LINKS`(+`linkWeight`/必要なら`linkAvailable`)。
  - 攻撃チャンネル → `CHANNELS`(`match-core`・`{base,buildup,maxLink,weight,pickOrigin}`。win=奪取専用でweight無し)。`pickChannel`/`pickOriginPlayer`/`buildupSuccess`/`chanMaxLink` が自動対応。
  - 攻撃スタイル → `STYLES`(`{btn,label,channelBias,mid}`。編成ボタンは`buildStyleRow`が自動生成。※相手選好`oppPickStyle`は別途スタイル別スコア)。
  - セットプレー → `SETPIECES`(`{pk,fk,ck}.run`。`setPiece`/`setCorner`は再帰防止ガード+ディスパッチ)。
  - キャリア保持時の特殊演出/連携 → `CARRY_HOOKS`(`[{detect,run}]`・采配/名コンビが登録済)。
  - 試合モード → `MATCH_MODES`(`{onEnd}`。`MC.mode`で分岐)。
- **変更の指針**:
  - バランス調整 → `data.js` の `TUNING`(`origin`/`link`/`th`/`match`/`volt` 等)・各レジストリの数値フィールド。
  - 試合の時間/閾値 → `TUNING.match`(tick/終盤/相手調整/猛攻/つなぎfeed)。
  - 見た目/演出変更 → `match-render.js`。
- **リグレッション確認**: 構造変更は「シード固定で前後の試合スコアが一致するか」で振る舞い不変を検証できる(`seedRandom` で Math.random を固定して同一条件の試合を回す)。

### 不変条件(リグレッション禁止)
- **参照ID整合**: JS内の全 `getElementById("X")` に対し、HTMLに `id="X"` が必ず存在する。
- **ポジション整合**: 全カードで `subGroup(c.sub) === c.pos`(細分posは必ず大分類1つに属する)。FORMS各枠は細分posで定義し、大分類は `subGroup()` で導出する。
- **試合完走**: 全4スタイル(center/side/long/short)で試合が最後まで進行する。
- **ハング耐性**: ストレージ・画像が応答しなくても起動し、試合が完走する。
- マッチアップ計算は**比率ベース**。全選手を一律スケールしても勝率バランスは不変。

---

---

[↑ 索引](../SPEC.md)  ｜  [次: 2. データモデル →](02-data-model.md)
