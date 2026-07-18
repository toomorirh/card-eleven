> [← ドキュメント索引 (SPEC.md)](../SPEC.md)  ｜ card-eleven 仕様書

---

## 2. データモデル

### 2.1 セーブ状態 `S`(schema v10)
```
{ v:10, coins, coll:[], squad:{}, bench:[], form:"4-4-2", cleared:0, tactic:"bal",
  captain:null, kickers:{pk,fk,ck},                     // 編成ロール(§7.12)
  legendPacks, championPacks, sigPacks, sigSelect,       // パック/券の在庫
  leagueWins, tour:{i,res:[]}, tourPerfect, daily,       // モード進捗
  league, career,                                        // リーグ戦/監督キャリアの進行状態
  coach, teamName, favId, friendRec:{}, ms:{},           // プロフィール/実績
  mgrOwned:[], mgrActive, introLetters, customMgrs:[],   // 監督(名将/カスタム)
  prestige, fac:{stadium,academy,medical,coaching,scouting}, // 名声/施設(アカウント恒久・§7.10.2)
  rookieViz, secViz, guideStep, hasScouted, leagueDone } // 見た目/秘書ガイド
```
- `coll`: 所持カード配列 / `squad`/`bench`: {スロットindex → カードid} / `cleared`: 攻略済みステージ数
- `captain`/`kickers`: 編成のロール(§7.12) / `prestige`/`fac`: 名声・施設は**アカウント恒久**(§7.10.2)
- `career`: 監督キャリアの状態(§7.10.1)。カードの `par`(パラレル・§3.6.3)は個体に持つ。

### 2.2 カード
```
{ id, name, flag, pos, sub, rar, type, off, def, pow, tec, spd, sta, skill, look }
```
- `pos`: 大分類 `GK|DF|MF|FW`(スプライト・タイプ・スキルの基準) / `sub`: 細分ポジション(§3.4) / `rar`: `n|r|sr|l` / `type`: プレースタイル(§4) / `age`: 年齢(§4.3・基礎ステと独立の実パラメータ)
- 6ステータス `off攻 def守 pow力 tec技 spd速 sta持`(各1〜20)
- `flag`: 国籍(国旗絵文字、16ヶ国)。国名は `NATIONS[flag]` で導出(§3.5)。
- `look`: 見た目(headIdx 0-31, bodyVar 0-3, 及び旧フォールバック描画用の skin/hair/kit 等)
- `sig`(任意): **固有選手(シグネチャー)**の識別子(§3.6)。これを持つカードは頭部+ボディ合成ではなくモチーフ画像1枚で描画され、★★★★表示・OVR100固定になる。

### 2.3 マイグレーション
- 起動時 `S.v !== 9` なら `migrate()` 実行 → `save()`。
- **v8変換**: 旧1-9スケール(6ステ合計≤54)のカードを、レア度別目標合計へ比例リスケール(§3.1)。
  各能力の高低バランスは保持。coins/cleared/legendPacks 等は維持。
- **v9変換**: `sub` 未設定のカードに、`c.pos` の大分類に属する細分posを `SUBS_BY` からランダム付与(§3.4)。既存進捗は維持。

---

---

[↑ 索引](../SPEC.md)  ｜  [← 前: 1. アーキテクチャと技術仕様](01-architecture.md)  ｜  [次: 3. ステータス・レアリティ・カード →](03-stats-and-cards.md)
