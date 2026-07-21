> [← ドキュメント索引 (SPEC.md)](../SPEC.md)  ｜ card-eleven 仕様書

---

## 7. ゲームモード

### 7.1 ステージ攻略
- 8クラブ(`CLUBS`)を Lv1→Lv8 で順次解放。`cleared` で進捗管理。
- 各クラブは `[名前, 強さLv, 得意フォーメーション]` を持ち、相手は**その陣形で実際に布陣する**(座標・細分pos・KEYPOSもその陣形のもの)。`oppTeam(lv, form)`。
  - 1選手平均 `avg = 6.6 + lv×1.0`(Lv1≈7.6 → Lv8≈14.6)。Lv8 のみエースFW1名が LEGEND(その陣形のFW枠からランダム選出)。
- **フォーメーション相性(`FORM_COUNTER`)**: 守備側の陣形に対し、攻撃側スタイルの有利(best)/不利(worst)を定義。攻撃側の主判定(`tfA`経由・全スタイル共通)に best=×`COUNTER_BONUS`(1.15) / worst=×`COUNTER_PENALTY`(0.88) を乗算。**両チームの攻撃に対称適用**(form未設定のクローン対戦は等倍=バランス不変)。
  - best/worst は試合エンジンの**実測**(同強度クローンの陣形別スタイル得点)に一致させ、ヒント表示と実挙動が食い違わないようにしている。値は「自然な傾向の増幅」であり勝率を支配しない(SPECの"スタイルはpower pickでなく戦術選択"方針を維持)。主効果は得点・チャンス創出という体感と、接戦帯での数%の優位。
  - 相手フォーメーションと推奨スタイルは**ステージ選択画面で事前開示**+キックオフ時にヒント表示。プレイヤーは相手に応じて編成・スタイルを変える動機を持つ。
- **勝利報酬** `100 + lv×40` コイン / 引分 50 / 敗北 30。
- 想定勝率カーブ(`progtest2`・centerスタイル固定での実測。相手陣形多様化後): N→Lv1(4-4-2) 78% / N→Lv2(5-3-2) 43% / R→Lv3(4-3-1-2) 93% / R→Lv4(4-2-3-1) 82% / SR→Lv5(4-3-3) 100% / SR→Lv6(5-3-2) 95% / SR→Lv7(4-3-1-2) 37% / L→Lv8(4-2-3-1) 93%。
  - **Lv2・Lv7の谷はcenter固定でゴリ押した場合の値**。相手の推奨スタイル(Lv2=short, Lv7=long)に変えれば改善する=「単一戦略の抑止／相手に応じた対応」が機能している証跡。旧基準(全4-4-2): N→Lv1 73%/Lv2 63%、R→Lv3 88%/Lv4 48% 等。

#### 7.1.1 相手チーム(CPU)の仕様
相手(`oppTeam(lv,club)`)は乱数生成カードをLvにスケールして構築する。以前は自チームだけが持っていた要素を**相手にも段階的に導入**し、対戦の公平性・リアリティを高めている(監督采配は将来対応・§7.10)。
- **統一Tier(`teamTier`)**: 平均OVRから算出する共通の強さ段階(1〜10)。`t.tier=Math.round(平均OVR/6−6.6)` を **CPU相手のみ**(`oppTeam`/`worldTeam`)に付与する(**自チーム・フレンド対戦は付与しない**)。`oppTeam` の `lv` と整合(lv3→tier3…lv8→tier8)、ワールド代表は tier9〜10。`lv`が無いワールド/デイリー相手にも一貫した物差しを与え、**次段の「監督のTier別バフ/采配」の基準**とする。
- **カード生成**: 各枠に `makeCard` で生成し `scaleTo(avg×6)` でLv相応の合計に。Lv8のみエースFW1名がLEGEND。固有/パラレル/エモーショナルは持たない(ボスの `club.ace` を除く)。
- **ポジション適性(pen)**: 以前は常に `pen:1`(全員ジャスト)だったが、**Tierが低いほど稀に近接ポジの選手を起用**して `pen=posFitOf(c,枠)`<1 とする(`TUNING.oppPos`。不一致率 = `max(min, base − lv×perLv)`、GKは常に専任)。弱いクラブほど編成が歪む=自チームと同じ適性ルールが働く。
- **キャプテン**: `teamCaptain(away)`(6ステ合計最上位)に `isCaptain` を付与し、自チーム同様に**スタミナ消耗を緩和**(`fatigue` ×`TUNING.fatigue.captain`)。
- **プレースキッカー**: `assignAutoKickers` が PK(決定力)/FK(技+攻)/CK(力+攻)の最良選手を自動指名し `away.kickers` に格納。`pickKicker` は自チーム=編成ロール・相手=この自動指名を参照。
- **AI交代(`aiAwaySub`)**: 相手も控え(`oppTeam` が生成する `bench`=**外野4(DF/MF/MF/FW)+控えGK1 の計5枚**・`TUNING.oppPos.benchN`=5・先発よりやや弱め=自チーム `BENCH_SIZE`=5 と対称)を持つ。①**負傷GKを控えGKと交代(最優先)** → ②`TUNING.match.aiSubMins`(既定 63/75/84分)に**最も消耗した先発(GK除く)が wear 閾値超なら最適ポジの控えと交代**(最大 `aiSubs`=3回)。終盤の運動量維持=自チームの交代(3枠)と対称。
- **監督(`assignOppManager`)**: CPU相手はTierに応じた監督を持つ(バフ+采配+性格)。`eff` の `mgrMul` でバフ適用、`mgrCarryTac`/`mgrCbTac` は自チーム/相手どちらの采配も発火(side制限を撤廃)。
  - **Tier9-10**: **獲得可能な名将(`MANAGERS`)**が指揮(実boost/tac・シート絵アバター)。ワールドツアー相手に相当。
  - **Tier6-8**: 中バフ(全能力×1.03〜1.042)+**上位采配**(`CAREER_TACS.strong`から1つ)。
  - **Tier3-5**: 小バフ(×1.015〜1.023)+**下位采配**(`CAREER_TACS.basic`から1つ)。
  - **Tier1-2**: 小バフのみ(×1.008〜1.012)。
  - **アバター**: 名将(9-10)は本人シート絵。**汎用(1-8)はモブ監督シート(`ce_mob_managers.png`・4x2=8種・`sheet:"mob"`)からランダムに1つ**割り当て(`assignOppManager` が `col/row`)。`mgrPortrait` が `sheet==="mob"` で `MGR_MOB` を切り出す。
  - CPUの采配は `cpuTac` で**cond緩和**(起点ポジ+chanceのみで発火。低ステでも采配が出る)。采配はチームに存在する起点ポジのものを選ぶ。
- **性格(ランダム2軸)**: `t.personality={main,sub}`。
  - **メイン(基本戦術)**: 攻撃重視→`atk` / バランス重視→`bal` / 守備重視→`def`(キックオフで固定)。
  - **サブ(ポジ戦術=スタイルの入替・交代挙動)**: **きまぐれ**=`styleUpdMins`ごとにランダムに頻繁入替 / **初志貫徹**=一切変えない / **心配性**=固定スタイル1つだが交代が早い(`aiSubMinsWorry`+wear閾値−0.15) / **合理的**=`counterBestStyle(相手form)`で有利スタイルを定期選択。
- 攻撃スタイルの初期値は `oppPickStyle`(初志貫徹)またはサブ性格で上書き。バランス影響は小(matchsim EVEN 得点2.3前後・相手やや手強く)。
- **偵察(`renderScout`)は自チーム編成画面と同じ盤で表示**: `pitchSlots`/`renderChemLines`/`roleBadges`/`renderManagerAdvice` を **`ctx.form` 対応に一般化**して相手XIを描画。スロット(細分pos/OVR/適性✓⚠)・**キーポジ⭐**・**ロール徽章(CAP/PK/FK/CK)**・**ケミ線/名コンビ(ホットライン)**・**監督札(全身絵=名将 or モブ+バフ+采配)+性格**・**控え(交代要員=`away.bench`を編成画面と同じ `.bench-slot` レイアウトで表示)**を一望できる。相手主将=`teamCaptain(away)`、キッカー=`away.kickers`、監督采配KPは相手監督から算出(自監督は混ぜない)。

### 7.2 リーグ戦
- 自チーム+8クラブ=全9チームの総当たり(円卓法・BYE枠で偶数化 → 9節・各チーム8試合・ユニーク対戦36)。
- 自分の試合はフル演出、他カードは `simCpu`(クラブLvベースのポアソン風)で即時シミュレート。
- 順位表: 勝点(勝3/分1/負0)→ 得失点差 → 得点 でソート。自チーム行をハイライト。
- 報酬: 優勝=🪙500+チャンピオンパック×1 / 2-3位=🪙250 / 4位以下=🪙100。何度でも再挑戦可。

### 7.3 交代
- 1試合3回まで。投入選手は投入時刻からのスタミナ(fresh)。ポジション不一致は pen 0.72。
- **交代退場した選手は同じ試合に戻せない**(`MC.subbedOut`=OUT選手のcard idを記録し、ベンチ候補`renderBench`から除外)。投入された控えは後で再交代可。

### 7.4 ガチャ / パック開封UI
- パックは `PACKS` 配列で**データ駆動**定義(`id/name/emoji/color/cost/desc/can()/pay()/owned()/get()`)。新パック追加は配列に1要素足すだけで一覧・開封演出に反映(将来のリーグ/モード報酬パックに対応)。
- ガチャ画面はタイル一覧(`renderGacha`)。各タイルにコスト/所持数/排出内容を表示し、入手不可はグレーアウト。
- 開封演出はフルスクリーン `#packOverlay`: ①パックがフロートイン(`floatUp`+`bob`)→ ②タップ(または約1.7秒で自動)で破裂(`burst`+フラッシュ)→ ③カードが飛び出す(`flyIn`・段差)→ 最高レア度に応じた結果バナー(SR=✨ / LEGEND=🌈 発光)+「とじる」。
- **ロジックとUIを分離**: 純抽選 `drawPack(id)`(pay+get+所持追加、演出なし)を `openPackById`(演出付き)と検証ハーネスが共用。
- レジェンドパックはコイン購入不可・`owned()` で所持数表示・試合後ドロップのみ(§8)。`prefers-reduced-motion` で演出停止。
- **チャンピオンパック**(`id:"champion"`, 🏅): リーグ優勝報酬(`S.championPacks`)。1パック=**5枚**(高排出4枚 + SR以上1枚確定、確定枠の18%でLEGEND)。`championDraw()` で生成。コイン購入不可。実測内訳の目安: N≈12% R≈31% SR≈44% L≈11%。
- **シグネチャーパック**(`id:"signature"`, 🌟): **固有選手(★★★★)1枚確定**(§3.6)。`S.sigPacks` 枚数で管理、コイン購入不可。**未所持優先抽選**: `unownedSignatures()`(コレクションにまだ無い `sig`)からランダムに1名を `makeSignature` で生成。全16名所持済みの場合のみ全プールにフォールバック(=重複可)。開封演出では専用バナー(🌟 シグネチャー選手 登場!!)を表示。入手は実績(トロフィー)報酬のみ(§7.6)。
- **シグネチャー選択券**(🎟️): `S.sigSelect` で管理する特別報酬。ガチャ画面に専用タイルとして所持時のみ表示し、タップで `#sigPickModal`(`SIGNATURES` 全員のカード一覧 `#sigPickGrid`)を開く。**所持済みの選手はグレーアウト(`.sig-owned`「所持済み」)+選択不可**で無駄引きを防止し、未所持のみ選べる(全員所持済みのときだけ重複選択を許可して券が死なないようにフォールバック)。1名を選ぶと券を1枚消費して `makeSignature` で確定獲得し、選択券専用の開封演出を再生。ランダムでは狙えない選手をピンポイントで補完できる、最上位の到達報酬。
- **重複ポリシー**: パック・選択券とも未所持優先で、コンプリート前に同じ固有選手が重複しない。`ownedSigSet()`(`S.coll` 内の `sig`)で判定。全16名コンプ後のみ重複を許容。

### 7.5 ユーザーインターフェース(スマートフォン最適化)
- **試合画面レイアウト**: フィールド表示を `.fieldview max-height:200px`（従来62vh から95%削減）に縮小し、実況フィード・戦術ボタン・交代操作が全て画面内に収まるようコンパクト化。スマートフォンでのスクロール操作を排除。
- **モーダルダイアログ**: フォーメーション選択・選手交代・カードピッカーの3モーダルに**window-style☒ close ボタン**(位置:絶対)をシート左上に配置。`.sheet max-height:50vh`（従来70vh）制限+スクロール許可で、ボタンが常に見える範囲に。スクロール発生時も close 未操作→自動スクロールの問題回避。
- **タイトル画面**: 起動時に `scr-title` を表示し、🎴 絵文字＋ゲームタイトル＋START ボタン。START で `show("home")` → `.wrap.no-title` クラス付与 → `<h1>`/`.sub` を非表示化してゲーム画面のスペース確保。`show()` は遷移先に応じて `.no-title` を自動ON/OFF(title画面 OFF / 他の画面 ON)。
- **ヘルプ収納(? バッジ)**: 各画面の説明文は見出し横の **`?` バッジ(`helpIcon(key)`)** に収納し、タップで **`showHelp` ポップアップ**表示(`HELP` レジストリに本文・`data-help` を委譲クリックで解決)。画面から常設の説明文を排してクリーンに。対象: ガチャ/編成/所属選手/リーグ戦/ワールドツアー/フレンド/監督(契約)/監督キャリア/試合後スタッツ 等(動的な状態表示は据え置き)。
- セーブデータ互換: v9スキーマ据え置き、UIレイアウトは CSS/DOM のみの変更。

### 7.6 実績(トロフィー)と固有選手の入手
固有選手はコインやガチャでは買えず、**実績(トロフィー)の達成でのみ**手に入る、控えめでアスピレーショナルな到達目標。実績は一度きりで、ランダムパック / 選択券(指名獲得) / チャンピオンパックなどを報酬として付与する。達成状況・条件・報酬・進捗は**監督室**(`scr-office`)の「🏅実績」サブタブ(`renderAchievements`・`achList`)で一覧できる。

- **定義**: `ACHIEVEMENTS` 配列(`data.js`)で**データ駆動**。各エントリ `{id, icon, title, desc, test:()=>bool, prog:()=>string, reward, rewardLabel}`。`reward` は付与内容 `{sigPacks?, sigSelect?, championPacks?}`。追加は1要素足すだけで判定・画面表示の両方に反映。
- **判定**: `checkAchievements()`(`state.js`)が未達成(`!S.ms[id]`)かつ `test()` 真のものに `grantReward(reward)` を適用し、達成済みを `S.ms[id]=1` で記録(冪等=二重付与しない)。付与時は `toast`(実績解除「タイトル」報酬名)で通知。
- **呼び出し箇所**: ①ステージ攻略の試合終了後(`match-flow.js` の `endMatch`)②`loadGame` 時(旧セーブの遡及付与)③編成変更時(`renderPitch` 末尾=合計OVR系の判定)④リーグ報酬確定時(`claimSeason`)。
- **現行ラインナップ**: `clear4`(Lv4到達→Sパック) / `ovr1000`(編成の合計OVR≧1000→Sパック、`squadTotalOVR()` で判定) / `leagueWin`(リーグ初優勝=`S.leagueWins≥1`→Sパック+チャンピオンパック) / `clearAll`(全クラブ制覇→選択券) / `worldTourPerfect`(ワールドツアー全勝=`S.tourPerfect≥1`→選択券) / `careerDone`(監督キャリア初完走=`S.customMgrs.length≥1`→**選択券**。`careerFinalize` で判定) / `intlCup`(インターナショナルクラブカップ初優勝=`S.career.cupsWon` に "international"→**選択券**。カップ優勝時の career onEnd で判定=`cr`存在中に発火)。
- **リーグ報酬の分離**: コインは順位別に**毎シーズン**付与(優勝🪙500/3位以内250/参加100)。パック類は実績に一本化し、**初優勝**でのみチャンピオンパック+Sパックを付与(`claimSeason` が `S.leagueWins++` → `checkAchievements`)。「新シーズン開始」ボタンは報酬を再付与しない(以前の二重付与バグを修正)。
- 画面表示: `renderAchievements()`(`ui-roster.js`)が達成済み🏆(`.ach-card.got` 金枠)/未達成🔒(`prog()` の進捗表示)を一覧。
- セーブ: `S.sigSelect`/`S.leagueWins`/`S.ms`/`S.tour`/`S.tourPerfect` を追加(v9据え置き。欠落フィールドは `||0`・`||{}` 補完で旧セーブ互換)。

### 7.7 ワールドツアー
全クラブ制覇(`S.cleared>=CLUBS.length`)で `modeRow` に解放される第3モード(`🌍`)。**強豪国代表16カ国**(`WORLD_NATIONS`)を連戦する。

- **相手**: `worldTeam(nation,idx)`(`match-core.js`)。**全選手が同一国籍**=ケミストリー満タン(+6%)、平均OVRは `idx` で上昇(約90→100)。**署名保有国はその固有選手が先発**(位置一致枠へ注入)。`seed` でロスター固定(偵察=本番一致)。
- **進行(ラウンドテーブル=16連戦)**: `S.tour={i,res[]}`。`startWorldMatch`→試合→`endMatch` の world 分岐で **勝敗に関わらず `res[i]` 記録し `i++`**。16戦後は「新しいツアーを始める」で `tour` リセット。
- **画面**: `renderWorld()`(`ui-competition.js`)が縦タイムライン(`.wt-card`)で 16カ国＋結果チップ(🏆勝/🤝分/😢敗)を表示。現在の対戦国をハイライト＋KickOff。国情報タップで `openWorldScout`(scoutモーダル共用)。
- **報酬**: ①署名保有国に**勝利**で `TUNING.worldSigDrop`(15%)の低確率、その国の固有選手をドロップ(未所持優先)。②**全16勝**で実績 `worldTourPerfect`→シグネチャー選択券(一度きり)。
- 偵察/開始の共通化: `renderScout(title,info,team)` を `openScout`(ステージ)/`openWorldScout` で共用。試合開始は `_beginMatch(away,name,form,lv,idx)` を `startMatch`/`startWorldMatch`/`startFriendMatch` で共用。

### 7.7.1 デイリークエスト(毎日2チーム・全勝でシグネチャーチケット)
`modeRow` の `📅 デイリー` モード。シグネチャーを狙って集めやすくする毎日更新のイベント。
- **出題**: `S.daily={date,teams[2],done[],claimed}`。`ensureDaily` が日付(`todayStr`)を見て変わっていれば `pickDailyTeams`(日付ハッシュ`seedRandom`で当日固定=リロードで不変)が**ワールド代表から2チームをランダム選出**(将来 `{mode,idx}` で他モードのチームにも拡張可)。
- **報酬**: 各チーム撃破で **10%固有ドロップ(`TUNING.worldSigDrop`・未所持優先)**。**当日の全チーム全勝で `S.sigPacks`+1(1日1枚・`claimed`で重複防止)**=シグネチャーパック券(未所持固有を優先確定)。
- **試合**: `startDailyMatch(k)`→`worldTeam` と対戦(`MATCH_MODES.daily`)。`renderDaily`(`ui-competition.js`)が `.wt-card` で2チーム(名前/OVR/陣形/🔍偵察)+撃破🏆/挑戦▶ を表示。

### 7.8 フレンド対戦(チームコード共有・非同期/サーバ不要)
**監督室**(フッタータブ🎩=旧🏅実績・`scr-office`)の「🤝 対戦」サブタブに集約。サーバを持たず、**編成をコード化したチャレンジURLを送り合って非同期対戦**する(カジュアル用途・コードは編集可能なので厳格な競争には非対応)。`renderFriend` が共有(QR/URL/コピー)＋取り込み(相手確認→キックオフ)一式を `#ofMatch`(`friendHead`/`friendBody`)へ描画。

- **エクスポート(コンパクト)**: `exportTeam()` がスタメン11＋お気に入りを**ビット詰めバイナリ→base64url**化。1カード=sub4/rar2/type2/head5/bodyVar2/6ステ各5/flag4/**sig(可変)**/skill1/name6。監督名・チーム名のみ可変長UTF8で先頭に格納。
  - **バージョン(sigビット幅)**: 先頭バイト `0xC3`=**v3(sig 10bit=最大1023体・300体対応)**。旧 `0xC2`=v2(sig 5bit=31体)も**読込互換**(`importTeam` が先頭バイトで `sigBits` を5/10に切替、`_encCard/_decCard` に渡す)。エクスポートは常にv3。
  - `challengeURL()` が `location...#team=<コード>`(フラグメント=サーバ非送出)を生成。名前/スキルはインデックス参照、固有選手は sig id から `makeSignature` で復元(共有ステで上書き)。
- **インポート**: `importTeam(URL or コード)` が復元(`rebuildCard`: 固有は `makeSignature`＋共有ステ上書き、通常は素のカード生成)。陣形の各枠へ配置し `posFit` で pen を反映、`buildTeam` で相手チーム化。
- **対戦**: `startFriendMatch(team,coach)` → 通常の試合エンジンで自チーム vs 相手チーム。`endMatch` のフレンド分岐で **`S.friendRec[coach]={w,d,l}`** に成績をローカル記録。
- **QRコード**: 共有URL生成時に **QRを `<canvas>` 表示**(`qrcode-generator` 2.0.4 MITを `src/js/qr.js` にインライン=オフライン)。相手はスマホのカメラ/QRアプリで読めば開くだけで対戦。`qr.js` は `build.py` のJSにのみ含め(テスト連結 `_setup.js` には入れない)、`renderFriend` から遅延使用(未定義でも try/catch)。生成QRは `jsqr` でデコード往復一致を確認済み(開発時検証)。
- **チャレンジURL受信**: `boot.js` が `location.hash` の `team=` を検出し `_pendingChallenge` に保持、つづき/はじめから後に `gotoOffice("match")` で**監督室の「🤝対戦」へ誘導**・貼り付け欄へ自動入力。
- **読取失敗メッセージ**: 旧フォーマット(base64-JSON)のページで新コード(先頭`0xC2`)を読むと弾かれるため、トーストで「送信側・受信側を同じ最新版で開いてください」を明示。
- セーブ: `S.coach`/`S.teamName`/`S.favId`/`S.friendRec` を追加(v9据え置き・欠落補完)。

### 7.8.1 監督室(プロフィール＋対戦情報の集約・`scr-office`)
フッターの旧「🏅 実績」を「🎩 監督室」に置換。プロフィール表示と対戦関連を1画面に集約し、対戦導線を短縮する。
- **ヘッダ**(`officeHead`・`renderOffice`): チーム名(`myName()`)・監督名・お気に入り・**フレンド勝率**(`friendRec` 全戦のW/(W+D+L))・**実績達成数**(`done/総数`)＋「👤 編集」(`openProfile(false)`)。
- **サブタブ**(`#ofTabs`・`_selectOfTab`): `🤝対戦`(=7.8の `renderFriend`)/`📊戦績`(`renderFriendRec`: `friendRec` を相手別に一覧)/`🏅実績`(`renderAchievements`・旧実績画面を移設、`achCount`/`achList` は `#ofAch` 内)。
- `gotoOffice(tab)` でフッタータブ経由 `show("office")`→`renderOffice`→指定サブタブを表示(試合後の「監督室へ戻る」・挑戦状受信で使用)。`modeRow` からフレンドモードは廃止。

### 7.9 プロフィール(監督名・チーム名・お気に入り)
対戦相手に個性を伝えるための識別情報。`S.coach`(監督名)/`S.teamName`(チーム名)/`S.favId`(お気に入りカードid)。
- **新規開始**: `はじめから`→ `openProfile(true)`(`#profileModal`)で監督名・チーム名を入力→「はじめる」で `newGame` 後に名前を載せる。
- **編集**: 監督室ヘッダの「👤 編集」→ `openProfile(false)` で名前編集＋**所持カードからお気に入りを選択**(グリッドをタップ、選択は `.sel`)。`saveProfile` で保存。
- **適用**: チーム名は試合の自陣表示(`mHome`)・KICK OFFカットイン・リーグ順位表(`lgName(0)`)に反映(`myName()`)。
- **共有**: フレンド対戦のコードに監督名(`c`)・チーム名(`tn`)・お気に入り(`fav`=カード直列化)を含め、取り込み時に**相手プロフィール(チーム名/監督/お気に入り選手カード)をプレビュー表示**してからキックオフ。

### 7.10 名将(レンタル監督・エンドコンテンツ)
売却コインの使い道となるエンドコンテンツ。**名将**を起用すると自チームが少し強化され、フォーメーション/選手選択をより戦略的にできる。プロフィールの「監督名」(=あなた自身)とは別概念=雇う**名将**。監督室の「🎓 名将」サブタブ(`#ofMgr`・`renderManagers`)で管理。
- **データ**(`data.js` `MANAGERS`×**16**): `col/row/sheet`(ポートレート)・`boosts[]`(自チームのみ対象ポジ×ステを乗算・複数)・`tac`(采配)・`intl`(国際クラスの印)・`cost`/`ctrlOVR`。実在監督のカリカチュア画像に対応。全采配の詳細は [采配スキル一覧](reference/tactics.md)。
- **2クラス制(汎用CPU監督との差別化)**: 汎用CPU監督が全能力×1.008〜1.042だったため名将との差が縮んでいた。全名将を **「全能力ベース + 得意pos×stat」の2バフ**に強化し、明確に上回らせた:
  - **国際クラス(8名・`intl:true`)**: 全能力×**1.05** + 得意×**1.08** + **国際チームスキル**(`kind:"team"`サージ=発動でチーム全体を数ティック底上げ)。デル・ボスケ🇪🇸無敵艦隊/ジーコ🇧🇷カナリア軍団/クライフ🇳🇱トータルフットボール/サッキ🇮🇹カテナチオ/ビエルサ🇦🇷アルビセレステ/カペッロ🏴スリーライオンズ/ジダン🇫🇷レ・ブルー/リトバルスキー🇩🇪ディ・マンシャフト。
  - **通常クラス(8名)**: 全能力×**1.04** + 得意×**1.07** + **強化采配**(`strong`プール相当・pow増/高発動)。グアルディオラ/クロップ/アンチェロッティ/モウリーニョ/ファーガソン/ヴェンゲル/シメオネ/コンテ。
  - `mgrMul` が全boostを乗算(例 デル・ボスケのMF選手tec=1.05×1.08=1.134)。バランス影響: 名将は tier9-10 CPU と自チーム起用時のみ乗るため汎用帯は不変、エリート帯(名将対決)も守備拮抗で低スコア(実測1.1得点/試合)。`mgrPortrait` が `sheet` に応じ全身を切り出す。
- **ポートレート**: シート画像を `build.py` が `window.MGR_SHEET` に埋め込み、`mgrPortrait(m,h)` がセルの**全身**を高さ指定で切り出した canvas を返す。契約一覧/起用中/采配カットイン/スカウト演出/編成アドバイスに表示。
- **用語**: ユーザ自身=**オーナー**(プロフィールの名前。旧「監督名」)、レンタル対象=**監督**(旧「名将」)。
- **獲得=ガチャ**: スカウト(紹介状ガチャ)は**ガチャ画面の「監督スカウト」タイル**(✉️所持時に表示・`scoutManager`)。獲得時に全身絵の結果演出(`mgrScoutReveal`)。監督室「🎯監督」タブは**契約(起用)選択**に専念(`rentManager`=起用ごとにコイン)。
- **編成アドバイス**: 編成画面左上に起用中監督の全身絵+**指示の吹き出し**(`renderManagerAdvice`)でブースト効果と采配の発動条件・達成状況を提示。采配条件ポジションのスロットに**KP(キープレイヤー)タグ**(必要ステ・達成で金/未達で青)。
- **采配カットイン**: 監督の全身絵を左に表示→**左へスワイプ退場**→効果を発動した選手が**右から登場して中央**へ(`tacCutin(tac,mgr,exec)`・`.cutin.tacx`)。
- **ブースト適用**: `eff()`(単一集約点)に `mgrMul(p,k,T)` を追加。`buildTeam` で **side H のみ** `t.mgr=activeManager()` を付与=自チーム限定の非対称ボーナス(CPU/フレンド相手は対象外)。`pos:"all"|FW/MF/DF/GK`、`stat:"all"|6ステ`。**+3〜8%程度の小幅**。
- **獲得フロー**: リーグのシーズン完了報酬(`claimSeason`)で**紹介状**(`S.introLetters`・優勝2/その他1)→ 監督室で**スカウト**(`scoutManager`=紹介状1枚消費し未所持の名将を1名カタログ`S.mgrOwned`へ)。
- **レンタル(1名交代制)**: カタログから `rentManager(id)` で**起用ごとにコイン消費**(`cost`)し `S.mgrActive` を更新(常に1名・交代制で様々な選手/陣形を使う動機)。`解任`で無起用。`activeManager()`/`mgrBoostDesc()`。
- **可視化**: 監督室ヘッダと試合開始feed(`_beginMatch`)に起用中の名将とブーストを表示。セーブは `mgrOwned/mgrActive/introLetters` を追加(v9据え置き・loadGameで欠落補完)。
- **采配シグネ(条件付き戦略アクション+演出)**: 各名将の `tac{name,from,cond,chance}`。`cond=[[subRole,stat,しきい値]…]` を**全て満たす**(例 アーリークロス=LSBのtec≥20 かつ CFのpow≥20)と発動可能になる。**全采配の発動条件・発動率・効果は自動生成の [采配スキル一覧](reference/tactics.md) を参照**(キャリアで名将とマッチアップした際に相手が繰り出すのもこの采配)。発動は**文脈依存**:
  - **ボルテージ・ゲート**: いずれも `MC.volt >= TUNING.volt.tacGate`(=0.5、熱気が高まった局面)が前提。
  - **攻撃采配**: 起点キープレイヤー(`from`=SB/OMF/WG)が**実際にボールを持って起点になった瞬間**(`runChain` のキャリア=from一致)に `chance` で発動(`mgrCarryTac`)→決定機を創出(アーリークロス→空中戦ボーナス×1.69 / 電光タクト・電撃カウンター→決定的スルー→1対1)。※受け手側(CF等)では発動しない。
  - **守備采配**(密集ブロック=CBのdef≥20): **相手にシュートされた瞬間**(`tryShot`先頭)に `chance` でCBが**ブロック(無効化)**。
  - 発動時に「🎓 監督の采配!【名】」カットイン(`tacCutin`: 監督全身→左退場→発動選手が右から登場)。`tacCondMet/tacFromMatch/mgrCarryTac`。条件は最大ステ前提のアスピレーショナルなトリガー(しきい値・`chance`・`tacGate` はデータで調整可)。

#### 7.10.1 カスタム監督(監督キャリアモードの土台・フェーズ1)
将来の「監督キャリアモード」で育成する**自作監督**の基盤。名将(MANAGERS)が `boost`1個＋`tac`0〜1なのに対し、カスタム監督は **`boosts[]`＋`tacs[]` を複数積める**(=名将を超えうる)。
- **正規化**: `mgrBoosts(m)`/`mgrTacs(m)` が単数(名将)/複数(カスタム)を配列に統一。エンジンは常に配列で処理=名将は完全に従来通り。
- **適用**: `mgrMul` は該当する全 boost を**乗算**。采配は `mgrCarryTac`(攻撃tac群を順に判定)と `mgrCbTac`(守備cb tacを取得)で**複数tac**に対応。
- **各采配は1試合1回まで**(`team._firedTacs` に発動済み采配名を記録・`mgrCarryTac`/`mgrCbTac` がスキップ)。カスタム監督は複数采配を積めるが**各1回**なので、単一采配の名将との発動回数の格差を抑制(複数積むほど「毎回どれか発動」にならない)。`_firedTacs` はチーム単位=試合ごとにリセット。
- **生成/保持/起用**: `createCustomManager({name,boosts,tacs})` が `S.customMgrs` に登録。`managerById`/`activeManager` が名将とカスタムの両方を解決。`renderManagers` の「🎓 あなたのカスタム監督」セクションから**コイン不要で起用**(`rentManager` が `m.custom` を分岐)。肖像はシート未登録のため `mgrPortrait` がプレースホルダ(🎓バッジ)を描画。
- **キャリアループ(フェーズ2・実装済み)**: `CAREER`設定。任期 `steps`=48・1ステップ=1試合。`S.career{name,step,div,node,pts,gf,ga,ovrCap,boosts[],tacs[]}`。
  - **編成**: 手持ち(`S.coll`)から **OVR合計が `ovrCap` 以内の最強XI** を自動構築(`careerTeam`=貪欲+トリム)。練習で `ovrCap` を `practiceCap` ずつ緩和(`capMax` 上限)。
  - **①リーグ**: DIV3→2→1(各 `nodes`=6節)。`startCareerMatch` が div相応lv(`divLv`)の相手と1試合(`MATCH_MODES.career`)。試合中は**育成中の監督(その時点の boosts/tacs)を自チームに適用**(`homeManager`)。
  - **boost獲得**: 6節消化で `careerRecordResult` が成績連動の boost を付与(`1+boostBase[div]×perf`、perf=0.4〜1.0=勝点比)。boostは順位に関わらず毎シーズン付与(=残留しても戦力は伸びる)。
  - **順位表・昇降格(WCCF風・実装済み)**: 自チーム+同DIVの6クラブ(1枠は宿敵)で**7チームの勝点表**を蓄積(`careerTableEnsure`/`careerSimRound`=他クラブの試合を lv差で簡易シミュ `simClubResult`)。シーズン終了時に**最終順位**(`careerStandings`)で判定: `promote[div]`以内なら昇格(DIV1は1位で大陸解禁)、DIV最下位(かつdiv<3)なら降格(`div++`)、それ以外は**残留(来季再挑戦)**。`renderCareer` に順位表(自チーム=金/🟩昇格圏/🟥降格圏)を表示。
  - **宿敵ダービー(実装済み)**: 恒常ライバル`nemesis`(レガリアFC)を `careerLeaguePool` が各DIV日程の `derbyNode` 枠に注入(昇格しても付いてくる・lvは一段上=`nemesisLv`)。宿敵戦は⚔ダービー(専用ラベル)。**勝利で士気ボーナス**(全能力`+derbyMul`を監督boostへ)、引分/敗北は雪辱メッセージ。
  - **選手のシーズン内成長(Phase2・実装済み・キャリア限定/ローグライク/上限別枠)**: `S.career{growth,form,cond,season}`。
    - **成長 `growth`**: 出場して高評価(`statRating≥growthThresh`)を取ると主ステ(役割ベース`growthStatsFor`)が微増。**フェーズの`growth`倍率**(若手ほど大)を乗算、`growthCap`でクランプ。`careerApplyGrowth`(onEndで反映)。`eff` は `p.c[k]+p.grow[k]`(**OVR上限には非加算=cap別枠**、`careerTeam` のトリムは素OVR基準)。引退で消える。
    - **コンディション `cond`**: 試合開始時に各先発へ決定(`careerCondition`=前節評価＋フェーズ`condVol`×乱数、±約12〜15%)→`eff` の `p.cond` 倍率。絶好調⤴〜絶不調⤵。キックオフに絶好調/不調をfeed。
    - **加齢 `season`**: シーズン終了ごとに+1(`careerRecordResult`)。`careerTeam` が `p.ageBonus=cr.season` を付与→`effAge` が上昇し、若手→全盛期→老雄へ世代交代。**老雄/ベテランの低調な酷使**(`phase.decline`>0 かつ 評価<5.0)で spd/sta が微衰退。
    - **育成スカッド画面**: `careerSquadView` が現在の編成XIを 年齢/フェーズ・調子・成長(+N)・成長込みOVR で一覧表示(`renderCareer`)。
  - **手動XI編成(B3・実装済み・通常編成と共通仕様)**: `cr.squad{slot:cardId}` に**先発を手動指定**(空=自動)。`careerPicks` が「手動枠を尊重→空き枠を貪欲補完」、`careerTeam` の上限トリムは**自動枠のみ**下げる(選んだ主力は残す)。
    - **編成盤の共通化**: 通常編成の**ピッチ盤描画を共有関数化**(`pitchSlots(pitchEl,ctx)`/`benchSlots(box,ctx)`/`renderChemLines(pitch,squad,find)`/`openFormationPicker(onPick)`。ctx=`{squad,find,onSlot,bench,onBench,slotOvr}`)。育成のスカッドタブは同じピッチ盤(配置スロット＋タップで `#picker`→`openCareerSlotPicker`/`openCareerBenchPicker`)＋ベンチ＋フォーメーション/自動編成ボタンを表示し、`careerPool`(手持ち+助っ人)を供給。通常は `S.squad`/`S.coll`、育成は `cr.squad`/`careerPool` を差し替えるだけ=**両モードで完全に同一の操作**。
    - **上限表示**: `careerBaseTotal`(素OVR=先発トリム後+ベンチ)を上限と対比表示(超過は琥珀・手持ちの下限がcap超ならプレー可)。「⚙自動編成」で `cr.squad`/`cr.bench` をクリア。育成固有の**年齢/調子/成長**は盤の下に詳細表(`careerSquadView`)で併設。
  - **クラブの格・名声/施設(D・実装済み・アカウント恒久へ移行)**: **名声 `S.prestige` と施設 `S.fac` はアカウント全体で共有**(旧: キャリア限定 `cr.prestige`/`cr.fac`。`state.js` が旧セーブから移行)。助っ人 `cr.loan` はキャリア限定のまま。
    - **名声 `S.prestige`**: **全モードの試合**で獲得(勝+1／`giantKilling`被弾で-1)。キャリアは onEnd で追加(ダービー勝+3/カップ優勝+15/昇格+10/大陸解禁+20/DIV優勝+8/上位+5=`careerRecordResult`)。施設解放のしきい値＋助っ人の通貨。ヘッダのコイン横に常時表示(`prestigeN`・§7.x)。
    - **施設 `FACILITIES`**(`data.js`・5種): **名声しきい値 `unlock` で段階解放し、コインで拡張**(`facCost`=二次関数的)。`facLv(id)`=`S.fac[id]`。🏟スタジアム→**実効統制OVR上限 `careerCap`**(+40/Lv)、🎓アカデミー→**成長速度 `facGrowthMul`**(+15%/Lv、`careerApplyGrowth`)、🏥メディカル→**コンディション底上げ `facCondShift`**(+0.02/Lv、`careerCondition`)、🎯コーチング／🔍スカウティング。`careerFacilities` パネル(`renderCareer`)でアップグレード。初回は `facilityWelcomeGrant`(`_facGranted`)で少量付与。
    - **助っ人招へい `cr.loan`**(キャリア限定): 名声`loanCost`を払い固有選手を1人**シーズン限定**で編成プールへ(`careerLoanOffer`→`makeSignature`)。`careerPool`(=`S.coll`+loan)が careerPicks/careerTeam/編成ピッカーに供給。シーズン終了(`careerRecordResult`)で契約満了=`cr.loan=null`。
  - **統制(監督の指揮能力・実装済み)**: `careerCap`(=`cr.ovrCap`+🏟)を**統制可能OVR**と再定義。**編成OVR(素・XI+ベンチ=`careerBaseTotal`)が統制OVRを超えると超過率ぶん全能力が低下**(`careerOverloadMul`=`max(overloadFloor, 1-(編成OVR/統制OVR-1)*overloadK)`。既定は緩め K=0.5/floor0.7 → 130%で-15%・下限-30%)。`startCareerMatch` が `team.ctrl` にセット→`eff` に乗算(自チームのみ・相手/非キャリアは1.0)。スカッド/ステータス/試合開始feedに「統制超過 -N%」を表示。`careerTeam` の自動編成は統制内にトリム(=安全な既定)なので、**手動で統制を超えて強い選手を並べる/手持ちの下限が統制OVR超**の時にペナルティが発生。練習・🏟スタジアムで統制OVRを上げれば強い編成を機能させられる(=監督の成長)。
  - **③練習**: `careerPractice` で `ovrCap` を **+30〜50 ランダム**緩和(`practiceMin/Max`)。
  - **操作UI**: ①リーグ/②カップ/③練習のボタンは**スケジュールの「現在週の箱」内**(`.cur-actions`)に表示(進行が明確)。②は今週エントリー可能なカップが無ければ**非活性**。開くと現在週へ自動スクロール。
  - **満了**: step≥48 で `finalizeCareerIfDone` が `createCustomManager` で確定→監督室で起用可。`S.career=null`。
  - **配置**: **下部メニューの独立モード「🎓 育成」**(`.tabs [data-s="career"]`→`scr-career`/`#careerBox`)。リーグとは別の最上位コンテンツとして扱う。`show("career")`→`renderCareer`、`gotoCareer` は育成タブへ遷移。(旧: リーグ画面のmodeRow内モード)
  - **監督名**: 入力なし。**オーナー名(`S.coach`)を踏襲**(`startCareer` が採用)。
  - **可視化**: 活動スケジュールを **ワールドツアーと同じ `wt-card` 縦リスト**で表示(`careerScheduleList`)。各行=第N週の活動(⚽リーグ/💪練習/🏆カップ)+詳細(DIV/節/スコア)+結果チップ(🏆勝/🤝分/😢敗)。`cr.history[step]` に記録。
  - **メイン画面レイアウト(ハブ+セクションタブ・実装済み)**: 情報過多を解消するため `renderCareer` を再編。**常時表示のハブ**=`careerStatusCard`(監督名・週の進捗バー・ステージ/節/勝点・OVR上限・名声)+`careerCurrentActivity`(今週の主操作=①リーグ/②カップ/③練習/🔍偵察 or カップ戦)。その下に**セクションタブ**(`career-tabs`/`_careerTab`)で内容を切替: **📅日程**(`careerScheduleList(cr,true)`=操作ボタンはハブに集約し時系列のみ)/**🏆リーグ&カップ**(`careerStandingsTable`+`careerCupsView`)/**👥スカッド**(`careerSquadView`+編成盤)/**🏛クラブ**(`careerFacilities`)/**🎓監督**(獲得バフ・采配)。
  - **カップ/トーナメント可視化**(`careerCupsView`): 各カップの**ブラケット(勝ち上がりラダー `CUP_BRACKETS`)**・出場条件の充足・**次エントリー週**(`nextCupEntryWeek`)を常時表示(進行中は勝ち上がり=緑/現在=金でハイライト)。非進行中でも「出たらこの相手と当たる」が事前に見える。
  - **②カップ(フェーズ3・実装済み・トーナメント)**: `CUPS`(🏆国内=8強/🌍大陸=16強/🌐国際=16強。`size`/`rounds`/`poolLv`)。`cond` を満たすと `careerCupPicker`→`startCup` で**ドロー抽選**(`drawCupBracket`=自チーム`__me`+`cupClubPool`から size-1 クラブを引き、全体シャッフル=ランダム組合せ)。以後 `startCareerMatch` が各回戦の**ブラケット対戦相手**(`careerOpponent`=`__me`の隣接ペア。相手lvは引いたクラブ依存=難度がドローで変動)と対戦。
    - **勝ち上がり**: `careerCupResult(cr,sh,sa,pk)` が当該回戦のあなたの試合を結果で、他カードを `simKnockout`(lv差・引分なし)で同時進行して次回戦 `bracket[r+1]` を生成。決勝(rounds到達)を勝てば優勝、敗北(引分PK負け含む)で敗退(残りブラケットをシミュして優勝クラブ `champId` を算出=誰が勝ち上がったか表示)。回戦名は `roundLabel`(決勝/準決勝/準々決勝/1回戦…)。
    - **可視化**: `cupBracketView`(`careerCupsView`内)が各回戦のカードを並べ、自チーム=金/勝者=緑/敗者=取り消し線、現在の回戦=金枠でハイライト。
    - **PK戦(引分決着・実装済み)**: 規定時間**引分**は `pkShootout(home,away)` で決着(5本先取・交互・以降サドンデス)。専用オーバーレイ(`.pkshoot`)で1本ずつ演出(キッカーvsGK・○✕マーカー・GOAL/STOP)。キッカー順=`pkOrder`(シュート力順)、1本判定=`pkResolve`(`TUNING.setpiece.pkShootBase`・決定率≈7割)。勝者が勝ち上がり(`careerCupResult` の `pk={win,sa,sd}` で W/L に決着・履歴scに「1-1 (PK 4-2)」表記)。
    - **采配報酬**: 優勝で `CAREER_TACS[pool]` からランダム3提示→1つ選択(`offerCareerTac`)して `cr.tacs` に追加。pool=basic(基本采配)/strong(強化=`pow`増・高発動)/team(国際チームスキル)。
    - **国際チームスキル(`kind:"team"`・新エンジン)**: 発動でチーム全体を数ティック底上げ。`mgrTacAction` が `A._surgeUntil`/`A._surgeMul` を設定→`eff` が surge 倍率を乗算。例: 無敵艦隊(+25%/3T)/カナリア軍団/ディ・マンシャフト(+30%)/カテナチオ。`mgrCarryTac` は team tac を from不問で判定。
    - **カップ一覧**: 🏆キングズクラブカップ(3連勝・**5の倍数週**・DIV2到達) / 🌍コンチネンタルカップ(5連勝・**7の倍数週**・DIV1 or キングズ優勝) / 🌐インターナショナルクラブカップ(5連勝・**13の倍数週**・コンチネンタル優勝)。`cr.cupsWon` で記録。
    - **エントリー週**: 各カップは `period`(5/7/13)の倍数の週(週=step+1)のみエントリー可(`cupEntryWeek`/`cupEnterable`)。スケジュールの未来週に**該当カップのアイコンを事前表示**(`.wt-card.cupwk`=参加機会)。②ボタンは今週エントリー可なら★。
    - **任期延長**: 任期(48週)満了時に**カップ進行中なら確定を保留し、カップ決着(優勝/敗退)まで延長**(`finalizeCareerIfDone` が `cr.cup` 中は false)。優勝報酬の采配は習得後に確定判定。
    - **カップ中ロック**: カップ開始後は決着(優勝/敗退)まで、現在週の箱は**カップ戦ボタンのみ**(リーグ/練習は選べない)。
    - カップ戦もスケジュール(`history{act:"C"}`)に🏆で記録。
  - **相手クラブの見える化(名前付き・Tier・偵察)**: `OPP_CLUBS`(名前/lv/form/**seedでロスター固定**=偵察の意味が出る・👑=看板ボス)。
    - **リーグ**: `CAREER_LEAGUE[div]` に各DIV 6クラブを**固定順**配置(DIV1周回で同じ強豪と再戦=ライバル化)。
    - **カップ**: `CUP_BRACKETS[id]` に**固定ブラケット**(いつも当たる相手・末尾=看板ボス)。カップ中はブラケット全体を進捗付き(✅/▶/👑)で提示。
    - `careerOpponent(cr)` が現在の相手クラブを返し、`startCareerMatch` が `oppTeam(lv,{form,seed})` で対戦。現在週の箱に**相手名+OVR+陣形**を表示、**🔍偵察**(`careerScout`→`renderScout`)で相手XIをプレビュー→戦術/スタイル/陣形を事前に合わせられる。消化週の行にも相手名を記録表示。
  - **6大陸リーグ(フェーズ4)**: DIV1制覇で `cr.stage="cont"` に移行し**大陸リーグ解禁**。①で `careerContPicker` から大陸を選び6節シーズンを戦う(`startCont`→`cr.contId`)。制覇で**その大陸の系統ステに特化した boost**(`{pos:"all",stat:大陸stat}`・base0.045×perf=DIVより高倍率)を獲得(`careerRecordResult` continental分岐)。別大陸も順に制覇可=系統分岐で個性化。`CONTINENTS`(6): 🇪🇺欧州tec/🌏アジアspd/🌎南米off/🌍アフリカsta/🗽北中米pow/🏝オセアニアdef。各6節=共通強豪5+大陸王者(lv10・`*_ch`)。
  - **契約延長(フェーズ4)**: 任期満了(`cr.stepsMax`)時、**好成績(カップ優勝/DIV1制覇/大陸制覇 ≥1)なら `offerContractExtension`** で +`extendWeeks`(24週)を選択(最大 `extendMax`=2=最長96週)。引退で確定(`careerFinalize`)。スケジュールは `stepsMax` 週まで描画。

### 7.11 名コンビ(ホットライン): 象徴的な固有選手ペアの連携
特定の固有選手ペア(`DUOS`=[{a,b,name}]・`data.js`)が**両方スタメン**だと、片割れがボールを持った瞬間に専用連携が発動。采配と同型のトリガー。**ホーム/アウェイ両対応**(相手チームも名コンビを繰り出す)。
- **発動条件**: `MC.volt >= DUO_GATE`(=0.30、采配より緩い=両固有起用への報酬)・起点(`runChain`のキャリア)がペアの片割れ・相方もスタメン・`DUO_CHANCE`(=0.55)。`duoFires`(side非依存)。
- **効果(B=連携強化)**: 専用カットイン後、**相方(フィニッシャー)がゴール前で強力シュート**(off/tec ×1.4≒ほぼ決定機・アシストは出し手)。`duoAction`。
- **カットイン**(`duoCutin`): 出し手=左/受け手=右が同時登場、中央にコンビ名(金・放射光+強シェイク)。`.cutin.duo`。**攻撃側でtint**(自=青系/相手=赤系)。
- **編成可視化**: ペアが両方スタメンなら**金の流れる破線(ホットライン)**で結ぶ(ケミストリー線=シアンと別系統・`renderChemLines`内)。
- コンビ: クラブ系(国籍跨ぎ=プレイヤーが集めて発動) **ベルカンプ+アンリ=インヴィジブルズ** / **メッシ+ネイマール=MSN**。国籍内(ワールドツアー代表が単一国籍で自然と揃える=**相手が発動**) **アンリ+エムバペ=トリコロール**(🇫🇷) / **カカ+ネイマール=ジンガ**(🇧🇷)。`DUOS`に1行追加で拡張可。

### 7.12 編成ロール(キャプテン / プレースキッカー)
編成盤の**フィールド内上部の小タイル**(CAP/PK/FK/CK)から、スタメンに役割を割り当てる。通常編成・キャリア編成で**完全共通**(ctx方式)。
- **共通ロールctx**: `roleCtxNormal()`=通常編成(`S.captain`/`S.kickers`/`S.squad`)、`roleCtxCareer(cr)`=キャリア編成(`cr.captain`/`cr.kickers`/`cr.squad`)。両者は `{squad,find,getCap,setCap,getKick,setKick,rerender}` を持ち、以降のロールUI/試合ロジックは ctx 経由で同一コードを使う。
- **設定UI**: `renderRoleTiles(pitch,ctx)` がピッチ上部に CAP/PK/FK/CK タイルを描画。タップで `openRolePicker(ctx,role)`→スタメン(`roleStarters`)から選択。割当済みの選手スロットに `roleBadges` でCAP/PK/FK/CKの徽章を表示(👑ではなく**CAP等の文字**)。`resolveRoleId` が有効な割当(スタメン内)を解決。
- **キャプテン `captain`**:
  - **表記**: 試合開始のマッチ表記(自陣表示)にキャプテンを採用(`teamCaptain` が `activeRoleStore()`=キャリア時 `S.career`／通常 `S` を参照)。
  - **スタミナ緩和**: `fatigue()` でキャプテンは疲労 **×0.8**(消耗が緩やか)。
  - 今後の「キャプテン発動スキル」のトリガー起点として設計。
- **プレースキッカー `kickers{pk,fk,ck}`**: 設定選手が試合に出場していれば、該当セットプレーで**優先的にキッカーに選ばれる**(`pickKicker(A,kind)`)。未設定/不在時は従来のステ順選出にフォールバック。アクション起点のスキル発動を狙える。
- **後方互換**: `state.js` が `S.captain=null`/`S.kickers={pk,fk,ck}`、キャリアは `cr.captain`/`cr.kickers` を欠落補完。

### 7.13 規律(イエロー/レッドカードと出場停止)
全試合・両チームに適用する反則システム。ファウル発生時に警告/退場を抽選し、数的不利を試合に反映する。
- **調整値 `TUNING.cards`**(`data.js`): `yellow:0.14`(通常ファウル時の警告率)/`pkYellow:0.30`(PA内=重い)/`directRed:0.012`(一発退場)/`pkDirectRed:0.045`。
- **判定(`bookFoul(df,team,min,kind)`・`match-flow.js`)**: `rollFoul` がファウルを返した点(`egoRun`/`through`)で呼ぶ。まず一発退場を抽選→なければ警告抽選。**イエロー2枚累積で退場**(`df.yellow>=2`)。**GKは退場対象外**(数的計算の破綻回避)。
- **退場(`sendOff`)**: 🟥カットイン→当該選手を `team.players` から除去(**数的不利**)→`recalcAuras` で再計算。自チームの退場者は `MC.sentOffHome` に記録(キャリアの欠場処理に使用)。
- **年齢ファウル率**: `ageFoul(df)` で**ベテランほどファウルしにくい**(`AGE_PHASES` の foul レバー: 若手1.12〜老雄0.84)。`rollFoul` の確率に乗算。詳細は [試合エンジン](05-match-engine.md)。
- **キャリアの出場停止(次節欠場)**: リーグ/カップでレッドを受けると **`redcard` イベント**(§7.14)を発行し、`careerSuspended(cr)` が当該カードを**次の試合の先発から除外**(`careerTeam`/`careerBenchCards`)。控えと入れ替わる=**選手層の厚さが影響**。試合数が減るごとに `left--`。

### 7.14 クラブイベント(汎用イベント基盤)
クラブに起きている出来事を**共通のイベント配列 `cr.events`**(`{type,left,...}`)で表現し、チームタブのイベント欄にタイルで可視化する。ケガ・トロフィー等へ流用できる汎用の仕組み。
- **レジストリ `EVT_DEF`**(`ui-competition.js`): `type→{icon,cls,title(ev),sub(ev)}`。`renderEventTile`/`renderCareerEvents` がタイル描画(チームタブ「イベント」欄=コンディションの下)。未定義typeは汎用アイコンにフォールバック。
- **寿命管理**: キャリアの試合終了(onEnd)で全イベントの `left--`、`left>0` のみ表示。同種の多重発生は各ロールが抑止。
- **現行3種**:
  - 🟥 **redcard**`{cardId,name,comp,left}`: レッドカードによる次節欠場(§7.13)。`comp`=リーグ/カップ名。
  - 🌿 **growthboom**`{cardId,name,left}`(成長爆発): **成長期の選手がMOM(勝利かつ最高スタッツ)獲得時に約10%**で発生。今後3試合、その選手の**成長率2倍**(`careerApplyGrowth` が growthboom で ×2)。
  - 🔥 **grit**`{left}`(不屈): **カップ途中敗退／リーグ下位終了時に20%**で発生(`gritRoll`)。今後3試合、チーム全体の**コンディション +1段階**(`careerCondition` が +0.06)。既存の不屈があれば発動しない。
  - 🤕 **injury**`{cardId,name,left}`(負傷): **試合中のデュエルで勝敗によらず敵味方にごく低確率**(`TUNING.injury.perDuel`=0.0035/デュエル・`rollDuelInjury`)で発生。**GKはデュエルに出ない**ため別途**毎ティックごく低確率**(`TUNING.injury.gkPerTick`=0.0006・`rollGKInjury`・実測≒両GK計45試合に1回)で負傷。負傷者は**全能力×0.5**(`eff` の `p.injured`=`TUNING.injury.debuff`)で**退場せず出場継続**(GKも半減で立ち続ける=数的破綻なし。控えGKがいれば交代推奨、相手AIは負傷GKを最優先で控えGKと交代)。**通常モードはその試合限り**(次戦で消える)。**キャリアは `careerWeeks`=3試合持続**する明確なデバフイベント(onEnd で `MC.injuredHome` から登録、`careerInjured(cr)` が出場時に `p.injured` を付与=除外はしない)。
    - **治療(メディカル施設)**: `S.fac.medical`≥1 かつ負傷者がいると、キャリアの**③練習が「③治療」に変わる**(`careerCurrentActivity`/`careerScheduleList`)。治療は1ステップ消費し、各負傷を**メディカルLv×15%**で**残り週に関係なく即完治**(`careerTreat`)。施設Lvを上げるほど早期回復しやすい。
    - **秘書コメント**: 負傷発生時(`SEC_EVENT_MSG.injury`)・治療実施時(完治/未完治で文言分岐)に秘書ダイアログを表示。
- **秘書ダイアログ連携**: 発生時は秘書メッセージ(`SEC_EVENT_MSG`)を画面中段ダイアログで提示(即時系は inline、試合結果系は `secMsgs[]` に集約して結果ボタンで順次表示)。詳細は [カードデザイン §秘書ダイアログ](08-card-design.md)。

### 7.15 カップ報酬(コインとシグネチャーパック)
カップ優勝時に**大会規模に応じた報酬**を付与(大きい大会＝ハイリスク・ハイリターン)。
- **データ**: `CUPS[].reward{coins,sigPacks}`。国内(8強)＜大陸(16強)＜国際(16強)の順に厚くなる。
- **付与**: `careerCupResult` で優勝確定時に `S.coins += reward.coins`／`S.sigPacks += reward.sigPacks`。結果画面に明示し、秘書ダイアログで通知。
- **その他のシグネチャーパック入手**: ワールドツアー勝利時に**5%でドロップ**(`TUNING.worldSigPackDrop`・`world onEnd`)。実績報酬(§7.6)と併せ、入手機会を分散。

---

---

[↑ 索引](../SPEC.md)  ｜  [← 前: 6. 試合エンジン](05-match-engine.md)  ｜  [次: 8-9. レジェンドパックとアセット →](07-legend-and-assets.md)
