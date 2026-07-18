// ================= 試合進行・連鎖チェーン(オーケストレーション) =================
// 起点(オリジン)→ リンク連鎖 → シュート。リンクは LINKS レジストリで拡張可能(新種別=1エントリ)。
// リンクの「可能性」は linkAvailable(ジオメトリ)、「選択」は linkWeight(パラメータ=選手個性)。
// マッチアップ(matchupDefender)・判定(resolveLink)は match-core(純粋)、演出は match-render。

// 実況の相手側プレフィックス(相手=A側のイベントには🔴を付けて見分ける)。
const whoPrefix=T=>T.side==="A"?"🔴 ":"";
// 守備負荷(dload)をDFライン全体に分担加算(被攻撃/被シュートでDFも疲れる=A案)。
// DFは満額、低い位置のMF(アンカー等=isDeep)は0.4倍。inv(関与表示)とは別系統。
function defLoad(D,w){D&&D.players.forEach(p=>{if(p.role==="DF")p.stat.dload=(p.stat.dload||0)+w;else if(p.role==="MF"&&isDeep(p))p.stat.dload=(p.stat.dload||0)+w*0.4;});}
// 連鎖の前進度(0=自陣〜1=敵ゴール)。render座標(攻撃軸x)で算出。
function depthFrac(A,p){const x=curP(p).x;return dirOf(A)>0?x/100:(100-x)/100;}
// リンクの可能性(ジオメトリ・ゲート)。選択自体は linkWeight(パラメータ=個性)で行う。
function linkAvailable(type,ctx){
  if(type==="cross"||type==="cutin")return ctx.wide; // 幅がある(サイドに開いている)時のみ
  return true; // combination/through/dribble は常時可能
}
// 自分で持ち込む系(dribble/cut-in)の共通実行。carrierがマッチアップ守備者を抜いて自らシュート(エゴ)。
async function egoRun(ctx,type){
  const {A,D,min,tf,who,carrier}=ctx; const dir=dirOf(A),gx=goalXOf(A);
  const df=matchupDefender(carrier,D); recMatch(carrier,df);
  carrier.stat.inv++;df.stat.inv++;
  const ey=type==="cutin"?(curP(carrier).y<50?38:62):30+ri(0,40);
  const ex=gx-dir*15;
  movePlayer(carrier,ex-dir*3,ey,0.4);movePlayer(df,ex+dir*2,ey+ri(-4,4),0.4);
  await ballTo(ex-dir*3,ey,0.4,null,A.side);hot(carrier);hot(df);
  const foul=rollFoul(df,type,carrier); if(foul){feed(`${who}${df.c.name}が${carrier.c.name}を倒した!`);await bookFoul(df,D,min,foul);await setPiece(foul,A,D,min);return {shot:true};}
  const won=resolveLink(type,carrier,df,A,D,min,tf.a,tf.d,tf.bonus); // 先に判定し、VSで勝者を表示
  await maybeVs(carrier,A,df,D,type==="cutin"?"⚡ カットイン(攻×技)":"⚡ 仕掛けのドリブル(攻×速)",won);
  if(won){
    carrier.stat.duelW++;addFlow(A,TUNING.flow.duel); // 抜き去り成功→流れ
    feed(`${who}⚡ <b>${carrier.c.name}</b>(攻${carrier.c.off})が${df.c.name}を抜き去って自ら勝負!`,"chance");
    if(fx(carrier).duelSpd||fx(carrier).duelTec)await skillHit(carrier);
    if(!await trademark(carrier,"ego"))await dribbleCutin(carrier,type); // 稀にトレードマーク、通常は駆け抜け演出
    collapseDefenders(D,gx-dir*12,ey,1,0.35); // B: カバーの守備者が寄せる→抜き去りで置き去りに
    await ballTo(gx-dir*9,ey+(50-ey)*0.3,0.3,null,A.side);
    await tryShot(carrier,A,D,min,false,null,null,null,"ego");
    return {shot:true};
  }
  carrier.stat.duelL++;df.stat.duelW++;df.stat.tkl++;
  feed(`${who}${df.c.name}(守${df.c.def})が${type==="cutin"?"カットイン":"ドリブル"}を止めた!`);if(fx(df).duelD)await skillHit(df);
  addFlow(D,TUNING.flow.lost); // タックル成功→守備側に流れ
  await trademark(df,"stop"); // 守備の型のトレードマーク(ブロック/刈り取り)
  return {lost:true,reason:"tackle"};
}
// リンクのレジストリ(拡張前提: 1エントリ追加で種別が増える)。各 run は演出+resolveLinkを行い、
// {receiver,assist}=連結成功 / {shot}=フィニッシュ済み / {lost}=ロスト を返す。
const LINKS={
  // つなぎ: ワンツーで近い味方へ。成功で carrier 前進・連鎖継続。
  combination:{ run:async ctx=>{
    const {A,D,min,tf,who,carrier}=ctx; const dir=dirOf(A);
    const mate=pickW(A.players.filter(p=>p!==carrier&&p.role!=="GK"),p=>1+(dir>0?curP(p).x:100-curP(p).x)/40);
    if(!mate)return {lost:true};
    const df=matchupDefender(mate,D); recMatch(mate,df);
    carrier.stat.inv++;mate.stat.inv++;df.stat.inv++;hot(carrier);hot(mate);
    await ballTo(curP(carrier).x+dir*2,curP(carrier).y,0.3);
    await ballTo(curP(mate).x+dir*3,curP(mate).y,0.3,null,A.side);
    if(resolveLink("combination",mate,df,A,D,min,tf.a,tf.d,tf.bonus)){
      mate.stat.duelW++;addFlow(A,TUNING.flow.pass); // つなぎ成功→流れ
      feed(`${who}🔄 <b>${carrier.c.name}</b>→<b>${mate.c.name}</b> ワンツーで前進!`,"chance");
      if(skillShow())await passCutin(carrier,mate,"ワンツー"); // パス左流れ演出(熱気で頻度調整)
      await skillAny(mate,["duelTec","mid"]);
      return {receiver:mate,assist:carrier};
    }
    df.stat.tkl++;feed(`${who}${df.c.name}がパスをカット!`);if(fx(df).duelD)await skillHit(df);
    addFlow(D,TUNING.flow.lost); // インターセプト→守備側に流れ
    return {lost:true,reason:"intercept"};
  }},
  // 縦パス(終端): 抜け出すランナーへ。成功でGKと1対1。
  through:{ run:async ctx=>{
    const {A,D,min,tf,who,carrier}=ctx; const dir=dirOf(A),gx=goalXOf(A);
    const r=pickTarget(A),df=matchupDefender(r,D); recMatch(r,df);
    carrier.stat.inv++;r.stat.inv++;df.stat.inv++;
    const lx=gx-dir*18, ly=20+ri(0,60);
    movePlayer(r,lx-dir*2,ly,0.5);movePlayer(df,lx+dir*2,ly+ri(-5,5),0.5);
    await ballTo(lx,ly,0.5,null,A.side);hot(r);hot(df);
    const foul=rollFoul(df,"through",r); if(foul){feed(`${who}${df.c.name}が${r.c.name}を倒した!`);await bookFoul(df,D,min,foul);await setPiece(foul,A,D,min);return {shot:true};}
    const won=resolveLink("through",r,df,A,D,min,tf.a,tf.d,tf.bonus); // 先に判定し、VSで勝者を表示
    await maybeVs(r,A,df,D,"🚀 裏抜けの駆けっこ(速)",won);
    if(won){
      r.stat.duelW++;addFlow(A,TUNING.flow.duel); // 裏抜け成功→流れ
      feed(`${who}🚀 <b>${carrier.c.name}</b>の縦パス!<b>${r.c.name}</b>(速${r.c.spd})が抜け出した!`,"chance");
      if(await trademark(carrier,"through")){}else if(skillShow())await passCutin(carrier,r,"スルーパス"); // 稀に司令塔のトレードマーク
      if(fx(r).duelSpd)await skillHit(r);
      collapseDefenders(D,gx-dir*10,ly,1,0.35); // B: 最終ラインのカバーが寄せる
      await ballTo(gx-dir*9,ly+(50-ly)*0.3,0.3,null,A.side);
      await tryShot(r,A,D,min,false,null,null,carrier);
      return {shot:true};
    }
    df.stat.tkl++;feed(`${who}${df.c.name}(速${df.c.spd})が先回りしてクリア!`);if(fx(df).duelD)await skillHit(df);
    addFlow(D,TUNING.flow.lost); // クリア→守備側に流れ
    if(Math.random()<TUNING.setpiece.cornerOnClear){await setCorner(A,D,min);return {shot:true};}
    return {lost:true,reason:"clear"};
  }},
  // クロス(終端): 幅から中央のターゲットへ→ヘディング(aerialBox共用)。
  cross:{ run:async ctx=>{
    const {A,D,min,tf,who,carrier}=ctx;
    carrier.stat.inv++;
    feed(`${who}🏃 <b>${carrier.c.name}</b>がクロスを上げる!`,"chance");
    if(await trademark(carrier,"cross")){}else if(skillShow())await crossCutin(carrier); // 稀にサイドのトレードマーク
    await ballTo(curP(carrier).x,curP(carrier).y,0.25,null,A.side);
    const r=await aerialBox(A,D,min,carrier,tf,who);
    if(r.shot)return {shot:true};
    if(Math.random()<TUNING.setpiece.cornerOnClear){await setCorner(A,D,min);return {shot:true};} // 危険なクリア→CK
    return {lost:true,reason:"clear"};
  }},
  // ドリブル(終端・エゴ): 中央で守備者を抜いて自らシュート。
  dribble:{ run:ctx=>egoRun(ctx,"dribble") },
  // カットイン(終端・エゴ): 幅から中へ切れ込んで自らシュート。
  cutin:{ run:ctx=>egoRun(ctx,"cutin") },
};
// 名将の攻撃采配の発動判定: 起点キープレイヤー(carrier=from一致)が実際にボールを持った瞬間、
// ボルテージが一定以上(熱気が高まった局面)かつ条件達成・確率で発動。
function mgrCarryTac(A,carrier){
  if(!MC||(MC.volt||0)<TUNING.volt.tacGate)return null;       // ボルテージが一定以上
  if(A.side!=="H"||!A.mgr)return null;
  const surge=1+(A.ctrlSurge||0); // 統率に余裕があるほど采配が出やすい(隠し・最大×1.20)
  for(const tac of mgrTacs(A.mgr)){                            // カスタム監督は複数tacを順に判定(名将は単数)
    if(tacIsDef(tac.from))continue;                           // 守備采配(cb=ブロック/gk=セーブ)は tryShot 側で発火
    if(tac.kind==="team"){ if(tacCondMet(tac,A)&&Math.random()<tac.chance*surge)return tac; continue; } // 国際チームスキルはfrom不問
    if(!tacFromMatch(tac,carrier)||!tacCondMet(tac,A))continue; // 起点が采配のキープレイヤーか
    if(Math.random()<tac.chance*surge)return tac;
  }
  return null;
}
async function mgrTacAction(A,D,min,carrier,tac,who){
  if(tac.kind==="team"){ // 国際チームスキル: チーム全体を数ティック底上げ(surge)
    const s=tac.surge||{}; A._surgeUntil=min+(s.ticks||3)*TUNING.match.tickMin; A._surgeMul=s.mul||1.2;
    feed(`${who}🌟 監督の采配!【${tac.name}】 チーム全体が覚醒した!`,"goal");
    addVolt(TUNING.volt.goal);
    await tacCutin(tac,A.mgr,carrier);
    return;
  }
  feed(`${who}🎓 監督の采配!【${tac.name}】が炸裂!`,"goal");
  addVolt(TUNING.volt.shot);
  await tacCutin(tac,A.mgr,carrier);
  const pw=tac.pow||1; // 強化采配は効果増
  const act=tacAct(tac.from), dir=dirOf(A), gx=goalXOf(A);
  if(act==="cross"){ // アーリークロス/サイドチェンジ → 空中戦(采配ボーナス)
    await ballTo(curP(carrier).x,curP(carrier).y,0.2);
    await aerialBox(A,D,min,carrier,{a:1.3*pw,d:1,bonus:1.3*pw},who);
    return;
  }
  if(act==="shot"){ // 起点FW(ST/CF)がそのままボックスへ持ち込み強引にフィニッシュ
    const ly=42+ri(0,14); carrier.stat.inv++;
    movePlayer(carrier,gx-dir*10,ly,0.4); await ballTo(gx-dir*10,ly,0.4); hot(carrier);
    feed(`${who}⚡ <b>${carrier.c.name}</b>が強引に持ち込む!`,"chance");
    await ballTo(gx-dir*8,ly+(50-ly)*0.3,0.3);
    await tryShot(carrier,A,D,min,false,null,null,carrier);
    return;
  }
  // through(電光タクト/電撃カウンター等): 抜け出すランナーへ決定的スルー → 1対1
  const r=pickTarget(A)||carrier; r.stat.inv++;
  const ly=28+ri(0,44);
  movePlayer(r,gx-dir*12,ly,0.4); await ballTo(gx-dir*12,ly,0.4); hot(r);
  feed(`${who}⚡ <b>${r.c.name}</b>が抜け出した!`,"chance");
  await ballTo(gx-dir*9,ly+(50-ly)*0.3,0.3);
  await tryShot(r,A,D,min,false,null,null,carrier);
}
// 名コンビ(ホットライン)の発動判定: 自チーム・ボルテージ一定以上・起点が固有ペアの片割れで
// 相方もスタメン・確率。発動なら {duo, partner(=フィニッシャー)} を返す。
function duoFires(A,carrier){
  // ホーム/アウェイ両対応(相手チームも名コンビを発動できる)。両者がスタメンに揃い・ボルテージ閾値・起点が片割れ。
  if(!MC||(MC.volt||0)<DUO_GATE||!carrier.c.sig)return null;
  for(const duo of DUOS){
    const mate=duo.a===carrier.c.sig?duo.b:duo.b===carrier.c.sig?duo.a:null;
    if(!mate)continue;
    const partner=A.players.find(p=>p!==carrier&&p.c.sig===mate);
    if(partner&&Math.random()<DUO_CHANCE)return {duo,partner};
  }
  return null;
}
// 名コンビ発動: 専用カットイン → 受け手がゴール前で強力フィニッシュ(ほぼ決定機=効果B)。
async function duoAction(A,D,min,passer,fin,duo){
  const who=whoPrefix(A);
  feed(`${who}⚡ 名コンビ【${duo.name}】炸裂! <b>${passer.c.name}</b>→<b>${fin.c.name}</b>!`,"goal");
  addVolt(TUNING.volt.goal);
  await duoCutin(duo,passer,fin,A);
  const gk=pickGK(D),dir=dirOf(A),gx=goalXOf(A);
  fin.stat.shots++;fin.stat.inv++;passer.stat.inv++;gk.stat.inv++;defLoad(D,TUNING.fatigue.dloadShot);
  movePlayer(fin,gx-dir*9,50,0.3);movePlayer(gk,gx-dir*2,48,0.3);
  await ballTo(gx-dir*10,50,0.3);hot(fin);
  const sSc=(eff(fin,"off",min,A,D)*0.6+eff(fin,"tec",min,A,D)*0.4)*1.4*(fx(fin).shoot||1)*rr(); // ×1.4=ほぼ決定機
  const gSc=eff(gk,"def",min,D,A)*(fx(gk).save||1)*lineDefMul(D,min)*rr();
  if(sSc>gSc*TH.gk){
    await ballTo(gx+dir*1.5,48,0.22,"linear");
    await goalCelebrate(fin,A,D,min,{assist:passer});
  }else{
    gk.stat.saves++;await ballTo(gx-dir*1,48,0.22,"linear");
    feed(`${who}🧤 ${gk.c.name}が立ちはだかった!`);await wordCutin(gk,D,"SAVE!!",false,650);await ballTo(gx-dir*14,50,0.5);
  }
}
// キャリア(起点保持)時の特殊フック・レジストリ。各フックは detect(ctx)→data|null と run(ctx,data)。
// runChain の連鎖ループ先頭で順に評価し、最初に発動したものでチェーン終了。新フロー追加=1エントリ。
const CARRY_HOOKS=[
  { detect:({A,carrier})=>mgrCarryTac(A,carrier),                                   // 名将の攻撃采配
    run:async (c,tac)=>mgrTacAction(c.A,c.D,c.min,c.carrier,tac,c.who) },
  { detect:({A,carrier})=>duoFires(A,carrier),                                      // 名コンビ(ホットライン)
    run:async (c,d)=>duoAction(c.A,c.D,c.min,c.carrier,d.partner,d.duo) },
];
// 連鎖チェーン: 起点→リンク×N→シュート。深さ/つなぎ数でシュート移行率が増え自然終端。
async function runChain(channel,A,D,min,origin){
  const counter=channel==="win"?TUNING.origin.counterBonus:1;
  const tf={ a:(A.tactic==="atk"?TUNING.tactic.atk:A.tactic==="def"?TUNING.tactic.def:1)*counter,
             d:(D.tactic==="def"?TUNING.tactic.atk:D.tactic==="atk"?TUNING.tactic.def:1), bonus:1 };
  const who=whoPrefix(A);
  const L=TUNING.link, maxL=chanMaxLink(channel), dir=dirOf(A), gx=goalXOf(A);
  let carrier=origin, assist=null, steps=0, prog=depthFrac(A,origin);
  while(true){
    // キャリア保持時の特殊フック(采配/名コンビ/…)を順に評価。発動でチェーン終了。
    const hctx={A,D,min,carrier,who};
    let fired=false;
    for(const hk of CARRY_HOOKS){ const data=hk.detect(hctx); if(data){ await hk.run(hctx,data); fired=true; break; } }
    if(fired)return;
    const sc=L.directShootBase+prog*L.depthShoot+steps*L.stepShoot;
    if(steps>=maxL||Math.random()<sc){ await tryShot(carrier,A,D,min,false,null,null,assist); return; }
    const ctx={A,D,min,tf,who,carrier,wide:isWide(carrier),adv:prog>=L.advanced};
    const types=Object.keys(LINKS).filter(t=>linkAvailable(t,ctx));
    const type=pickW(types,t=>linkWeight(t,carrier,min,A,D));
    recordLink(MC,type,carrier);
    const out=await LINKS[type].run(ctx);
    if(out.lost){await ballTo(curP(carrier).x-dir*8,curP(carrier).y+ri(-10,10),0.5,null,D.side);return;}
    if(out.shot)return;
    carrier=out.receiver; if(out.assist)assist=out.assist; steps++;
    prog=Math.min(0.9,prog+L.progStep);
    movePlayer(carrier,gx-dir*(18-steps*4),curP(carrier).y,0.4); // 連結のたびに受け手が前進
    reactField(A.side,0.4); // A: 連結が進むたびにブロック全体が前進(ボールだけが進む違和感を解消)
  }
}
// 試合テレメトリ(中検証で読む)。起点/リンク/エゴ/マッチアップ整合を集計。
function ensureTele(M){return M.telemetry||(M.telemetry={
  ch:{build:0,overlap:0,feed:0,win:0}, role:{GK:0,DF:0,MF:0,FW:0}, atks:0,
  link:{combination:0,through:0,cross:0,dribble:0,cutin:0}, links:0,
  ego:{n:0,offSum:0,driverN:0}, mu:{sum:0,n:0}, sp:{fk:0,pk:0,ck:0,goals:0} });}
function recordOrigin(M,ch,p){const t=ensureTele(M);t.ch[ch]=(t.ch[ch]||0)+1;t.role[p.role]=(t.role[p.role]||0)+1;t.atks++;}
function recordLink(M,type,carrier){const t=ensureTele(M);t.link[type]=(t.link[type]||0)+1;t.links++;
  if(type==="dribble"||type==="cutin"){t.ego.n++;t.ego.offSum+=carrier.c.off;const ty=carrier.c.type;if(ty==="dribbler"||ty==="winger")t.ego.driverN++;}}
function recMatch(recv,df){const t=ensureTele(MC);const dist=Math.abs((100-recv.x)-df.x);t.mu.sum+=Math.max(0,1-dist/100);t.mu.n++;}
function recordSet(M,kind,goal){const t=ensureTele(M);if(t.sp[kind]!=null)t.sp[kind]++;if(goal)t.sp.goals++;}

// ===== セットプレー(別レイヤー: 連鎖の副次結果から派生・プリミティブ流用) =====
let _spActive=false; // セットプレー処理中フラグ(CK→ヘディング→セーブ→CK の無限再帰を防ぐ)
// 高ベースのシュート vs GK の純判定(PK/直接FK共用)。
async function spShot(taker,A,D,min,base,label,kind,opt={}){
  const gk=pickGK(D),dir=dirOf(A),gx=goalXOf(A);
  taker.stat.inv++;taker.stat.shots++;gk.stat.inv++;defLoad(D,TUNING.fatigue.dloadShot);
  movePlayer(taker,gx-dir*9,50,0.3);movePlayer(gk,gx-dir*2,48,0.3);
  await wordCutin(taker,A,label,false,800,opt.knuckle);
  const sSc=(eff(taker,"off",min,A,D)*0.6+eff(taker,"tec",min,A,D)*0.4)*base*(fx(taker).shoot||1)*rr();
  const gSc=eff(gk,"def",min,D,A)*(fx(gk).save||1)*lineDefMul(D,min)*rr();
  if(sSc>gSc*TH.gk){
    if(opt.knuckle){ // 無回転=不規則に揺れて落ちる軌道(ブレ球)
      for(let i=0;i<3;i++)await ballTo(gx-dir*(6-i*2),46+(i%2?6:-6),0.09,"linear");
    }
    await ballTo(gx+dir*1.5,48,0.22,"linear");
    await goalCelebrate(taker,A,D,min,{kind,super:opt.sup});
    return true;
  }
  gk.stat.saves++;await ballTo(gx-dir*1,48,0.22,"linear");
  feed(`🧤 ${gk.c.name}がストップ!`);await wordCutin(gk,D,"SAVE!!",false,650);await ballTo(gx-dir*14,50,0.5);
  return false;
}
// 空中戦(クロス/CK/クロスFK 共用): ターゲットがヘディング → シュート。CK/危険クリアは派生元。
async function aerialBox(A,D,min,deliverer,tf,who){
  const dir=dirOf(A),gx=goalXOf(A);
  const t=pickTarget(A),df=matchupDefender(t,D); recMatch(t,df);
  t.stat.inv++;df.stat.inv++;
  const cx=gx-dir*7, cy=42+ri(0,16);
  collapseDefenders(D,cx,cy,2,0.4); // B: 守備陣がボックスに密集
  movePlayer(t,cx-dir*2,cy,0.4);movePlayer(df,cx+dir*2,cy+ri(-4,4),0.4);
  await ballTo(cx,cy,0.4,null,A.side);hot(t);hot(df);
  if(resolveLink("cross",t,df,A,D,min,tf.a,tf.d,tf.bonus)){
    t.stat.duelW++;addFlow(A,TUNING.flow.duel); // 空中戦勝ち→流れ
    feed(`${who}中央で<b>${t.c.name}</b>(力${t.c.pow})が競り勝つ!`,"chance");
    if(fx(t).duelPow)await skillHit(t);
    await trademark(t,"aerial"); // ポスト系のトレードマーク(収めて起点)
    await tryShot(t,A,D,min,true,cx,cy,deliverer);
    return {shot:true};
  }
  df.stat.tkl++;feed(`${who}${df.c.name}(力${df.c.pow})が跳ね返した!`);if(fx(df).duelD)await skillHit(df);
  addFlow(D,TUNING.flow.lost); // 跳ね返し→守備側に流れ
  return {clear:true};
}
// セットプレー レジストリ(pk/fk/ck)。各 run は自己完結(キッカー選定→演出→spShot/aerialBox)。
// 追加=1エントリ+呼び出し元。共有プリミティブは spShot(高ベース判定)/aerialBox(空中戦)。
const SETPIECES={
  pk:{ async run(A,D,min){
    const who=whoPrefix(A), taker=pickKicker(A,"pk"), dir=dirOf(A),gx=goalXOf(A);
    recordSet(MC,"pk");
    feed(`${who}🎯 PK獲得! <b>${taker.c.name}</b>がスポットへ`,"goal");
    movePlayer(taker,gx-dir*11,50,0.4); // キッカーもスポットへ(ボールだけが動く違和感を解消)
    await ballTo(gx-dir*8,50,0.4);
    await pkCutin(taker,pickGK(D)); // キッカー vs GK の一騎打ち
    const g=await spShot(taker,A,D,min,TUNING.setpiece.pkBase,"PK!!","pk");
    if(g)recordSet(MC,"pk",true);
  }},
  fk:{ async run(A,D,min){
    const who=whoPrefix(A), taker=pickKicker(A,"fk"), dir=dirOf(A),gx=goalXOf(A);
    recordSet(MC,"fk");
    const wide=curP(taker).y<35||curP(taker).y>65;
    const knuckle=!!fx(taker).freekick; // エモーショナル等のFK専門家=無回転FKの“瞬間”
    if(knuckle&&!wide){ // 専用シーケンス: エモーショナル・カットイン → 無回転FK → 高威力
      if(taker.c.emo)await emoMoment(taker); // モーメント・カットイン(1試合1回)
      feed(`${who}⚡ <b>${taker.c.name}</b>の直接FK… 無回転で蹴り込むか!`,"goal");
      await spCutin(taker,"無回転フリーキック");
      movePlayer(taker,gx-dir*23,50,0.45);
      await ballTo(gx-dir*20,50,0.45);
      const g=await spShot(taker,A,D,min,1.15*fx(taker).freekick,"無回転FK!!","fk",{knuckle:true,sup:true});
      if(g)recordSet(MC,"fk",true);
    }else if(!wide&&Math.random()<TUNING.setpiece.fkDirectShare){
      feed(`${who}⚡ 直接FKのチャンス! <b>${taker.c.name}</b>`,"chance");
      await spCutin(taker,"直接フリーキック");
      movePlayer(taker,gx-dir*23,50,0.45); // キッカーもFK地点へ(ボールだけが動く違和感を解消)
      await ballTo(gx-dir*20,50,0.45);
      const g=await spShot(taker,A,D,min,1.15,"直接FK!!","fk");
      if(g)recordSet(MC,"fk",true);
    }else{
      feed(`${who}🏃 FKからのクロス! <b>${taker.c.name}</b>が蹴る`,"chance");
      await spCutin(taker,"フリーキック");
      const fy=curP(taker).y;
      movePlayer(taker,gx-dir*25,fy,0.45); // キッカーもFK地点へ(ボールだけが動く違和感を解消)
      await ballTo(gx-dir*22,fy,0.45);
      await aerialBox(A,D,min,taker,{a:1.05,d:1,bonus:1},who); // 得点はtryShot内で計上
    }
  }},
  ck:{ async run(A,D,min){ // CK: 危険なクリア/セーブから派生。キッカーのクロス → 空中戦。
    const who=whoPrefix(A), kicker=pickKicker(A,"ck"), dir=dirOf(A),gx=goalXOf(A);
    recordSet(MC,"ck");
    feed(`${who}🚩 コーナーキック! <b>${kicker.c.name}</b>が蹴る`,"chance");
    await spCutin(kicker,"コーナーキック");
    const cy=curP(kicker).y<50?8:92;
    movePlayer(kicker,gx-dir*5,cy,0.45); // キッカーもコーナーへ走り込む(ボールだけが動く違和感を解消)
    await ballTo(gx-dir*2,cy,0.45);
    await aerialBox(A,D,min,kicker,{a:1.05,d:1,bonus:1},who);
  }},
};
// カード判定: ファウルした守備側 df へイエロー/レッドを抽選。2枚目イエロー→退場。稀にダイレクトレッド。
// kind: "pk"=エリア内(重い) / "fk"=通常。team=df の所属チーム(D)。
async function bookFoul(df,team,min,kind){
  if(!df||df.sentOff||df.role==="GK")return; // GKの退場はレア過ぎるので除外(数的計算の破綻回避)
  const C=(TUNING.cards)||{};
  const pk=kind==="pk";
  if(Math.random()<(pk?(C.pkDirectRed||0.045):(C.directRed||0.012))){ await sendOff(df,team,min,true); return; }
  if(Math.random()<(pk?(C.pkYellow||0.30):(C.yellow||0.14))){
    df.yellow=(df.yellow||0)+1;
    if(df.yellow>=2){ feed(`🟨🟨 ${df.c.name} 2枚目の警告! 退場!`,"chance"); await sendOff(df,team,min,false); }
    else feed(`🟨 ${df.c.name} に警告(イエローカード)`,"chance");
  }
}
async function sendOff(p,team,min,direct){
  if(!p||p.sentOff)return; p.sentOff=true;
  try{ await wordCutin(p,team,"🟥 RED CARD",false,850); }catch(e){} // 退場演出(選手が盤上のうちに)
  const i=team.players.indexOf(p); if(i>=0)team.players.splice(i,1); // 数的不利へ
  if(typeof recalcAuras==="function")recalcAuras(team);               // ケミストリー/オーラ再計算
  feed(`🟥 ${direct?"一発退場! ":""}${p.c.name} が退場! ${team.side==="H"?"自陣":"相手"}は ${team.players.length}人に`,"goal");
  if(team.side==="H"){ MC.sentOffHome=MC.sentOffHome||[]; if(!MC.sentOffHome.some(x=>x.id===p.c.id))MC.sentOffHome.push({id:p.c.id,name:p.c.name}); } // キャリアの欠場記録用
}
// ② 不屈イベント抽選(20%): 逆境(カップ敗退/リーグ下位)で発動。今後3試合チームのコンディションを1段階底上げ。
// 返り値=結果表示html(発動時のみ)。同時多重は避ける(既存の不屈があれば発動しない)。
function gritRoll(cr){
  if(!cr||(cr.events||[]).some(ev=>ev.type==="grit"&&ev.left>0)||Math.random()>=0.20)return "";
  cr.events.push({type:"grit",left:3});
  return `<div class="banner" style="font-size:14px;color:#ff9e54">🔥 不屈! 逆境をバネにチームのコンディションが今後3試合 底上げ!</div>`;
}
// ファウル → FK or PK。再帰防止フラグでガードしつつレジストリへディスパッチ。
async function setPiece(kind,A,D,min){
  if(_spActive)return; _spActive=true;
  try{ await (SETPIECES[kind]||SETPIECES.fk).run(A,D,min); }finally{_spActive=false;}
}
async function setCorner(A,D,min){
  if(_spActive)return; _spActive=true;
  try{ await SETPIECES.ck.run(A,D,min); }finally{_spActive=false;}
}
const teamName=T=>T.side==="H"?myName():((MC&&MC.name)||"相手");
// ボルテージ加算(イベントで熱気が上がる)。0.7初到達で「ヒートアップ」を1回告知。
function addVolt(x){
  if(!MC)return;
  MC.volt=Math.min(1,(MC.volt||0)+x);
  if(MC.volt>=0.7&&!MC._heated){MC._heated=true;feed("🔥 ヒートアップ!スタジアムが沸いてきた!","chance");}
}
// ===== モメンタム&テリトリー(勢い/陣地): 行動が支配率と起点位置にフィードバックする戦術レイヤー =====
// mom: -1(相手優勢)〜+1(自チーム優勢)。volt(演出の熱気)とは別系統。攻撃側から見た自分の勢い=momOf。
const momOf=T=>(T&&T.side==="A")?-(MC.mom||0):(MC.mom||0);
const _ctrlOf=T=>((T===MC.home?MC.home:MC.away)._ctrl)||1;
// 行動→モメンタム加算。良いプレーをした側Tが得る。支配力で獲得増、相手の支配力で目減り(流れを渡さない)。
function addFlow(T,base){
  if(!MC||!T)return;
  const F=TUNING.flow, gain=T.side==="H"?1:-1;
  const other=T===MC.home?MC.away:MC.home;
  const delta=base*(1+(_ctrlOf(T)-1)*F.ctrlK)/(1+(_ctrlOf(other)-1)*F.resistK);
  MC.mom=Math.max(-F.cap,Math.min(F.cap,(MC.mom||0)+gain*delta));
}
// 攻撃側のテリトリー(起点の前後押し・render攻撃軸のオフセット): 自分の勢い×terr + 支配力による基準押上げ。
function territory(T){ const F=TUNING.flow; return momOf(T)*F.terr+(_ctrlOf(T)-1)*F.terrCtrl; }
// 起点選定用の正規化テリトリー(-1..1)。
const terrNorm=T=>Math.max(-1,Math.min(1, momOf(T)+(_ctrlOf(T)-1)*0.3));
// 支配率バー(HUD)を現在の支配率シェアで更新。押し込み/押し下げを可視化。
function updateMomBar(share){
  const f=document.getElementById("mbarFill"); if(f)f.style.width=Math.round(Math.max(4,Math.min(96,share*100)))+"%";
}
// ゴール演出の集約: 加点 + 種別/スーパー判定 + スコアpop/歓声 + バナー/カットイン + 流れ(同点・勝ち越し・ハット)。
async function goalCelebrate(scorer,A,D,min,opts={}){
  const preA=A.score, preD=D.score;
  addVolt(TUNING.volt.goal); // 得点で熱気が一気に上がる
  addFlow(A,TUNING.flow.goal); // 得点で流れを大きく引き寄せる
  A.score++; scorer.stat.goals++; if(opts.assist)opts.assist.stat.assists++;
  document.getElementById(A.side==="H"?"sH":"sA").textContent=A.score;
  scorePop(A.side); crowdPulse();
  const who=whoPrefix(A);
  const sup=opts.super||((opts.dist||0)>=35&&(scorer.c.off>=15||scorer.c.pow>=15)); // 遠目の強烈な一撃=スーパー
  let msg;
  if(sup)msg=`🚀 スーパーゴール!!<b>${scorer.c.name}</b>が遠目から突き刺した!`;
  else if(opts.kind==="pk")msg=`⚽ PK成功!<b>${scorer.c.name}</b>が沈めた!`;
  else if(opts.kind==="fk")msg=`⚽ 直接FK弾!<b>${scorer.c.name}</b>!`;
  else if(opts.kind==="ego")msg=`⚽ 個人技!!<b>${scorer.c.name}</b>が単騎で抉じ開けた!`;
  else if(opts.header)msg=`⚽ ヘディング弾!<b>${scorer.c.name}</b>(力${scorer.c.pow})!`;
  else msg=`⚽ ゴーーール!!<b>${scorer.c.name}</b>が決めた!(攻${scorer.c.off})`;
  feed(`${who}${msg}`,"goal");
  if(fx(scorer).shoot)await skillHit(scorer);
  await trademark(scorer,"goal"); // ストライカー系のトレードマーク(決定力の化身)
  await wordCutin(scorer,A,sup?"SUPER GOAL!!":"GOAL!!!",true,sup?1700:1450,sup);
  if(preA<preD&&A.score===preD)feed(`${who}🔥 ${teamName(A)}が同点に追いついた!`,"chance");
  else if(preA===preD&&A.score>preD)feed(`${who}🔥 ${teamName(A)}が勝ち越し!`,"chance");
  if(scorer.stat.goals===2)feed(`${who}⭐ ${scorer.c.name} 2点目!`);
  if(scorer.stat.goals===3)feed(`${who}🌟 ${scorer.c.name} ハットトリック達成!!`,"goal");
  await kickoffReset();
}
// シュート: 演出 → resolveShot で判定 → ゴール/セーブ(奇跡の手は1試合1回失点無効)
async function tryShot(atk,A,D,min,header,fx0,fy0,assist,kind){
  // 名将の采配シグネ(守備): 相手にシュートされた瞬間、熱気が一定以上なら守備采配で失点を防ぐ(cb=ブロック / gk=セーブ)
  if(A.side==="A"&&MC&&MC.home&&(MC.volt||0)>=TUNING.volt.tacGate){
    const dtac=mgrCbTac(MC.home); // 自チームの守備采配(cb/gk)を1つ取得(カスタム監督の複数tacにも対応)
    if(dtac&&Math.random()<dtac.chance*(1+(MC.home.ctrlSurge||0))){ // 統率の余裕で発動率アップ(隠し)
      if(tacAct(dtac.from)==="save"){ // 守護神のセーブ: GKがスーパーセーブ
        const gk=pickGK(MC.home);gk.stat.saves++;gk.stat.inv++;
        feed(`🎓 監督の采配!【${dtac.name}】<b>${gk.c.name}</b>が驚異のセーブ!`,"chance");
        await tacCutin(dtac,MC.home.mgr,gk);
      }else{ // 密集ブロック等: CBが身体を投げ出してブロック
        const cb=MC.home.players.find(p=>p.subRole==="CB")||pickDefender(MC.home);
        cb.stat.tkl++;cb.stat.inv++;
        feed(`🎓 監督の采配!【${dtac.name}】<b>${cb.c.name}</b>が身体を投げ出してブロック!`,"chance");
        await tacCutin(dtac,MC.home.mgr,cb);
      }
      await ballTo(goalXOf(A)-dirOf(A)*16,50,0.45); // 弾き出し
      return;
    }
  }
  atk.stat.shots++;
  addVolt(TUNING.volt.shot); // シュートで熱気が上がる
  addFlow(A,TUNING.flow.shot); // シュートまで持ち込めば流れを引き寄せる
  const gk=pickGK(D);
  atk.stat.inv++;gk.stat.inv++;defLoad(D,TUNING.fatigue.dloadShot);
  await auraSkill(A,"teamChance",TUNING.aura.teamChance); // 決定機を演出した司令塔役(teamChance)の発動を明示
  const fxA=fx(atk),fxG=fx(gk);
  const dir=dirOf(A),gx=goalXOf(A);
  const sx=fx0!=null?fx0:curP(atk).x, sy=fy0!=null?fy0:curP(atk).y;
  const gy=42+ri(0,16);
  movePlayer(atk,sx,sy,0.3);
  movePlayer(gk,gx-dir*2,gy,0.3);     // GKがコースに立つ
  reactField(A.side,0.3); // 全体がゴール前へ詰める(ボールだけがゴール前にいる違和感を解消)
  hot(atk);hot(gk);
  await wordCutin(atk,A,header?"ヘディング!!":"シュート!!",false,750);
  if(resolveShot(atk,gk,header,A,D,min)){
    if(fxG.miracle&&!gk.um){ // レジェンドGK【奇跡の手】:1試合1回の失点無効化
      gk.um=true;
      gk.stat.saves++;
      await ballTo(gx-dir*1,gy,0.22,"linear");
      feed(`✨【奇跡の手】発動!!${gk.c.name}がありえない反応で掻き出した!!`,"goal");
      await wordCutin(gk,D,"MIRACLE!!",true,1200);
      await ballTo(gx-dir*16,gy+ri(-12,12),0.5);
      return;
    }
    await ballTo(gx+dir*1.5,gy,0.22,"linear");   // ネットに突き刺さる
    await goalCelebrate(atk,A,D,min,{header,assist,kind,dist:Math.abs(gx-sx)});
  }else{
    gk.stat.saves++;
    await ballTo(gx-dir*1,gy,0.22,"linear");
    movePlayer(gk,gx-dir*1,gy,0.18);               // GKが触る
    feed(`GK ${gk.c.name}(守${gk.c.def})がストップ!`);
    if(fxG.save)await skillHit(gk);
    await auraSkill(D,"teamDef",TUNING.aura.teamDef); // 守備陣を統率する teamDef の発動を明示
    if(!await trademark(gk,"save"))await wordCutin(gk,D,"SAVE!!",false,720); // 稀にGKのトレードマーク
    if(!_spActive&&Math.random()<TUNING.setpiece.cornerOnSave){await setCorner(A,D,min);return;} // 弾いてCK
    await ballTo(gx-dir*14,gy+ri(-12,12),0.5);     // 弾き出し
  }
}

// ================= 試合進行(非同期ループ) =================
async function tickAsync(){
  const M=MC, MT=TUNING.match;
  M.min+=MT.tickMin;
  const clk=document.getElementById("clock");
  clk.textContent=(M.min>=MT.fullMin?"90+":M.min)+"分";
  if(M.min>=MT.lateMin)clk.classList.add("late");         // 終盤は時計を赤く
  if(M.min===MT.lastChanceMin&&Math.abs(M.home.score-M.away.score)<=1)feed("⏱ 終了間際!ラストチャンスだ!","chance"); // 接戦のみ煽る
  // ボルテージ: 停滞で冷め(decay)、時間で下限が上昇。閾値未満でヒートアップ告知をリセット。
  M.volt=Math.max((M.volt||0)*TUNING.volt.decay, M.min/MT.fullMin*TUNING.volt.timeFloor);
  if(M.volt<TUNING.volt.heatReset)M._heated=false;
  M.mom=(M.mom||0)*TUNING.flow.decay; // モメンタム: 毎ティック中立へ減衰(流れは移ろう)
  M.home._ctrl=flowControl(M.home); M.away._ctrl=flowControl(M.away); // 支配力(mid支配率スキル/支配型)を毎ティック算出
  M.home.tactic=S.tactic;M.home.style=S.style;
  if(M.min===MT.oppAdjustMin){
    M.away.tactic=M.away.score<M.home.score?"atk":M.away.score>M.home.score?"def":"bal";
    if(M.away.tactic==="atk")feed(`${M.name}がカードを前に動かしてきた!攻勢だ!`);
  }
  // 支配率シェア = midPower比 に モメンタム(勢い)を反映(良いプレーを続けた側が実際に支配を上げる)。
  const fk=TUNING.flow.possK;
  const mh=midPower(M.home,M.away,M.min)*Math.max(0.2,1+M.mom*fk), ma=midPower(M.away,M.home,M.min)*Math.max(0.2,1-M.mom*fk);
  const tShare=mh/(mh+ma); updateMomBar(tShare); // HUDの支配率バーを更新
  // 主導権(支配率比) → 奪取(カウンター)判定 → チャンネル/起点選択
  let T=Math.random()<tShare?M.home:M.away;
  let D=T===M.home?M.away:M.home;
  let channel,origin;
  if(rollTurnover(T,D,M.min)){
    [T,D]=[D,T];channel="win";origin=pickWinner(T,D,M.min);
    addFlow(T,TUNING.flow.turnover); // 奪取=大きな流れの転換
    feed(`${whoPrefix(T)}⚡ ${origin.c.name}がボールを奪った!カウンターのチャンス!`,"chance");
  }else{
    channel=pickChannel(T,D,M.min,terrNorm(T)); // 起点選定もテリトリー連動(押し込む=高い起点/押される=深い起点)
    origin=pickOriginPlayer(T,D,channel,M.min);
  }
  // モメンタム(連続攻撃): 同じチームが攻め続けると「猛攻」コール
  if(M._lastAtk===T.side){M._streak=(M._streak||1)+1;}else{M._streak=1;M._lastAtk=T.side;}
  if(M._streak===MT.streakHeat){feed(`${whoPrefix(T)}🔥 ${teamName(T)}の猛攻!押し込んでいる!`,"chance");addVolt(TUNING.volt.surge);addFlow(T,TUNING.flow.streak);}
  const dir=dirOf(T);
  defLoad(D,1); // 被攻撃ぶんの守備負荷を相手DFラインに分担(忙しい試合ほどDFが疲れる)
  await auraSkill(T,"mid",TUNING.aura.mid); // 中盤を支配した側の mid 系スキル(支配率)の発動を明示
  origin.stat.inv++;
  // 消耗が一定を超えた選手に「疲れが見える」を一度だけ告知(交代の判断材料/演出)
  if(!origin._gassed && (1-fatigue(origin,M.min))>=TUNING.fatigue.gassedFeed){
    origin._gassed=true;
    feed(`${whoPrefix(T)}💨 ${origin.c.name}に疲れが見える…動きが重くなってきた`);
  }
  const terr=territory(T), ox=clX(curP(origin).x+dir*(2+terr)); // 勢い/支配で起点位置が上下(押し込み/押し下げ)
  movePlayer(origin,ox,curP(origin).y,0.5);
  await ballTo(ox,curP(origin).y,0.4); // 起点へボールが収まる
  updateField(T.side);
  const edge=(T===M.home)?tShare:1-tShare;
  if(buildupSuccess(channel,edge)){
    recordOrigin(M,channel,origin);
    addVolt(TUNING.volt.atk); // 攻撃が形になると熱気が上がる
    await runChain(channel,T,D,M.min,origin);
  }else{
    const mates=T.players.filter(p=>p!==origin&&p.role!=="GK");
    if(mates.length){const c2=pickW(mates,p=>1+(dir>0?curP(p).x:100-curP(p).x)/50);c2.stat.inv++;await ballTo(curP(c2).x+dir*2,curP(c2).y,0.45);}
    if(Math.random()<MT.fillerFeed)feed(["中盤で激しいボールの奪い合い","じっくりとパスを回す","ラインを押し上げていく","セカンドボールを拾った"][ri(0,3)]);
  }
}
async function runLoop(){
  if(!MC||MC.loop)return;
  MC.loop=true;
  while(MC&&!MC.halt&&MC.min<TUNING.match.fullMin){
    await tickAsync();
    if(!MC||MC.halt)break;
    await sleep(TUNING.match.tickMs);
  }
  if(MC){
    MC.loop=false;
    if(MC.min>=TUNING.match.fullMin&&!MC.halt)await endMatch();
  }
}
function startLeagueMatch(idx,name){
  S._leagueMatch=true;
  startMatch(idx);
}
function _checkSquad(){
  const filled=FORMS[S.form].filter((_,i)=>S.squad[i]!=null).length;
  if(filled<11){toast(`スタメンが${filled}/11人です!編成画面で揃えよう`);document.querySelector('[data-s="team"]').click();return false;}
  return true;
}
// 共通: 試合画面セットアップ → KICK OFF → ループ開始。away/name/form/lv(0=ラベル無)/idx を受ける。
function _beginMatch(away,name,form,lv,idx,home0){
  S.tactic="bal";S.style="center";
  document.querySelectorAll(".tactics [data-t]").forEach(b=>b.classList.toggle("on",b.dataset.t==="bal"));
  document.querySelectorAll("#styleRow [data-st]").forEach(b=>b.classList.toggle("on",b.dataset.st==="center"));
  document.getElementById("mAway").textContent=name;
  document.getElementById("mHome").textContent=myName(); // 自チーム名(プロフィール)
  document.getElementById("sH").textContent=0;document.getElementById("sA").textContent=0;
  document.getElementById("feed").innerHTML="";document.getElementById("matchEnd").innerHTML="";
  const clk=document.getElementById("clock");if(clk){clk.textContent="0分";clk.classList.remove("late");}
  updateMomBar(0.5); // 支配率バーを中立へリセット
  hideStatOverlay();
  document.querySelectorAll(".screen").forEach(x=>x.classList.remove("on"));
  document.getElementById("scr-match").classList.add("on");
  document.body.classList.add("in-match"); // 共通ヘッダーを隠してフィールドを広く
  const home=home0||myTeam();
  away.style=oppPickStyle(away);
  MC={home,away,min:0,ball:50,bx:50,by:50,idx,name,lv,subs:3,halt:false,loop:false,volt:0,mom:0};
  MC.subbedOut=new Set(); // 交代でOUTした選手のcard id(再投入不可=ベンチから除外)
  MC.mode=S._careerMatch?"career":(S._dailyMatch!=null)?"daily":S._leagueMatch?"league":S._friendMatch?"friend":S._worldMatch?"world":"stage"; // 終了処理の分岐に使う(MATCH_MODES)
  { const _cap=teamCaptain(home); if(_cap)_cap.isCaptain=true; } // 主将を確定(MC.mode確定後=activeRoleStoreが正しいstoreを返す。pre-match表記・スタミナ緩和・スキルトリガ)
  if(MC.mode!=="career"){ // 通常モードも起用中監督の統制OVRで編成をソフト制限(キャリアは既に設定済み)
    const _b=homeBaseTotal(home), _cap=mgrCtrlOVR(effectiveManager())+coachCtrlBonus();
    home.ctrl=ovrOverloadMul(_b,_cap); home.ctrlSurge=ctrlSurge(_b,_cap); // 余裕ぶんで采配の発動率アップ(隠し)
  }
  { // 交代枠(ベンチ): 事前設定した控えのみ試合中に投入可(通常=S.bench / 育成=cr.bench)。
    const onF=new Set(home.players.map(p=>p.c.id));
    MC.bench=(MC.mode==="career")
      ? careerBenchCards(S.career).filter(c=>!onF.has(c.id))
      : ((S.bench||[]).map(id=>S.coll.find(c=>c.id===id)).filter(c=>c&&!onF.has(c.id)));
  }
  document.getElementById("subN").textContent=3;
  buildField();
  feed(`⚽ キックオフ! vs ${name}${lv?`(Lv.${lv})`:""}`);
  feed(`相手のフォーメーション:【${form}】`);
  if(FORM_DESC[form])feed(`📋 ${FORM_DESC[form]}`,"chance");
  feed(`相手の攻撃スタイル:${STYLE_LABEL[away.style]}`);
  if(home.mgr)feed(`🎯 監督『${home.mgr.title}』起用中! ${mgrBoostDesc(home.mgr)}`,"chance");
  if(MC.mode!=="career"&&home.ctrl<1)feed(`⚠ 統制超過! 編成OVRが監督の統制可能OVRを上回り 全能力 -${Math.round((1-home.ctrl)*100)}%(指揮が追いつかない)`,"chance");
  if(away.mgr)feed(`⚠ 相手監督『${away.mgr.title}』! ${mgrBoostDesc(away.mgr)}`,"chance");
  if(home.chemN>=3)feed(`🤝 ${home.chemNat} ${natName(home.chemNat)}勢${home.chemN}人のケミストリー! チーム能力 +${Math.round((home.chem-1)*100)}%`,"chance");
  if(away.chemN>=3)feed(`⚠ 相手は ${away.chemNat}${natName(away.chemNat)}勢${away.chemN}人! 国籍ボーナス +${Math.round((away.chem-1)*100)}%`,"chance");
  const srs=away.players.filter(p=>p.c.sig||p.c.rar==="l");
  if(srs.length)feed(`⚠ 要注意:${srs.map(p=>p.c.name+"【"+p.c.skill.name+"】").join("、")}`);
  (async()=>{ await kickoffCutin(teamCaptain(home),teamCaptain(away),name); runLoop(); })();
}
function startMatch(idx){
  if(!_checkSquad())return;
  const club=CLUBS[idx];
  _beginMatch(oppTeam(club.lv,club),club.name,club.form,club.lv,idx);
}
function startDailyMatch(k){ // デイリー: 当日の1チームに挑戦。勝利で撃破(10%固有ドロップ)、全勝でチケット。
  const d=ensureDaily(), t=d.teams[k]; if(!t)return;
  if(d.done[k]){toast("この相手は撃破済み(明日更新)");return;}
  if(!_checkSquad())return;
  S._dailyMatch=k;
  const nation=WORLD_NATIONS[t.idx];
  _beginMatch(worldTeam(nation,t.idx), `📅 デイリー: ${nation.flag} ${nation.name}`, nation.form, 0, t.idx);
}
function startWorldMatch(){
  if(!_checkSquad())return;
  const tour=S.tour||(S.tour={i:0,res:[]});
  if(tour.i>=WORLD_NATIONS.length)return;
  const nation=WORLD_NATIONS[tour.i];
  S._worldMatch=true;
  _beginMatch(worldTeam(nation,tour.i),`${nation.flag} ${nation.name}`,nation.form,0,tour.i);
}
function startFriendMatch(team,coach,tn,form){
  S._friendMatch={coach,teamName:tn};
  _beginMatch(team, tn||`${coach}監督`, form, 0, -1);
}
// ===== 監督キャリア(WCCF風・カスタム監督育成) =====
function startCareer(){
  const nm=((typeof S.coach==="string"&&S.coach.trim())||myName()||"監督").slice(0,16); // 監督名はオーナー名を踏襲
  S.career={name:nm, viz:ri(0,7), step:0, div:3, node:0, pts:0, gf:0, ga:0, stage:"league", // viz=育成監督のビジュアル(開始時ランダム)
    ovrCap:CAREER.startCap, boosts:[], tacs:[], history:[], cupsWon:[],
    cup:null, contId:null, contWon:[], stepsMax:CAREER.steps, term:0, finished:false,
    growth:{}, form:{}, cond:{}, season:0, squad:{}, bench:[], captain:null, kickers:{pk:null,fk:null,ck:null}, // 成長/調子/加齢＋手動編成(空=自動)＋交代枠＋ロール
    events:[], // クラブに起きているイベント(レッド欠場/今後ケガ/トロフィー等・汎用)
    loan:null}; // 名声/施設はアカウント恒久(S.prestige/S.fac)に移行
  save(); gotoCareer();
}
function startCareerMatch(){ // ①リーグ / 大陸 / カップ戦の1試合。上限内編成で相応の相手と対戦。
  const cr=S.career; if(!cr||cr.finished)return;
  if(cr.stage==="cont"&&!cr.contId&&!cr.cup){careerContPicker();return;} // 大陸未選択なら選択へ
  if(finalizeCareerIfDone())return;
  S._careerMatch=true; // careerTeam→buildTeam→homeManager が育成中監督を拾えるよう先に立てる
  const cap=careerCap(cr); // スタジアム施設ぶんを含む実効上限
  const team=careerTeam(cap); // 上限内に可能な限りトリムした最良編成(手持ちの下限がcap超なら best-effort)
  if(team.players.length<11){S._careerMatch=false;toast("手持ちが11人に足りません(編成できません)");return;}
  // 統制: 編成OVRが統制可能OVR(cap)を超えると超過率ぶん全能力が低下(eff の T.ctrl)。
  team.ctrl=careerOverloadMul(cr);
  team.ctrlSurge=ctrlSurge(careerBaseTotal(cr),cap); // 統率に余裕があれば采配の発動率アップ(隠し)
  cr.cond=cr.cond||{}; // 調子(コンディション)を試合開始時に決定→eff(p.cond)へ反映
  team.players.forEach(p=>{const cnd=careerCondition(cr,p.c,agePhase(effAge(p)));p.cond=cnd.mul;cr.cond[p.c.id]=cnd.key;});
  const opp=careerOpponent(cr); // 名前付き相手(Tier/seed固定)
  const lv=opp?opp.lv:(cr.cup?cr.cup.lv:CAREER.divLv[cr.div]||5);
  const form=opp?opp.form:"4-4-2", seed=opp?opp.seed:undefined;
  cr.oppName=opp?opp.name:(cr.cup?cr.cup.name:`DIV${cr.div}`);
  cr.derby=!!(opp&&opp.derby); // 宿敵戦=ダービー(この試合の結果でonEndが士気報酬/雪辱を処理)
  const cont=cr.contId?continentById(cr.contId):null;
  const label=cr.cup?`${cr.cup.emoji} ${cr.cup.name} ${roundLabel((cr.cup.bracket[cr.cup.round]||[]).length)}: ${cr.oppName}`
    :cont?`${cont.emoji} ${cont.name}リーグ 第${cr.node+1}節: ${cr.oppName}`
    :cr.derby?`⚔ ダービー! DIV${cr.div} 第${cr.node+1}節: 宿敵 ${cr.oppName}`
    :`DIV${cr.div} 第${cr.node+1}節: ${cr.oppName}`;
  _beginMatch(oppTeam(lv,{form,seed}), label, form, lv, -1, team);
  if(team.ctrl<1)feed(`⚠ 統制超過! 編成OVRが統制可能OVRを上回り 全能力 -${Math.round((1-team.ctrl)*100)}%(監督の指揮が追いつかない)`,"chance");
  const hot=team.players.filter(p=>cr.cond[p.c.id]==="peak").map(p=>p.c.name); // 調子ハイライト
  const cold=team.players.filter(p=>cr.cond[p.c.id]==="poor").map(p=>p.c.name);
  if(hot.length)feed(`⤴ 絶好調: ${hot.join("、")}`,"chance");
  if(cold.length)feed(`⤵ 不調: ${cold.join("、")}`);
}
function startCup(id){ // ②カップ: エントリー週かつ条件を満たせばカップを開始(以後 startCareerMatch がカップ戦になる)
  const cr=S.career; if(!cr||cr.finished||cr.cup)return;
  const cup=cupById(id); if(!cup){return;}
  if(cr.step>=CAREER.steps){toast("任期は終了しています");return;}
  if(!cup.cond(cr)){toast(`出場条件を満たしていません(${cup.condText})`);return;}
  if(!cupEntryWeek(cup,cr.step)){toast(`${cup.name}は${cup.period}の倍数の週のみエントリー可能です`);return;}
  cr.cup={id:cup.id,name:cup.name,emoji:cup.emoji,pool:cup.pool,size:cup.size,rounds:cup.rounds,round:0,bracket:drawCupBracket(cup)};
  if(typeof _careerTab!=="undefined")_careerTab="cup"; // エントリー直後はカップタブへ(トーナメント表を見ながら進行)
  save(); renderCareer();
  if(typeof secDialog==="function")secDialog(SEC_EVENT_MSG.cupentry); // 秘書: カップ参加を通知
}
function careerPractice(){ // ③練習: OVR上限を緩和(1ステップ消費)
  const cr=S.career; if(!cr||cr.finished)return;
  if(finalizeCareerIfDone())return;
  const gain=ri(CAREER.practiceMin,CAREER.practiceMax); // 練習効果は30〜50でランダム
  cr.ovrCap=Math.min(CAREER.capMax, cr.ovrCap+gain);
  (cr.history=cr.history||[])[cr.step]={act:"P",cap:cr.ovrCap,gain}; cr.step++;
  save(); if(!finalizeCareerIfDone())renderCareer();
  if(typeof secDialog==="function")secDialog(SEC_EVENT_MSG.practice); // 秘書: 練習で統率OVRアップを通知
}
function startCont(id){ // 大陸リーグ開幕(DIV1制覇後)。以後 startCareerMatch がその大陸の6節になる。
  const cr=S.career; if(!cr||cr.finished||cr.cup||cr.contId)return;
  if(cr.stage!=="cont"){toast("大陸リーグはDIV1制覇後に解禁されます");return;}
  const c=continentById(id); if(!c)return;
  cr.contId=id; cr.node=0; cr.pts=0; cr.gf=0; cr.ga=0; save(); renderCareer();
  toast(`${c.emoji} ${c.name}リーグ開幕! 6節制覇で${MGR_STAT_JP[c.stat]||c.stat}特化バフを獲得`);
}
function careerFinalize(){ // カスタム監督を確定して登録
  const cr=S.career; if(!cr)return;
  const m=createCustomManager({name:cr.name, title:"育成監督", boosts:cr.boosts, tacs:cr.tacs, ctrlOVR:cr.ovrCap, viz:cr.viz}); // 統制OVR/ビジュアルを継承(施設バフ分は含めない=起用時に別途加算)
  S.career=null; checkAchievements(); save(); // 初完走の実績(シグネチャー選択券)を判定
  toast(`🎓 任期満了! カスタム監督「${m.name}」誕生! 監督室で起用できます`);
  if(typeof gotoOffice==="function")gotoOffice("mgr");
}
function finalizeCareerIfDone(){ // 任期満了→(好成績なら延長オファー)→確定
  const cr=S.career; if(!cr)return false;
  if(cr.step<(cr.stepsMax||CAREER.steps))return false;
  if(cr.cup||cr.contId)return false; // カップ/大陸シーズン中は決着まで延長
  const qualified=(cr.cupsWon||[]).length>0||cr.stage==="cont"||(cr.contWon||[]).length>0;
  if(qualified&&(cr.term||0)<CAREER.extendMax){ offerContractExtension(); return true; } // 好成績→延長を提示
  careerFinalize(); return true;
}
function offerContractExtension(){ // 契約延長 or 引退の選択(オーバーレイ)
  const cr=S.career; if(!cr)return; gotoCareer();
  const ov=document.createElement("div");ov.className="tac-offer";
  const inn=document.createElement("div");inn.className="tac-offer-in";
  inn.innerHTML=`<div class="banner">📜 契約満了(${cr.step}週)</div><div class="lg">好成績につき<b>契約延長(+${CAREER.extendWeeks}週)</b>が可能(残り${CAREER.extendMax-(cr.term||0)}回)。延長で大陸制覇やカップをさらに積み、監督を強化できます。</div>`;
  const ext=document.createElement("button");ext.className="btn";ext.style.marginTop="6px";ext.textContent=`✍ 契約延長 (+${CAREER.extendWeeks}週)`;
  ext.onclick=()=>{cr.stepsMax=(cr.stepsMax||CAREER.steps)+CAREER.extendWeeks;cr.term=(cr.term||0)+1;save();ov.remove();renderCareer();if(typeof secDialog==="function")secDialog(SEC_EVENT_MSG.extend);}; // 秘書: 契約延長を通知
  const ret=document.createElement("button");ret.className="btn ghost";ret.style.marginTop="6px";ret.textContent="🎓 引退して監督を確定";
  ret.onclick=()=>{ov.remove();careerFinalize();};
  inn.appendChild(ext);inn.appendChild(ret);ov.appendChild(inn);document.body.appendChild(ov);
}
// 主将 = 6ステ合計が最大の選手(キャプテン未指名のため最高OVRで代用)。
const teamTotal6=c=>c.off+c.def+c.pow+c.tec+c.spd+c.sta;
// 主将: 自チーム(H)は編成で指定したキャプテンが出場中ならそれを、無ければ6ステ合計最上位を自動採用。
// 通常戦/キャリア戦で格納先(S / S.career)が異なるため activeRoleStore を参照。
const teamCaptain=T=>{
  const st=activeRoleStore();
  if(T.side==="H"&&st.captain){const p=T.players.find(x=>x.c.id===st.captain);if(p)return p;}
  return T.players.reduce((b,p)=>teamTotal6(p.c)>teamTotal6(b.c)?p:b,T.players[0]);
};

// ================= 試合後スタッツ(オーバーレイ) =================
let _statTeams=null;
function renderStatRows(team,opp){
  const rows=team.players.map(p=>({p,r:statRating(p,opp)})).sort((a,b)=>b.r-a.r);
  const mom=rows[0];
  let h='<table class="statTbl"><tr><th>枠 '+helpIcon("statLegend")+'</th><th>選手</th><th>評価</th><th>関与</th><th>G</th><th>A</th><th>デュエル</th><th>SV</th></tr>';
  rows.forEach(({p,r})=>{
    const s=p.stat,isMom=p===mom.p,low=r<5.0;
    h+=`<tr class="${isMom?"mom":""}${low?" lowform":""}">
      <td><span class="pos ${p.role}">${p.subRole||p.role}</span></td>
      <td>${isMom?"★":""}${p.c.name}<br><span style="font-size:9px;color:${CAT_COL[typeFlavor(p.c).cat||"atk"]}">${CAT_ICON[typeFlavor(p.c).cat||"atk"]} ${typeOf(p.c).n}</span></td>
      <td>${r.toFixed(1)}</td>
      <td>${s.inv||0}</td>
      <td>${s.goals}</td>
      <td>${s.assists}</td>
      <td>${s.duelW}-${s.duelL}</td>
      <td>${p.role==="GK"?s.saves:"-"}</td>
    </tr>`;
  });
  h+='</table>';
  return h;
}
function renderStatTab(which){
  if(!_statTeams)return;
  document.querySelectorAll("#statOverlay .statTabs button").forEach(b=>b.classList.toggle("on",b.dataset.team===which));
  const team=_statTeams[which], opp=_statTeams[which==="home"?"away":"home"];
  document.getElementById("statOverlayBody").innerHTML=renderStatRows(team,opp);
}
function showStatOverlay(home,away){
  _statTeams={home,away};
  document.getElementById("statOverlay").classList.add("on");
  renderStatTab("home");
}
function hideStatOverlay(){
  document.getElementById("statOverlay").classList.remove("on");
  _statTeams=null;
}
document.querySelectorAll("#statOverlay .statTabs button").forEach(b=>b.onclick=()=>renderStatTab(b.dataset.team));
// 試合モード別の終了処理レジストリ。MC.mode で分岐(新モード追加=1エントリ)。各 onEnd は
// 結果表示(#matchEnd)・スタッツ・戻るボタン・報酬・保存・MC=null まで自己完結(振る舞いは従来の分岐を逐語移設)。
const MATCH_MODES={
  league:{ async onEnd(M,sh,sa){
    S._leagueMatch=false;
    const e=document.getElementById("matchEnd");
    const r=resWordEmoji(sh>sa?"W":sh===sa?"D":"L");
    e.innerHTML=`<div class="banner">${r} ${sh}-${sa}</div>`;
    showStatOverlay(M.home,M.away);
    finishLeagueRound(sh,sa);
    const b=document.createElement("button");b.className="btn";b.textContent="順位表へ戻る";
    b.onclick=()=>{MC=null;document.querySelector('[data-s="home"]').click();
      document.querySelector('#modeRow [data-m="league"]').click();};
    e.appendChild(b);
    await save();MC=null;
  }},
  friend:{ async onEnd(M,sh,sa){
    const fm=S._friendMatch;S._friendMatch=null;
    const coach=fm.coach, tn=fm.teamName||coach;
    const rec=S.friendRec||(S.friendRec={}); const e2=rec[coach]||(rec[coach]={w:0,d:0,l:0});
    if(sh>sa)e2.w++;else if(sh===sa)e2.d++;else e2.l++;
    const e=document.getElementById("matchEnd");
    const head=resWordEmoji(sh>sa?"W":sh===sa?"D":"L");
    e.innerHTML=`<div class="banner">🤝 vs ${tn} ${head} ${sh}-${sa}</div>`;
    showStatOverlay(M.home,M.away);
    const b=document.createElement("button");b.className="btn";b.textContent="監督室へ戻る";
    b.onclick=()=>{MC=null;gotoOffice("match");};
    e.appendChild(b);
    await save();MC=null;
  }},
  world:{ async onEnd(M,sh,sa){
    S._worldMatch=false;
    const tour=S.tour||(S.tour={i:0,res:[]});
    const nation=WORLD_NATIONS[tour.i];
    const r=sh>sa?"W":sh===sa?"D":"L";
    tour.res[tour.i]=r;
    const e=document.getElementById("matchEnd");
    const head=resWordEmoji(r);
    let drop="";
    if(r==="W"){ // 署名保有国に勝利 → 低確率で固有選手ドロップ(未所持優先)
      const sigs=SIGNATURES.filter(s=>s.flag===nation.flag);
      if(sigs.length&&S.coll.length<COLL_CAP&&Math.random()<TUNING.worldSigDrop*scoutDropMul()){ // 満員(最大500)では固有ドロップをスキップ
        const own=new Set(S.coll.filter(c=>c.sig).map(c=>c.sig));
        const pool=sigs.filter(s=>!own.has(s.id)); const cand=pool.length?pool:sigs;
        const pick=cand[ri(0,cand.length-1)];
        S.coll.push(makeSignature(pick.id));
        drop=`<div class="banner" style="font-size:14px;color:#ff9ec4">🌟 ${nation.name}撃破! 固有選手「${pick.name}」を獲得!!</div>`;
        feed(`🌟 ${nation.name}を撃破!固有選手「${pick.name}」を獲得!`,"goal");
      }
      if(Math.random()<TUNING.worldSigPackDrop){ // 暫定: 勝利で低確率にシグネチャーパックもドロップ(入手機会の拡充)
        S.sigPacks=(S.sigPacks||0)+1;
        drop+=`<div class="banner" style="font-size:14px;color:#ffd24a">🎁 シグネチャーパックをドロップ!</div>`;
        feed("🎁 シグネチャーパックをドロップ!","goal");
      }
    }
    tour.i++;
    const last=tour.i>=WORLD_NATIONS.length;
    if(last)S.tourDone=1; // ワールドツアー1週完了 → デイリー解放
    if(last&&tour.res.every(x=>x==="W"))S.tourPerfect=1; // 全勝で実績(選択券)
    e.innerHTML=`<div class="banner">${head} ${sh}-${sa}</div>`+drop;
    showStatOverlay(M.home,M.away);
    const b=document.createElement("button");b.className="btn";b.textContent=last?"ツアー結果へ":"次の国へ";
    b.onclick=()=>{MC=null;document.querySelector('[data-s="home"]').click();document.querySelector('#modeRow [data-m="world"]').click();};
    e.appendChild(b);
    checkAchievements();
    await save();MC=null;
  }},
  stage:{ async onEnd(M,sh,sa){
    const lv=M.lv;
    let msg,reward;
    if(sh>sa){msg="🏆 WIN!!";reward=TUNING.reward.base+lv*TUNING.reward.perLv;if(M.idx===S.cleared)S.cleared++;}
    else if(sh===sa){msg="🤝 DRAW";reward=TUNING.reward.draw;}
    else{msg="😢 LOSE…";reward=TUNING.reward.lose;}
    reward=Math.round(reward*stadiumCoinMul()); // 🏟スタジアムでコイン獲得アップ
    S.coins+=reward;coinUI();
    // 名声(全モード小トリクル): 勝利+1 / 格下相手にジャイキリ被弾で-1
    if(sh>sa){S.prestige=(S.prestige||0)+1;feed(`🏛 名声 +1(計 ${S.prestige})`,"chance");}
    else if(wasGiantKilled(M.home,M.away,sh,sa)){S.prestige=Math.max(0,(S.prestige||0)-1);feed(`💥 番狂わせ被弾… 名声 -1(計 ${S.prestige})`,"chance");}
    feed(`試合終了 ${sh}-${sa} ${msg} 報酬🪙${reward}`,"goal");
    const dropP=sh>sa?TUNING.drop.win:sh===sa?TUNING.drop.draw:TUNING.drop.lose;
    let dropMsg="";
    if(Math.random()<dropP){
      S.legendPacks=(S.legendPacks||0)+1;
      dropMsg=`<div class="banner" style="font-size:15px;color:#7dff9e">🎁 レジェンドパックを手に入れた!!</div>`;
      feed("🎁 レジェンドパックを手に入れた!!スカウト画面で開封できる","goal");
    }
    const e=document.getElementById("matchEnd");
    e.innerHTML=`<div class="banner">${msg}</div>`+dropMsg;
    showStatOverlay(M.home,M.away);
    const idx=M.idx, win=sh>sa, hasNext=idx+1<CLUBS.length;
    const row=document.createElement("div");row.className="row";
    if(win&&hasNext){ // 勝利 → 次のステージへ進む
      const nx=document.createElement("button");nx.className="btn";nx.textContent="▶ 次のステージへ";
      nx.onclick=()=>startMatch(idx+1);
      row.appendChild(nx);
    }else if(!win){ // 引分/敗北 → 同じ相手と再戦
      const rt=document.createElement("button");rt.className="btn";rt.textContent="リトライ";
      rt.onclick=()=>startMatch(idx);
      row.appendChild(rt);
    } // 勝利かつ次が無い(最終ステージ制覇) → ホームのみ
    const bk=document.createElement("button");bk.className="btn ghost";bk.textContent="ホームへ戻る";
    bk.onclick=()=>{document.querySelector('[data-s="home"]').click();};
    row.appendChild(bk);
    e.appendChild(row);
    MC=null;
    checkAchievements(); // ステージ攻略の達成で実績報酬を付与
    await save();
  }},
  daily:{ async onEnd(M,sh,sa){ // デイリークエスト: 勝利で撃破+10%固有ドロップ、全勝でシグネチャーチケット1枚/日
    const k=S._dailyMatch; S._dailyMatch=null;
    const d=S.daily, t=d&&d.teams[k], nation=t?WORLD_NATIONS[t.idx]:null, win=sh>sa;
    const head=resWordEmoji(win?"W":sh===sa?"D":"L");
    const e=document.getElementById("matchEnd");
    let html=`<div class="banner">${head} ${sh}-${sa}</div>`, extra="";
    if(win&&d&&nation){
      d.done[k]=true;
      const sigs=SIGNATURES.filter(s=>s.flag===nation.flag);
      if(sigs.length&&S.coll.length<COLL_CAP&&Math.random()<TUNING.worldSigDrop*scoutDropMul()){ // 10%固有ドロップ(未所持優先)
        const own=new Set(S.coll.filter(c=>c.sig).map(c=>c.sig));
        const pool=sigs.filter(s=>!own.has(s.id)); const cand=pool.length?pool:sigs; const pick=cand[ri(0,cand.length-1)];
        S.coll.push(makeSignature(pick.id));
        extra+=`<div class="banner" style="font-size:14px;color:#ff9ec4">🌟 固有選手「${pick.name}」を獲得!!</div>`;
      }
      if(d.done.every(x=>x)&&!d.claimed){ d.claimed=true; S.sigPacks=(S.sigPacks||0)+1; // 全勝→チケット
        extra+=`<div class="banner" style="color:#ffd24a">🎟️ デイリー全勝! シグネチャースカウトチケットを獲得!(スカウトで開封)</div>`; }
    }
    e.innerHTML=html+extra;
    showStatOverlay(M.home,M.away);
    const b=document.createElement("button");b.className="btn";b.textContent="デイリーへ戻る";
    b.onclick=()=>{MC=null;document.querySelector('[data-s="home"]').click();document.querySelector('#modeRow [data-m="daily"]').click();};
    e.appendChild(b);
    await save();MC=null;
  }},
  career:{ async onEnd(M,sh,sa){ // 監督キャリアのリーグ/カップ1試合
    S._careerMatch=false;
    const cr=S.career, inCup=cr&&cr.cup, secMsgs=[]; // secMsgs=結果画面から戻る時に秘書がまとめて確認するイベント
    if(cr)careerApplyGrowth(cr,M.home,M.away); // 出場した選手の成長/衰退を反映(この試合の評価から)
    if(cr){ // イベント持続: 全イベントをこの試合で1消化(練習週は消化せず試合をまたいで有効) → 発生分は後段で新規登録
      cr.events=cr.events||[];
      cr.events.forEach(ev=>{ if(ev.left>0)ev.left--; });
      (MC.sentOffHome||[]).forEach(so=>{ const comp=inCup?"カップ":"リーグ"; // レッドカード → 次戦欠場
        const ex=cr.events.find(ev=>ev.type==="redcard"&&ev.cardId===so.id&&ev.left>0);
        if(ex)ex.left++; else cr.events.push({type:"redcard",cardId:so.id,name:so.name,comp,left:1}); });
      if((MC.sentOffHome||[]).length)secMsgs.push("redcard");
    }
    let pp=cr?(sh>sa?2:sh===sa?1:0):0; // 名声(プレステージ)獲得: 勝2/分1 + イベント加点
    if(cr&&wasGiantKilled(M.home,M.away,sh,sa))pp-=3; // 格下にジャイキリ被弾で名声減
    const e=document.getElementById("matchEnd");
    let html="", champCup=null, headRes=(sh>sa?"W":sh===sa?"D":"L"), pkNote="";
    // ① 成長爆発: 勝利かつMOM(最高評価)が「成長期」なら10%で発動 → 今後3試合その選手の成長率2倍
    if(cr&&sh>sa&&M.home.players.length){
      let mom=M.home.players[0], mr=-Infinity;
      M.home.players.forEach(p=>{const r=statRating(p,M.away); if(r>mr){mr=r;mom=p;}});
      if(mom&&agePhase(effAge(mom)).key==="rising"&&Math.random()<0.10&&!cr.events.some(ev=>ev.type==="growthboom"&&ev.cardId===mom.c.id)){
        cr.events.push({type:"growthboom",cardId:mom.c.id,name:mom.c.name,left:3});
        html+=`<div class="banner" style="font-size:14px;color:#7dff9e">🌿 成長爆発! <b>${mom.c.name}</b>(成長期MOM)の成長率が今後3試合 倍増!</div>`;
        secMsgs.push("growthboom");
      }
    }
    if(inCup){
      const cupName=cr.cup.name;
      let pk=null;
      if(sh===sa){ pk=await pkShootout(M.home,M.away); } // 規定時間 引分 → PK戦で決着
      const o=careerCupResult(cr,sh,sa,pk);
      if(typeof _careerTab!=="undefined")_careerTab=o.advance?"cup":"schedule"; // 勝ち上がり中はカップ表を継続、敗退/優勝の確定で日程タブへ
      if(pk){ headRes=pk.win?"W":"L"; pkNote=` (PK ${pk.sa}-${pk.sd})`; // ヘッダーの勝敗もPK結果を反映
        html+=`<div class="banner" style="font-size:14px;color:${pk.win?"#7dff9e":"#ff8e8e"}">⚽ PK戦 ${pk.sa}-${pk.sd} → ${pk.win?"WIN":"LOSE"}</div>`; }
      if(o.champion){champCup=o.cup; pp+=15; html+=`<div class="banner" style="color:#ffd24a">${o.cup.emoji} ${cupName} 優勝!! 采配スキルを獲得!</div>`; secMsgs.push("cupwin");}
      else if(o.advance){pp+=2; html+=`<div class="banner" style="color:#7dff9e">▶ ${o.roundName}突破! 次の回戦へ</div>`;}
      else{const champ=(OPP_CLUBS[o.champId]||{}).name||o.champId; html+=`<div class="banner" style="font-size:14px;color:#ff8e8e">${o.roundName}敗退…(優勝: ${champ||"—"})</div>`; secMsgs.push("cupout");
        const gh=gritRoll(cr); if(gh){html+=gh;secMsgs.push("grit");} // ② 敗退 → 20%で不屈
      }
    }else{
      const wasDerby=cr&&cr.derby; if(cr)cr.derby=false;
      const o=cr?careerRecordResult(cr,sh,sa):{};
      if(wasDerby){ // ダービーの結果(勝利=士気ボーナス、それ以外=雪辱)
        if(sh>sa){cr.boosts.push({pos:"all",stat:"all",mul:CAREER.derbyMul}); pp+=3;
          html+=`<div class="banner" style="color:#ffd24a">⚔ ダービー制覇! 士気が高まった(監督バフ 全能力+${Math.round((CAREER.derbyMul-1)*1000)/10}%)</div>`; secMsgs.push("derbyWin");}
        else html+=`<div class="banner" style="font-size:14px;color:#ff8e8e">⚔ 宿敵レガリアに屈した…次こそ雪辱を</div>`;
      }
      if(o.seasonEnd){
        const pct=Math.round((o.boost.mul-1)*1000)/10;
        if(o.contName){ // 大陸リーグ制覇→系統ステboost
          const st=MGR_STAT_JP[o.contStat]||o.contStat; pp+=15;
          html+=`<div class="banner" style="color:#ffd24a">🌐 ${o.contName}リーグ制覇! → 監督バフ「${st} +${pct}%」獲得!</div>`; secMsgs.push("contWin");
        }else{ // DIVシーズン終了(順位で昇降格)
          const rankTxt=o.champion?"🏆 優勝":`${o.rank}位`;
          pp+=o.toCont?20:o.promoted?10:o.champion?8:(o.rank<=2?5:2);
          html+=`<div class="banner" style="color:#7dff9e">📅 DIV${o.seasonDiv} シーズン終了 ${rankTxt}(全${o.size}チーム) 勝点${o.seasonPts} → 監督バフ「全能力 +${pct}%」</div>`;
          if(o.promoted){html+=`<div class="banner" style="font-size:14px">⬆ DIV${cr.div}へ昇格!</div>`; secMsgs.push("promote");}
          else if(o.relegated){html+=`<div class="banner" style="font-size:14px;color:#ff8e8e">⬇ DIV${cr.div}へ降格…立て直そう</div>`; secMsgs.push("relegate");}
          else if(o.stayed)html+=`<div class="banner" style="font-size:14px">→ DIV${cr.div}に残留(来季 上位${CAREER.promote[cr.div]||1}位以内で昇格)</div>`;
          if(o.toCont){html+=`<div class="banner" style="color:#ffd24a;font-size:14px">🌐 大陸リーグ解禁! 各大陸を制覇して系統特化バフを狙え</div>`; secMsgs.push("contUnlock");}
          if(o.relegated||(o.rank&&o.size&&o.rank>o.size/2)){const gh=gritRoll(cr); if(gh){html+=gh;secMsgs.push("grit");}} // ② リーグ下位で終了 → 20%で不屈
        }
      }
    }
    if(cr&&pp){S.prestige=Math.max(0,(S.prestige||0)+pp); html+=`<div class="banner" style="font-size:13px;color:${pp<0?"#ff8e8e":"#ffd24a"}">🏛 名声 ${pp>0?"+":""}${pp}(計 ${S.prestige})</div>`;}
    if(cr)cr.events=(cr.events||[]).filter(ev=>ev.left>0); // 消化済みイベントを除去
    checkAchievements(); // インターナショナルクラブカップ初優勝などの実績を判定(S.career.cupsWon 参照)
    e.innerHTML=`<div class="banner">${resWordEmoji(headRes)} ${sh}-${sa}${pkNote}</div>`+html; // ヘッダー(PK決着も反映)+詳細
    showStatOverlay(M.home,M.away);
    const b=document.createElement("button");b.className="btn";b.textContent="キャリアへ戻る";
    // 戻る時: 発生イベントを秘書がまとめてコメント(確認)→ 優勝は采配報酬 / それ以外は任期満了なら確定。
    b.onclick=async()=>{MC=null; if(typeof secDialogSeq==="function")await secDialogSeq(secMsgs); if(champCup)offerCareerTac(champCup.pool,champCup); else if(!finalizeCareerIfDone())gotoCareer();};
    e.appendChild(b);
    await save();MC=null;
  }},
};
// カップ優勝報酬: プールからランダム3提示→1つ選んで監督のtacに追加(重複語は除外)。
function offerCareerTac(pool,cup){
  const cr=S.career; if(!cr){gotoCareer();return;}
  const owned=new Set((cr.tacs||[]).map(t=>t.name));
  let cand=(CAREER_TACS[pool]||CAREER_TACS.basic).filter(t=>!owned.has(t.name));
  if(!cand.length)cand=CAREER_TACS[pool]||CAREER_TACS.basic; // 全所持なら重複可
  // ランダム3(または残り全部)
  const pick=[]; const src=cand.slice();
  while(pick.length<3&&src.length)pick.push(src.splice(ri(0,src.length-1),1)[0]);
  gotoCareer();
  const box=document.getElementById("careerBox"); if(!box){cr.tacs.push(pick[0]);save();return;}
  const ov=document.createElement("div");ov.className="tac-offer";
  ov.innerHTML=`<div class="tac-offer-in"><div class="banner">${cup.emoji} ${cup.name} 優勝報酬</div><div class="lg">獲得する采配スキルを1つ選択</div></div>`;
  const inn=ov.querySelector(".tac-offer-in");
  pick.forEach(t=>{
    const b=document.createElement("button");b.className="btn";b.style.cssText="margin-top:6px;text-align:left";
    const eff=tacEffText(t);
    b.innerHTML=`<b>${t.flag||""}${t.name}</b><br><span class="lv">${eff} ・ 発動率${Math.round(t.chance*100)}%</span>`;
    b.onclick=()=>{cr.tacs.push({...t}); save(); ov.remove(); if(typeof secDialog==="function")secDialog(SEC_EVENT_MSG.tac); if(!finalizeCareerIfDone())renderCareer();};
    inn.appendChild(b);
  });
  document.body.appendChild(ov);
}
// ===== PK戦(カップの引分決着) =====
// キッカー順=シュート力(off×0.6+tec×0.4×shoot)の高い順。5人→以降は循環。
function pkOrder(T){return T.players.filter(p=>p.role!=="GK").slice()
  .sort((a,b)=>((b.c.off*0.6+b.c.tec*0.4)*(fx(b).shoot||1))-((a.c.off*0.6+a.c.tec*0.4)*(fx(a).shoot||1)));}
// 1本のPK判定(純: キッカー off/tec × pkShootBase vs GK def)。
function pkResolve(kicker,gk,A,D,min){
  const sSc=(eff(kicker,"off",min,A,D)*0.6+eff(kicker,"tec",min,A,D)*0.4)*(fx(kicker).shoot||1)*TUNING.setpiece.pkShootBase*rr();
  const gSc=eff(gk,"def",min,D,A)*(fx(gk).save||1)*rr();
  return sSc>gSc*TH.gk;
}
// PK戦: 5本先取(交互)→決着せねばサドンデス。専用オーバーレイで1本ずつ演出。{win,sa,sd} を返す。
async function pkShootout(A,D){
  const gkA=pickGK(A), gkD=pickGK(D), orderA=pkOrder(A), orderD=pkOrder(D), min=(MC&&MC.min)||90;
  const hn=myName(), an=(MC&&MC.name)||"相手";
  const ov=document.createElement("div");ov.className="pkshoot";
  ov.innerHTML=`<div class="pk-in">
    <div class="pk-title">⚽ PK戦</div><div class="pk-sub">規定時間 DRAW → PK戦で決着</div>
    <div class="pk-score"><span class="pk-tn">${hn}</span> <b id="pkSa">0</b> - <b id="pkSd">0</b> <span class="pk-tn away">${an}</span></div>
    <div class="pk-marks" id="pkMarksA"></div><div class="pk-marks away" id="pkMarksD"></div>
    <div class="pk-arena" id="pkArena"></div></div>`;
  document.body.appendChild(ov);
  const marksA=ov.querySelector("#pkMarksA"), marksD=ov.querySelector("#pkMarksD"), arena=ov.querySelector("#pkArena");
  const elSa=ov.querySelector("#pkSa"), elSd=ov.querySelector("#pkSd");
  let sa=0,sd=0,ka=0,kd=0;
  const addMark=(row,goal)=>{const m=document.createElement("span");m.className="pk-mark "+(goal?"g":"m");m.textContent=goal?"⚽":"✕";row.appendChild(m);};
  const kick=async(home)=>{
    const kicker=(home?orderA[ka%orderA.length]:orderD[kd%orderD.length]), gk=home?gkD:gkA;
    arena.innerHTML="";
    const kf=document.createElement("div");kf.className="pk-fig k";kf.appendChild(spriteCanvas(kicker.c,92));
    const gf=document.createElement("div");gf.className="pk-fig g";gf.appendChild(spriteCanvas(gk.c,92));
    const nm=document.createElement("div");nm.className="pk-kicker";nm.innerHTML=`${(home?"🔵":"🔴")} ${kicker.c.flag||""} <b>${kicker.c.name}</b>`;
    arena.appendChild(kf);arena.appendChild(gf);arena.appendChild(nm);
    await sleep(480);
    const goal=pkResolve(kicker,gk,home?A:D,home?D:A,min);
    const w=document.createElement("div");w.className="pk-result "+(goal?"goal":"save");w.textContent=goal?"⚽ GOAL!":"🧤 STOP!";arena.appendChild(w);
    if(home){addMark(marksA,goal);if(goal){sa++;elSa.textContent=sa;}ka++;}
    else{addMark(marksD,goal);if(goal){sd++;elSd.textContent=sd;}kd++;}
    await sleep(680);
  };
  const decided=()=>{const remA=Math.max(0,5-ka),remD=Math.max(0,5-kd);return sa>sd+remD||sd>sa+remA;};
  for(let i=0;i<5;i++){ await kick(true); if(decided())break; await kick(false); if(decided())break; }
  let guard=0;
  while(sa===sd && guard++<25){ await kick(true); await kick(false); } // サドンデス
  const win=sa>sd;
  const fin=document.createElement("div");fin.className="pk-final "+(win?"win":"lose");
  fin.innerHTML=win?`🏆 ${hn} PK勝ち抜け! <b>${sa}-${sd}</b>`:`😢 PK敗退… <b>${sa}-${sd}</b>`;
  ov.querySelector(".pk-in").appendChild(fin);
  await sleep(1600); ov.remove();
  return {win,sa,sd};
}
async function endMatch(){
  const M=MC,sh=M.home.score,sa=M.away.score;
  await gameSetCutin(sh,sa); // 試合終了カットイン(共通)
  await (MATCH_MODES[M.mode]||MATCH_MODES.stage).onEnd(M,sh,sa);
}
document.querySelectorAll(".tactics [data-t]").forEach(b=>b.onclick=()=>{
  S.tactic=b.dataset.t;
  document.querySelectorAll(".tactics [data-t]").forEach(x=>x.classList.toggle("on",x===b));
  if(MC)feed(b.dataset.t==="atk"?"⚔️ カードを前に動かした!総攻撃!":b.dataset.t==="def"?"🛡️ ラインを下げて守備固め!":"⚖️ バランス重視に戻した");
});
// 攻撃スタイルのボタンを STYLES から生成(追加=1エントリでボタンも増える)。
function buildStyleRow(){
  const row=document.getElementById("styleRow");if(!row)return;
  row.innerHTML="";
  Object.keys(STYLES).forEach((id,i)=>{
    const b=document.createElement("button");b.dataset.st=id;b.textContent=STYLES[id].btn;
    if(i===0)b.classList.add("on");
    b.onclick=()=>{ S.style=id;
      document.querySelectorAll("#styleRow [data-st]").forEach(x=>x.classList.toggle("on",x===b));
      if(MC)feed(`📣 攻撃スタイル変更 → ${STYLES[id].label}`); };
    row.appendChild(b);
  });
}
buildStyleRow();

// ================= 途中交代 =================
document.getElementById("subBtn").onclick=()=>{
  if(!MC){toast("試合中のみ交代できます");return;}
  if(MC.subs<=0){toast("交代枠を使い切りました");return;}
  MC.halt=true; // ループは次のティック前に停止
  renderSubList();
  document.getElementById("subModal").classList.add("on");
};
function fatClass(v){return v<30?"ok":v<55?"mid":"bad";}
function renderSubList(){
  const l=document.getElementById("subList");l.innerHTML="";l.style.display="block";
  document.getElementById("subBench").style.display="none";
  document.getElementById("subTitle").textContent="OUTする選手を選択(試合は一時停止中)";
  MC.home.players.forEach((p,pi)=>{
    const tired=Math.round((1-fatigue(p,MC.min))*100);
    const d=document.createElement("div");d.className="subrow";
    d.innerHTML=`<span class="pos ${p.role}">${p.subRole||p.role}</span><span class="sp"></span><b>${p.c.name}</b>
      <span style="font-size:10px;color:#8fa3b8">${typeOf(p.c).n}<br>攻${p.c.off} 守${p.c.def} 持${p.c.sta}</span>
      <span class="fat ${fatClass(tired)}">消耗${tired}%</span>`;
    d.querySelector(".sp").appendChild(spriteCanvas(p.c,30));
    d.onclick=()=>renderBench(pi);
    l.appendChild(d);
  });
}
function renderBench(pi){
  const out=MC.home.players[pi];
  const onField=MC.home.players.map(p=>p.c.id);
  const benchedOut=MC.subbedOut||(MC.subbedOut=new Set()); // 既に交代退場した選手は戻せない
  const bench=(MC.bench||[]).filter(c=>!onField.includes(c.id)&&!benchedOut.has(c.id)) // 事前設定のベンチからのみ交代可
    .sort((a,b)=>posFitOf(b,out.subRole)-posFitOf(a,out.subRole)||total(b)-total(a));
  if(!bench.length){toast("交代枠に投入できる控えがいません(編成でベンチを設定)");return;}
  document.getElementById("subTitle").textContent=`INする選手を選択(OUT: ${out.c.name} / 枠は${out.subRole||out.role})`;
  document.getElementById("subList").style.display="none";
  const g=document.getElementById("subBench");g.style.display="flex";g.innerHTML="";
  bench.forEach(c=>{
    const e=cardEl(c,true);
    e.onclick=()=>{
      const np={c,role:out.role,subRole:out.subRole,pen:posFitOf(c,out.subRole),x:out.x,y:out.y,enter:MC.min,fside:"H",el:out.el,cur:out.cur,
        stat:{shots:0,goals:0,assists:0,duelW:0,duelL:0,tkl:0,saves:0,inv:0,dload:0},
        keyStat:out.keyStat||null,keyMul:out.keyMul||1};
      benchedOut.add(out.c.id); // OUTした選手は以後ベンチに出さない(再投入不可)
      MC.home.players[pi]=np;
      if(np.el){np.el.innerHTML="";
        const rg=document.createElement("div");rg.className="ring H";
        np.el.appendChild(rg);np.el.appendChild(spriteCanvas(c,26));}
      recalcAuras(MC.home);
      MC.subs--;document.getElementById("subN").textContent=MC.subs;
      const fitMark=np.pen>=POSFIT.exact?"":np.pen>POSFIT.group?`⚠${c.sub}→${out.subRole}(細分違い)`:`⚠${c.sub}→${out.subRole}(ポジ違い)`;
      feed(`🔁 交代!OUT:${out.c.name} → IN:<b>${c.name}</b>(${c.sub}${fitMark?" "+fitMark:""})`,"chance");
      closeSub();
    };
    g.appendChild(e);
  });
}
function closeSub(){
  document.getElementById("subModal").classList.remove("on");
  if(MC&&MC.halt){MC.halt=false;runLoop();}
}
document.getElementById("subClose").onclick=closeSub;
