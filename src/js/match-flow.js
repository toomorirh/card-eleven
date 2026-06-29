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
  await ballTo(ex-dir*3,ey,0.4);hot(carrier);hot(df);
  const foul=rollFoul(df,type,carrier); if(foul){feed(`${who}${df.c.name}が${carrier.c.name}を倒した!`);await setPiece(foul,A,D,min);return {shot:true};}
  const won=resolveLink(type,carrier,df,A,D,min,tf.a,tf.d,tf.bonus); // 先に判定し、VSで勝者を表示
  await maybeVs(carrier,A,df,D,type==="cutin"?"⚡ カットイン(攻×技)":"⚡ 仕掛けのドリブル(攻×速)",won);
  if(won){
    carrier.stat.duelW++;
    feed(`${who}⚡ <b>${carrier.c.name}</b>(攻${carrier.c.off})が${df.c.name}を抜き去って自ら勝負!`,"chance");
    if(fx(carrier).duelSpd||fx(carrier).duelTec)await skillHit(carrier);
    await dribbleCutin(carrier,type); // 左→右へ駆け抜けるスピード演出(語句/色はタイプ別)
    await ballTo(gx-dir*9,ey+(50-ey)*0.3,0.3);
    await tryShot(carrier,A,D,min,false,null,null,null,"ego");
    return {shot:true};
  }
  carrier.stat.duelL++;df.stat.duelW++;df.stat.tkl++;
  feed(`${who}${df.c.name}(守${df.c.def})が${type==="cutin"?"カットイン":"ドリブル"}を止めた!`);if(fx(df).duelD)await skillHit(df);
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
    await ballTo(curP(mate).x+dir*3,curP(mate).y,0.3);
    if(resolveLink("combination",mate,df,A,D,min,tf.a,tf.d,tf.bonus)){
      mate.stat.duelW++;
      feed(`${who}🔄 <b>${carrier.c.name}</b>→<b>${mate.c.name}</b> ワンツーで前進!`,"chance");
      if(skillShow())await passCutin(carrier,mate,"ワンツー"); // パス左流れ演出(熱気で頻度調整)
      await skillAny(mate,["duelTec","mid"]);
      return {receiver:mate,assist:carrier};
    }
    df.stat.tkl++;feed(`${who}${df.c.name}がパスをカット!`);if(fx(df).duelD)await skillHit(df);
    return {lost:true,reason:"intercept"};
  }},
  // 縦パス(終端): 抜け出すランナーへ。成功でGKと1対1。
  through:{ run:async ctx=>{
    const {A,D,min,tf,who,carrier}=ctx; const dir=dirOf(A),gx=goalXOf(A);
    const r=pickTarget(A),df=matchupDefender(r,D); recMatch(r,df);
    carrier.stat.inv++;r.stat.inv++;df.stat.inv++;
    const lx=gx-dir*18, ly=20+ri(0,60);
    movePlayer(r,lx-dir*2,ly,0.5);movePlayer(df,lx+dir*2,ly+ri(-5,5),0.5);
    await ballTo(lx,ly,0.5);hot(r);hot(df);
    const foul=rollFoul(df,"through",r); if(foul){feed(`${who}${df.c.name}が${r.c.name}を倒した!`);await setPiece(foul,A,D,min);return {shot:true};}
    const won=resolveLink("through",r,df,A,D,min,tf.a,tf.d,tf.bonus); // 先に判定し、VSで勝者を表示
    await maybeVs(r,A,df,D,"🚀 裏抜けの駆けっこ(速)",won);
    if(won){
      r.stat.duelW++;
      feed(`${who}🚀 <b>${carrier.c.name}</b>の縦パス!<b>${r.c.name}</b>(速${r.c.spd})が抜け出した!`,"chance");
      if(skillShow())await passCutin(carrier,r,"スルーパス"); // パス左流れ演出(熱気で頻度調整)
      if(fx(r).duelSpd)await skillHit(r);
      await ballTo(gx-dir*9,ly+(50-ly)*0.3,0.3);
      await tryShot(r,A,D,min,false,null,null,carrier);
      return {shot:true};
    }
    df.stat.tkl++;feed(`${who}${df.c.name}(速${df.c.spd})が先回りしてクリア!`);if(fx(df).duelD)await skillHit(df);
    if(Math.random()<TUNING.setpiece.cornerOnClear){await setCorner(A,D,min);return {shot:true};}
    return {lost:true,reason:"clear"};
  }},
  // クロス(終端): 幅から中央のターゲットへ→ヘディング(aerialBox共用)。
  cross:{ run:async ctx=>{
    const {A,D,min,tf,who,carrier}=ctx;
    carrier.stat.inv++;
    feed(`${who}🏃 <b>${carrier.c.name}</b>がクロスを上げる!`,"chance");
    if(skillShow())await crossCutin(carrier); // クロスのスピード演出(熱気で頻度調整)
    await ballTo(curP(carrier).x,curP(carrier).y,0.25);
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
  for(const tac of mgrTacs(A.mgr)){                            // カスタム監督は複数tacを順に判定(名将は単数)
    if(tac.from==="cb")continue;                              // cb(密集ブロック)は守備采配=tryShot側
    if(!tacFromMatch(tac,carrier)||!tacCondMet(tac,A))continue; // 起点が采配のキープレイヤーか
    if(Math.random()<tac.chance)return tac;
  }
  return null;
}
async function mgrTacAction(A,D,min,carrier,tac,who){
  feed(`${who}🎓 監督の采配!【${tac.name}】が炸裂!`,"goal");
  addVolt(TUNING.volt.shot);
  await tacCutin(tac,A.mgr,carrier);
  if(tac.from==="sb"){ // アーリークロス → 空中戦(采配ボーナス)
    await ballTo(curP(carrier).x,curP(carrier).y,0.2);
    await aerialBox(A,D,min,carrier,{a:1.3,d:1,bonus:1.3},who);
    return;
  }
  // 電光タクト / 電撃カウンター: 抜け出すランナーへ決定的スルー → 1対1
  const dir=dirOf(A),gx=goalXOf(A), r=pickTarget(A)||carrier; r.stat.inv++;
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
    if(out.lost){await ballTo(curP(carrier).x-dir*8,curP(carrier).y+ri(-10,10),0.5);return;}
    if(out.shot)return;
    carrier=out.receiver; if(out.assist)assist=out.assist; steps++;
    prog=Math.min(0.9,prog+L.progStep);
    movePlayer(carrier,gx-dir*(18-steps*4),curP(carrier).y,0.4); // 連結のたびに受け手が前進
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
  movePlayer(t,cx-dir*2,cy,0.4);movePlayer(df,cx+dir*2,cy+ri(-4,4),0.4);
  await ballTo(cx,cy,0.4);hot(t);hot(df);
  if(resolveLink("cross",t,df,A,D,min,tf.a,tf.d,tf.bonus)){
    t.stat.duelW++;
    feed(`${who}中央で<b>${t.c.name}</b>(力${t.c.pow})が競り勝つ!`,"chance");
    if(fx(t).duelPow)await skillHit(t);
    await tryShot(t,A,D,min,true,cx,cy,deliverer);
    return {shot:true};
  }
  df.stat.tkl++;feed(`${who}${df.c.name}(力${df.c.pow})が跳ね返した!`);if(fx(df).duelD)await skillHit(df);
  return {clear:true};
}
// セットプレー レジストリ(pk/fk/ck)。各 run は自己完結(キッカー選定→演出→spShot/aerialBox)。
// 追加=1エントリ+呼び出し元。共有プリミティブは spShot(高ベース判定)/aerialBox(空中戦)。
const SETPIECES={
  pk:{ async run(A,D,min){
    const who=whoPrefix(A), taker=pickShooter(A), dir=dirOf(A),gx=goalXOf(A);
    recordSet(MC,"pk");
    feed(`${who}🎯 PK獲得! <b>${taker.c.name}</b>がスポットへ`,"goal");
    movePlayer(taker,gx-dir*11,50,0.4); // キッカーもスポットへ(ボールだけが動く違和感を解消)
    await ballTo(gx-dir*8,50,0.4);
    await pkCutin(taker,pickGK(D)); // キッカー vs GK の一騎打ち
    const g=await spShot(taker,A,D,min,TUNING.setpiece.pkBase,"PK!!","pk");
    if(g)recordSet(MC,"pk",true);
  }},
  fk:{ async run(A,D,min){
    const who=whoPrefix(A), taker=pickShooter(A), dir=dirOf(A),gx=goalXOf(A);
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
    const who=whoPrefix(A), kicker=pickShooter(A), dir=dirOf(A),gx=goalXOf(A);
    recordSet(MC,"ck");
    feed(`${who}🚩 コーナーキック! <b>${kicker.c.name}</b>が蹴る`,"chance");
    await spCutin(kicker,"コーナーキック");
    const cy=curP(kicker).y<50?8:92;
    movePlayer(kicker,gx-dir*5,cy,0.45); // キッカーもコーナーへ走り込む(ボールだけが動く違和感を解消)
    await ballTo(gx-dir*2,cy,0.45);
    await aerialBox(A,D,min,kicker,{a:1.05,d:1,bonus:1},who);
  }},
};
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
// ゴール演出の集約: 加点 + 種別/スーパー判定 + スコアpop/歓声 + バナー/カットイン + 流れ(同点・勝ち越し・ハット)。
async function goalCelebrate(scorer,A,D,min,opts={}){
  const preA=A.score, preD=D.score;
  addVolt(TUNING.volt.goal); // 得点で熱気が一気に上がる
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
  await wordCutin(scorer,A,sup?"SUPER GOAL!!":"GOAL!!!",true,sup?1700:1450,sup);
  if(preA<preD&&A.score===preD)feed(`${who}🔥 ${teamName(A)}が同点に追いついた!`,"chance");
  else if(preA===preD&&A.score>preD)feed(`${who}🔥 ${teamName(A)}が勝ち越し!`,"chance");
  if(scorer.stat.goals===2)feed(`${who}⭐ ${scorer.c.name} 2点目!`);
  if(scorer.stat.goals===3)feed(`${who}🌟 ${scorer.c.name} ハットトリック達成!!`,"goal");
  await kickoffReset();
}
// シュート: 演出 → resolveShot で判定 → ゴール/セーブ(奇跡の手は1試合1回失点無効)
async function tryShot(atk,A,D,min,header,fx0,fy0,assist,kind){
  // 名将の采配シグネ(守備): 相手にシュートされた瞬間、熱気が一定以上なら自チームCBがブロック(密集ブロック)
  if(A.side==="A"&&MC&&MC.home&&(MC.volt||0)>=TUNING.volt.tacGate){
    const dtac=mgrCbTac(MC.home); // 自チームの守備采配(cb)を1つ取得(カスタム監督の複数tacにも対応)
    if(dtac&&Math.random()<dtac.chance){
      const cb=MC.home.players.find(p=>p.subRole==="CB")||pickDefender(MC.home);
      cb.stat.tkl++;cb.stat.inv++;
      feed(`🎓 監督の采配!【${dtac.name}】<b>${cb.c.name}</b>が身体を投げ出してブロック!`,"chance");
      await tacCutin(dtac,MC.home.mgr,cb);
      await ballTo(goalXOf(A)-dirOf(A)*16,50,0.45); // 弾き出し
      return;
    }
  }
  atk.stat.shots++;
  addVolt(TUNING.volt.shot); // シュートで熱気が上がる
  const gk=pickGK(D);
  atk.stat.inv++;gk.stat.inv++;defLoad(D,TUNING.fatigue.dloadShot);
  await auraSkill(A,"teamChance",TUNING.aura.teamChance); // 決定機を演出した司令塔役(teamChance)の発動を明示
  const fxA=fx(atk),fxG=fx(gk);
  const dir=dirOf(A),gx=goalXOf(A);
  const sx=fx0!=null?fx0:curP(atk).x, sy=fy0!=null?fy0:curP(atk).y;
  const gy=42+ri(0,16);
  movePlayer(atk,sx,sy,0.3);
  movePlayer(gk,gx-dir*2,gy,0.3);     // GKがコースに立つ
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
    await wordCutin(gk,D,"SAVE!!",false,720);
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
  M.home.tactic=S.tactic;M.home.style=S.style;
  if(M.min===MT.oppAdjustMin){
    M.away.tactic=M.away.score<M.home.score?"atk":M.away.score>M.home.score?"def":"bal";
    if(M.away.tactic==="atk")feed(`${M.name}がカードを前に動かしてきた!攻勢だ!`);
  }
  const mh=midPower(M.home,M.away,M.min),ma=midPower(M.away,M.home,M.min);
  // 主導権(支配率比) → 奪取(カウンター)判定 → チャンネル/起点選択
  let T=Math.random()<mh/(mh+ma)?M.home:M.away;
  let D=T===M.home?M.away:M.home;
  let channel,origin;
  if(rollTurnover(T,D,M.min)){
    [T,D]=[D,T];channel="win";origin=pickWinner(T,D,M.min);
    feed(`${whoPrefix(T)}⚡ ${origin.c.name}がボールを奪った!カウンターのチャンス!`,"chance");
  }else{
    channel=pickChannel(T,D,M.min);
    origin=pickOriginPlayer(T,D,channel,M.min);
  }
  // モメンタム(連続攻撃): 同じチームが攻め続けると「猛攻」コール
  if(M._lastAtk===T.side){M._streak=(M._streak||1)+1;}else{M._streak=1;M._lastAtk=T.side;}
  if(M._streak===MT.streakHeat){feed(`${whoPrefix(T)}🔥 ${teamName(T)}の猛攻!押し込んでいる!`,"chance");addVolt(TUNING.volt.surge);}
  const dir=dirOf(T);
  defLoad(D,1); // 被攻撃ぶんの守備負荷を相手DFラインに分担(忙しい試合ほどDFが疲れる)
  await auraSkill(T,"mid",TUNING.aura.mid); // 中盤を支配した側の mid 系スキル(支配率)の発動を明示
  origin.stat.inv++;
  // 消耗が一定を超えた選手に「疲れが見える」を一度だけ告知(交代の判断材料/演出)
  if(!origin._gassed && (1-fatigue(origin,M.min))>=TUNING.fatigue.gassedFeed){
    origin._gassed=true;
    feed(`${whoPrefix(T)}💨 ${origin.c.name}に疲れが見える…動きが重くなってきた`);
  }
  await ballTo(curP(origin).x+dir*2,curP(origin).y,0.4); // 起点へボールが収まる
  updateField();
  const tShare=mh/(mh+ma), edge=(T===M.home)?tShare:1-tShare;
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
  hideStatOverlay();
  document.querySelectorAll(".screen").forEach(x=>x.classList.remove("on"));
  document.getElementById("scr-match").classList.add("on");
  const home=home0||myTeam();
  away.style=oppPickStyle(away);
  MC={home,away,min:0,ball:50,bx:50,by:50,idx,name,lv,subs:3,halt:false,loop:false,volt:0};
  MC.subbedOut=new Set(); // 交代でOUTした選手のcard id(再投入不可=ベンチから除外)
  MC.mode=S._careerMatch?"career":S._leagueMatch?"league":S._friendMatch?"friend":S._worldMatch?"world":"stage"; // 終了処理の分岐に使う(MATCH_MODES)
  document.getElementById("subN").textContent=3;
  buildField();
  feed(`⚽ キックオフ! vs ${name}${lv?`(Lv.${lv})`:""}`);
  feed(`相手のフォーメーション:【${form}】`);
  if(FORM_DESC[form])feed(`📋 ${FORM_DESC[form]}`,"chance");
  feed(`相手の攻撃スタイル:${STYLE_LABEL[away.style]}`);
  if(home.mgr)feed(`🎯 監督『${home.mgr.title}』起用中! ${mgrBoostDesc(home.mgr)}`,"chance");
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
function startCareer(name){
  S.career={name:(name||"新人監督").slice(0,16), step:0, div:3, node:0, pts:0, gf:0, ga:0,
    ovrCap:CAREER.startCap, boosts:[], tacs:[], finished:false};
  save(); gotoCareer();
}
function startCareerMatch(){ // ①リーグ: 上限内編成で div相応の相手と1試合
  const cr=S.career; if(!cr||cr.finished)return;
  if(finalizeCareerIfDone())return;
  S._careerMatch=true; // careerTeam→buildTeam→homeManager が育成中監督を拾えるよう先に立てる
  const team=careerTeam(cr.ovrCap);
  if(team.players.length<11){S._careerMatch=false;toast("手持ちが11人に足りません(編成できません)");return;}
  const lv=CAREER.divLv[cr.div]||5;
  _beginMatch(oppTeam(lv,{form:"4-4-2"}), `DIV${cr.div} 第${cr.node+1}節`, "4-4-2", lv, -1, team);
}
function careerPractice(){ // ③練習: OVR上限を緩和(1ステップ消費)
  const cr=S.career; if(!cr||cr.finished)return;
  if(finalizeCareerIfDone())return;
  cr.ovrCap=Math.min(CAREER.capMax, cr.ovrCap+CAREER.practiceCap); cr.step++;
  toast(`💪 練習試合! 編成OVR上限 +${CAREER.practiceCap}(現在 ${cr.ovrCap})`);
  save(); if(!finalizeCareerIfDone())gotoCareer();
}
function finalizeCareerIfDone(){ // 48ステップ到達→カスタム監督を確定して登録
  const cr=S.career; if(!cr||cr.step<CAREER.steps)return false;
  const m=createCustomManager({name:cr.name, title:"育成監督", boosts:cr.boosts, tacs:cr.tacs});
  S.career=null; save();
  toast(`🎓 任期満了! カスタム監督「${m.name}」誕生! 監督室で起用できます`);
  if(typeof gotoOffice==="function")gotoOffice("mgr");
  return true;
}
// 主将 = 6ステ合計が最大の選手(キャプテン未指名のため最高OVRで代用)。
const teamTotal6=c=>c.off+c.def+c.pow+c.tec+c.spd+c.sta;
const teamCaptain=T=>T.players.reduce((b,p)=>teamTotal6(p.c)>teamTotal6(b.c)?p:b,T.players[0]);

// ================= 試合後スタッツ(オーバーレイ) =================
let _statTeams=null;
function renderStatRows(team,opp){
  const rows=team.players.map(p=>({p,r:statRating(p,opp)})).sort((a,b)=>b.r-a.r);
  const mom=rows[0];
  let h='<table class="statTbl"><tr><th>枠</th><th>選手</th><th>評価</th><th>関与</th><th>G</th><th>A</th><th>デュエル</th><th>SV</th></tr>';
  rows.forEach(({p,r})=>{
    const s=p.stat,isMom=p===mom.p,low=r<5.0;
    h+=`<tr class="${isMom?"mom":""}${low?" lowform":""}">
      <td><span class="pos ${p.role}">${p.subRole||p.role}</span></td>
      <td>${isMom?"★":""}${p.c.name}</td>
      <td>${r.toFixed(1)}</td>
      <td>${s.inv||0}</td>
      <td>${s.goals}</td>
      <td>${s.assists}</td>
      <td>${s.duelW}-${s.duelL}</td>
      <td>${p.role==="GK"?s.saves:"-"}</td>
    </tr>`;
  });
  h+='</table><div class="lg" style="margin-top:4px">★MOM(最優秀選手) / 関与=試合への絡んだ回数 / 評価5.0未満は次戦の入れ替え候補</div>';
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
    const r=sh>sa?"🏆 勝利":sh===sa?"🤝 引分":"😢 敗北";
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
    const head=sh>sa?"🏆 勝利":sh===sa?"🤝 引分":"😢 敗北";
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
    const head=sh>sa?"🏆 勝利":sh===sa?"🤝 引分":"😢 敗北";
    let drop="";
    if(r==="W"){ // 署名保有国に勝利 → 低確率で固有選手ドロップ(未所持優先)
      const sigs=SIGNATURES.filter(s=>s.flag===nation.flag);
      if(sigs.length&&S.coll.length<COLL_CAP&&Math.random()<TUNING.worldSigDrop){ // 満員(最大500)では固有ドロップをスキップ
        const own=new Set(S.coll.filter(c=>c.sig).map(c=>c.sig));
        const pool=sigs.filter(s=>!own.has(s.id)); const cand=pool.length?pool:sigs;
        const pick=cand[ri(0,cand.length-1)];
        S.coll.push(makeSignature(pick.id));
        drop=`<div class="banner" style="font-size:14px;color:#ff9ec4">🌟 ${nation.name}撃破! 固有選手「${pick.name}」を獲得!!</div>`;
        feed(`🌟 ${nation.name}を撃破!固有選手「${pick.name}」を獲得!`,"goal");
      }
    }
    tour.i++;
    const last=tour.i>=WORLD_NATIONS.length;
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
    if(sh>sa){msg="🏆 勝利!!";reward=TUNING.reward.base+lv*TUNING.reward.perLv;if(M.idx===S.cleared)S.cleared++;}
    else if(sh===sa){msg="🤝 引き分け";reward=TUNING.reward.draw;}
    else{msg="😢 敗北…";reward=TUNING.reward.lose;}
    S.coins+=reward;coinUI();
    feed(`試合終了 ${sh}-${sa} ${msg} 報酬🪙${reward}`,"goal");
    const dropP=sh>sa?TUNING.drop.win:sh===sa?TUNING.drop.draw:TUNING.drop.lose;
    let dropMsg="";
    if(Math.random()<dropP){
      S.legendPacks=(S.legendPacks||0)+1;
      dropMsg=`<div class="banner" style="font-size:15px;color:#7dff9e">🎁 レジェンドパックを手に入れた!!</div>`;
      feed("🎁 レジェンドパックを手に入れた!!ガチャ画面で開封できる","goal");
    }
    const e=document.getElementById("matchEnd");
    e.innerHTML=`<div class="banner">${msg}</div>`+dropMsg;
    showStatOverlay(M.home,M.away);
    const idx=M.idx;
    const row=document.createElement("div");row.className="row";
    const rt=document.createElement("button");rt.className="btn";rt.textContent="🔄 リトライ";
    rt.onclick=()=>startMatch(idx);                 // 同じ相手とその場で再戦
    const bk=document.createElement("button");bk.className="btn ghost";bk.textContent="戻る";
    bk.onclick=()=>{document.querySelector('[data-s="home"]').click();};
    row.appendChild(rt);row.appendChild(bk);
    e.appendChild(row);
    MC=null;
    checkAchievements(); // ステージ攻略の達成で実績報酬を付与
    await save();
  }},
  career:{ async onEnd(M,sh,sa){ // 監督キャリアのリーグ1試合
    S._careerMatch=false;
    const cr=S.career; const o=cr?careerRecordResult(cr,sh,sa):{res:"-"};
    const head=sh>sa?"🏆 勝利":sh===sa?"🤝 引分":"😢 敗北";
    const e=document.getElementById("matchEnd");
    let html=`<div class="banner">${head} ${sh}-${sa}</div>`;
    if(o.seasonEnd){
      const pct=Math.round((o.boost.mul-1)*1000)/10;
      html+=`<div class="banner" style="color:#7dff9e">🏆 DIV${o.seasonDiv}制覇! 勝点${o.seasonPts} → 監督バフ「全能力 +${pct}%」獲得!</div>`;
      if(o.promoted)html+=`<div class="banner" style="font-size:14px">⬆ DIV${cr.div}へ昇格!</div>`;
    }
    e.innerHTML=html;
    showStatOverlay(M.home,M.away);
    const b=document.createElement("button");b.className="btn";b.textContent="キャリアへ戻る";
    b.onclick=()=>{MC=null; if(!finalizeCareerIfDone())gotoCareer();};
    e.appendChild(b);
    await save();MC=null;
  }},
};
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
  const bench=S.coll.filter(c=>!onField.includes(c.id)&&!benchedOut.has(c.id))
    .sort((a,b)=>posFit(b.sub,out.subRole)-posFit(a.sub,out.subRole)||total(b)-total(a));
  if(!bench.length){toast("交代で投入できる控え選手がいません");return;}
  document.getElementById("subTitle").textContent=`INする選手を選択(OUT: ${out.c.name} / 枠は${out.subRole||out.role})`;
  document.getElementById("subList").style.display="none";
  const g=document.getElementById("subBench");g.style.display="flex";g.innerHTML="";
  bench.forEach(c=>{
    const e=cardEl(c,true);
    e.onclick=()=>{
      const np={c,role:out.role,subRole:out.subRole,pen:posFit(c.sub,out.subRole),x:out.x,y:out.y,enter:MC.min,fside:"H",el:out.el,cur:out.cur,
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
