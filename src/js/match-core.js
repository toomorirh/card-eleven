// ================= 試合コア(純粋シミュレーション&バランス・DOM非依存) =================
// マッチアップの基本は据え置き(バランス検証済みの数値):
//  支配=中盤の技/速/持、中央=得意勝負、サイド=速技→クロス→力、ロング=技→速の駆けっこ、ショート=技の連携
// バランス調整値は data.js の TUNING に集約。ここは「式・選手選出・勝敗判定」の純粋ロジック。
const TH=TUNING.th;
let MC=null; // 進行中の試合コンテキスト(描画/進行から参照・更新)
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fatigue(c,played){
  if(c.skill&&c.skill.fx.iron)return 1;
  return 1-(Math.min(Math.max(played,0),90)/90)*TUNING.fatigueMax*(1-(c.sta-1)/19);
}
function recalcAuras(t){
  t.teamChance=1;t.teamDef=1;
  t.players.forEach(p=>{
    const f=p.c.skill?p.c.skill.fx:{};
    if(f.teamChance)t.teamChance*=f.teamChance;
    if(f.teamDef)t.teamDef*=f.teamDef;
  });
  // 同国籍ケミストリー: 最多同国籍人数に応じてチーム全体を微強化(両チーム共通・対称)
  const cnt={};let mx=0,nat=null;
  t.players.forEach(p=>{const f=p.c.flag||"?";cnt[f]=(cnt[f]||0)+1;if(cnt[f]>mx){mx=cnt[f];nat=f;}});
  t.chemN=mx;t.chemNat=nat;
  t.chem=1+Math.min(0.06,Math.max(0,mx-2)*0.012); // 3人で+1.2% … 7人以上で+6%(上限)
}
function buildTeam(cards,side,form){
  const t={players:cards,tactic:"bal",style:"center",score:0,side,form};
  cards.forEach(p=>{p.fside=side;p.stat={shots:0,goals:0,assists:0,duelW:0,duelL:0,tkl:0,saves:0,inv:0};});
  recalcAuras(t);
  return t;
}
// 試合後評価。勝敗ロジックには一切影響しない「採点レイヤー」。
//  ・関与度(inv)を主軸にして全選手に差をつける(出番が少ない=低評価)
//  ・離散イベント(ゴール/アシスト/デュエル/タックル/セーブ)をスパイクとして加減
//  ・守備陣は無失点/失点のチーム文脈を反映
//  平常は概ね 4.0〜7.5 に散り、MOMは8〜9.5、不出来は3.5前後まで落ちる設計。
function statRating(p,opp){
  const s=p.stat||{};
  // GKは構造的に関与回数が少ないため、セーブ+無失点/失点で評価する専用スケール
  if(p.role==="GK"){
    let g=5.5+(s.saves||0)*0.35;
    if(opp){ if(opp.score===0)g+=0.7; else g-=Math.min(1.2,opp.score*0.30); }
    return Math.max(3.0,Math.min(10,Math.round(g*10)/10));
  }
  const inv=s.inv||0;
  let r=4.0+2.05*Math.log10(1+inv);                      // 関与ベース: inv0→4.0 / 3→5.2 / 8→5.9 / 20→6.7 / 45→7.4
  r+=(s.goals||0)*0.9+(s.assists||0)*0.55                // 攻撃の決定的関与
    +(s.duelW||0)*0.12-(s.duelL||0)*0.12                 // 1対1の明暗
    +(s.tkl||0)*0.14+(s.saves||0)*0.30                   // 守備の貢献
    -((s.shots||0)-(s.goals||0))*0.06;                   // 決め切れない非効率は微減
  if(opp&&p.role==="DF"){                                 // DFのチーム文脈
    if(opp.score===0)r+=0.5;                             // 無失点ボーナス
    else r-=Math.min(0.8,opp.score*0.18);               // 失点ペナルティ(上限)
  }
  return Math.max(3.0,Math.min(10,Math.round(r*10)/10));
}
function myTeam(){
  const cards=[];
  const kp=KEYPOS[S.form]||{};
  FORMS[S.form].forEach((sl,i)=>{
    const c=S.coll.find(k=>k.id===S.squad[i]);
    if(c)cards.push({c,role:subGroup(sl[0]),subRole:sl[0],pen:posFit(c.sub,sl[0]),x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1});
  });
  return buildTeam(cards,"H",S.form);
}
function oppTeam(lv,club){
  if(typeof club==="string")club={form:club}; // 後方互換(form文字列)
  club=club||{};
  const form=club.form||"4-4-2"; // 省略時は従来通り4-4-2(テスト互換)
  const restore=(club.seed!=null)?seedRandom(club.seed):null; // seed指定でロスター固定(生成ロジックは不変=強さ不変)
  const avg=6.6+lv*1.0; // 1選手あたり平均ステ(クラブLv1≈7.6 → Lv8≈14.6)
  const kp=KEYPOS[form]||{};
  const cards=FORMS[form].map((sl,i)=>{
    const a=avg+ri(-1,1);
    const rar=a>=13?"sr":a>=10?"r":"n";
    const c=makeCard(subGroup(sl[0]),rar,null,sl[0]);
    if(club.flags)c.flag=rnd(club.flags); // テーマ国籍(任意・ワールドツアー用)
    scaleTo(c,a*6); // チームLvに応じて合計を微調整
    return {c,role:subGroup(sl[0]),subRole:sl[0],pen:1,x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  });
  const fwIdx=FORMS[form].map((sl,i)=>subGroup(sl[0])==="FW"?i:-1).filter(i=>i>=0);
  if(club.ace&&typeof makeSignature==="function"){ // エース固有選手(任意・意図的な難度UP。現行クラブ未使用)
    const i=fwIdx.length?rnd(fwIdx):FORMS[form].length-1;
    const sig=makeSignature(club.ace);
    if(sig)cards[i]={c:sig,role:subGroup(cards[i].subRole),subRole:cards[i].subRole,pen:1,x:cards[i].x,y:cards[i].y,enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  }else if(lv>=8){ // 最終ボスのエースはレジェンド(陣形のFW枠からランダムに1名)
    const i=fwIdx.length?rnd(fwIdx):FORMS[form].length-1;
    const sb=cards[i].subRole;
    cards[i]={c:makeCard(subGroup(sb),"l",null,sb),role:subGroup(sb),subRole:sb,pen:1,x:cards[i].x,y:cards[i].y,enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  }
  const t=buildTeam(cards,"A",form);
  if(restore)restore();
  return t;
}
function oppPickStyle(t){
  const wide=t.players.filter(p=>p.role!=="GK"&&(p.x<=30||p.x>=70));
  const fws=t.players.filter(p=>p.role==="FW"),mfs=t.players.filter(p=>p.role==="MF");
  const avg=(l,k)=>l.length?l.reduce((s,p)=>s+p.c[k],0)/l.length:0;
  const sc={center:avg(fws,"off")+avg(fws,"pow")*0.5,
    side:avg(wide,"spd")+avg(wide,"tec"),
    long:avg(fws,"spd")*1.4+avg(t.players.filter(p=>p.role!=="FW"),"tec")*0.4,
    short:avg(mfs,"tec")*1.6};
  let best="center",bv=-1;
  for(const k in sc){const v=sc[k]*(0.85+Math.random()*0.3);if(v>bv){bv=v;best=k;}}
  return best;
}
function situ(p,T,opT,min){
  const f=p.c.skill?p.c.skill.fx:{};
  let m=1;
  if(f.clutch&&min>=70)m*=f.clutch;
  if(f.losing&&T.score<opT.score)m*=f.losing;
  return m;
}
// 有効値: 全マッチアップ・シュート・GK守備の単一集約点(pen×疲労×状況×ケミ×キーポジ)
function eff(p,k,min,T,opT){
  const km=p.keyStat===k?(p.keyMul||1):1;
  return p.c[k]*p.pen*fatigue(p.c,min-p.enter)*situ(p,T,opT,min)*(T&&T.chem||1)*km;
}
function fx(p){return p.c.skill?p.c.skill.fx:{};}
function midPower(T,opT,min){
  let m=0;
  T.players.forEach(p=>{
    const w=(p.role==="MF"?TUNING.mid.mf:TUNING.mid.other)*(fx(p).mid||1)*typeOf(p.c).poss;
    m+=(eff(p,"tec",min,T,opT)*TUNING.mid.tec+eff(p,"spd",min,T,opT)*TUNING.mid.spd+eff(p,"sta",min,T,opT)*TUNING.mid.sta)*w;
  });
  const tf=T.tactic==="atk"?TUNING.midTactic.atk:T.tactic==="def"?TUNING.midTactic.def:1;
  const sf=T.style==="short"?TUNING.midStyle.short:T.style==="long"?TUNING.midStyle.long:1;
  return m*tf*sf;
}
function pickW(list,wfn){
  if(!list.length)return null;
  const tot=list.reduce((s,x)=>s+wfn(x),0);let r=Math.random()*tot;
  for(const x of list){r-=wfn(x);if(r<=0)return x;}
  return list[list.length-1];
}
const isWide=p=>p.role!=="GK"&&(p.x<=30||p.x>=70);
function pickAttacker(T){return pickW(T.players.filter(p=>p.role!=="GK"),p=>(p.role==="FW"?3:p.role==="MF"?1.5:0.3)*(typeOf(p.c).atk||1));}
function pickDefender(T){return pickW(T.players.filter(p=>p.role!=="GK"),p=>(p.role==="DF"?3:p.role==="MF"?1:0.2)*(typeOf(p.c).defSel||1));}
function pickWide(T){const ws=T.players.filter(p=>isWide(p)||(p.role!=="GK"&&typeOf(p.c).wideSel));return ws.length?pickW(ws,p=>(p.c.spd+p.c.tec)*(typeOf(p.c).wideSel?1.25:1)):pickAttacker(T);}
function pickWideDef(T){const ws=T.players.filter(p=>p.role==="DF"&&(p.x<=35||p.x>=65));return ws.length?rnd(ws):pickDefender(T);}
function pickTarget(T){return pickW(T.players.filter(p=>p.role==="FW"||p.role==="MF"),p=>(p.role==="FW"?3:0.4)*(typeOf(p.c).tgt||1));}
function pickPasser(T){return pickW(T.players.filter(p=>p.role!=="FW"),p=>(p.role==="MF"?2:1)*p.c.tec*(typeOf(p.c).pas||1));}
function pickPress(T){return pickW(T.players.filter(p=>p.role==="MF"||p.role==="DF"),p=>p.c.spd+p.c.def);}
function pickGK(T){return T.players.find(p=>p.role==="GK")||T.players[0];}
const rr=()=>TUNING.rng.min+Math.random()*TUNING.rng.span;

// ===== 起点(オリジン)選択: 開放playの4チャンネル(純粋ロジック) =====
// プレス強度(奪取力): 守備で動く選手の def+spd をポジション/型で重み付け
function pressPower(T,opp,min){
  let s=0;
  T.players.forEach(p=>{
    if(p.role==="GK")return;
    const ty=typeOf(p.c);
    const w=(p.role==="DF"?1:p.role==="MF"?0.9:0.5)*(ty.defSel||1);
    s+=(eff(p,"def",min,T,opp)*0.6+eff(p,"spd",min,T,opp)*0.4)*w;
  });
  return s;
}
// ビルドの安全度(奪われにくさ): tec×支配
function buildSecurity(T,opp,min){
  let s=0;
  T.players.forEach(p=>{ if(p.role!=="GK") s+=eff(p,"tec",min,T,opp)*typeOf(p.c).poss; });
  return s;
}
// 奪取(カウンター)判定: 守備側Dが攻撃側Tからボールを奪うか。専用ロングカウンター抽選の置換。
function rollTurnover(T,D,min){
  const press=pressPower(D,T,min)*(D.tactic==="atk"?TUNING.origin.pressAtk:1);
  const sec=buildSecurity(T,D,min)/(T.tactic==="atk"?TUNING.origin.riskAtk:1);
  return Math.random()<TUNING.origin.turnoverBase*press/(press+sec||1);
}
// 奪取者: 高(def+spd)の選手(FW/MF/DF可。"高DFのFW"が前で奪う等)
function pickWinner(D,opp,min){
  return pickW(D.players.filter(p=>p.role!=="GK"),p=>{
    const ty=typeOf(p.c);
    return (eff(p,"def",min,D,opp)*0.5+eff(p,"spd",min,D,opp)*0.5)*(ty.defSel||0.8)*(p.role==="FW"?1.1:1);
  });
}
// 深い位置の選手(feedチャンネルの担い手): DF全員 + 低い位置取りのMF(アンカー等)
function isDeep(p){return p.role==="DF"||(p.role==="MF"&&typeOf(p.c).adv<0);}
// チャンネルの代表強度(count正規化＝平均)。選手数の多寡で偏らないようにする。
function chanAvg(T,filter,statfn){
  const ps=T.players.filter(filter);
  return ps.length?ps.reduce((s,p)=>s+statfn(p),0)/ps.length:0;
}
// 通常起点のチャンネル選択(build/overlap/feed)。チャンネル基準重み×スタイルバイアス。
function pickChannel(T,opp,min){
  const sb=TUNING.origin.styleBias[T.style]||{};
  const cb=TUNING.origin.channelBase;
  const w={
    build:  chanAvg(T,p=>p.role==="MF", p=>eff(p,"tec",min,T,opp)*typeOf(p.c).poss)*cb.build*(sb.build||1),
    overlap:chanAvg(T,p=>isWide(p)&&p.role!=="GK", p=>(eff(p,"spd",min,T,opp)+eff(p,"tec",min,T,opp))/2*(typeOf(p.c).wideSel?1.2:1))*cb.overlap*(sb.overlap||1),
    feed:   chanAvg(T,isDeep, p=>eff(p,"tec",min,T,opp))*cb.feed*(sb.feed||1),
  };
  return pickW(Object.keys(w),k=>w[k]);
}
// チャンネル内の起点選手を抽選
function pickOriginPlayer(T,opp,channel,min){
  if(channel==="overlap"){
    const ws=T.players.filter(p=>isWide(p)&&p.role!=="GK");
    return ws.length?pickW(ws,p=>(eff(p,"spd",min,T,opp)+eff(p,"tec",min,T,opp))*(typeOf(p.c).wideSel?1.3:1)):pickAttacker(T);
  }
  if(channel==="feed"){
    const ds=T.players.filter(isDeep);
    return ds.length?pickW(ds,p=>eff(p,"tec",min,T,opp)*typeOf(p.c).poss):pickPasser(T);
  }
  // build: MF優位で全選手から(tec×支配)
  return pickW(T.players.filter(p=>p.role!=="GK"),p=>(p.role==="MF"?2.2:p.role==="DF"?0.5:1.2)*eff(p,"tec",min,T,opp)*typeOf(p.c).poss);
}
// ビルドアップ成功(攻撃が形になるか)。失敗=保持崩れ(攻撃イベントなし)。edge=Tの支配率シェア(0..1)。
function buildupSuccess(channel,edge){
  const b=TUNING.origin.buildup[channel]??0.55;
  return Math.random()<b*(0.8+edge*0.4);
}

// ===== 連鎖チェーンのマッチアップ&リンク(純粋ロジック) =====
const stamOf=(p,min)=>fatigue(p.c,min-(p.enter||0)); // 現在のスタミナ係数(疲れると低下)
const laneOf=p=>p.x;                                   // 静的レーン(左右0-100)。マッチアップの主基準
// ポジションマッチアップ: 受け手のレーンに対応する守備者(左右ミラー=100-lane)。静的レーン主体。
function matchupDefender(recv,D){
  const target=100-laneOf(recv);
  return pickW(D.players.filter(p=>p.role!=="GK"),p=>{
    const dist=Math.abs(laneOf(p)-target);
    const roleW=p.role==="DF"?1:p.role==="MF"?0.5:0.15;
    return roleW*Math.max(0.06,1-dist/55);            // レーンが近いほど対応しやすい
  })||pickDefender(D);
}
// リンク種別の選択重み(=個性)。dribble/cutin は off/spd/tec×スタミナ×type.drive でエゴが出る。
function linkWeight(type,p,min,A,D){
  const ty=typeOf(p.c), b=TUNING.link.base[type]||1, es=TUNING.link.egoStat;
  const ego=(eff(p,"off",min,A,D)*es.off+eff(p,"spd",min,A,D)*es.spd+eff(p,"tec",min,A,D)*es.tec)*stamOf(p,min)*(ty.drive||1);
  switch(type){
    case "combination":
    case "through":  return b*eff(p,"tec",min,A,D)*(ty.pas||1);
    case "cross":    return b*eff(p,"tec",min,A,D)*(ty.wideSel?1.3:1);
    case "dribble":
    case "cutin":    return b*ego;
  }
  return b;
}
// リンクの競り合い判定(種別ごとのステ配合)。true=成功。resolveDuelと同形。
function resolveLink(type,atk,df,A,D,min,tfA,tfD,bonus){
  let aSc,dSc,thr;
  switch(type){
    case "combination":
      aSc=eff(atk,"tec",min,A,D)*(fx(atk).duelTec||fx(atk).mid||1); thr=TH.chain;
      dSc=(eff(df,"def",min,D,A)*0.5+eff(df,"spd",min,D,A)*0.5)*(fx(df).duelD||1); break;
    case "through":
      aSc=eff(atk,"spd",min,A,D)*(fx(atk).duelSpd||1); thr=TH.longRace;
      dSc=(eff(df,"spd",min,D,A)*0.55+eff(df,"def",min,D,A)*0.45)*(fx(df).duelD||1); break;
    case "cross":
      aSc=(eff(atk,"pow",min,A,D)*0.55+eff(atk,"off",min,A,D)*0.25+eff(atk,"spd",min,A,D)*0.2)*(fx(atk).duelPow||1); thr=TH.cross;
      dSc=(eff(df,"pow",min,D,A)*0.5+eff(df,"def",min,D,A)*0.5)*(fx(df).duelD||1); break;
    default: // dribble / cutin
      aSc=(eff(atk,"off",min,A,D)*0.4+eff(atk,"spd",min,A,D)*0.3+eff(atk,"tec",min,A,D)*0.3)*(fx(atk).duelSpd||fx(atk).duelTec||1); thr=TH.duel;
      dSc=(eff(df,"def",min,D,A)*0.6+eff(df,"spd",min,D,A)*0.4)*(fx(df).duelD||1); break;
  }
  aSc*=A.teamChance*tfA*(bonus||1)*rr();
  dSc*=D.teamDef*tfD*rr();
  return aSc>dSc*thr;
}

// ===== 勝敗判定(純粋関数・DOM/演出/stat更新を持たない) =====
// 中央1対1の勝敗。攻撃側スコア > 守備側スコア×TH.duel で突破。rr()消費順は aSc→dSc(乱数列を保持)。
function resolveDuel(atk,df,type,A,D,min,tfA,tfD,bonus){
  const duelKey="duel"+type[0].toUpperCase()+type.slice(1);
  const aSc=eff(atk,type,min,A,D)*(fx(atk)[duelKey]||1)*A.teamChance*tfA*bonus*rr();
  const dSc=(eff(df,"def",min,D,A)*0.62+eff(df,type,min,D,A)*0.38)*(fx(df).duelD||1)*D.teamDef*tfD*rr();
  return aSc>dSc*TH.duel;
}
// シュート vs GK。得点なら true。rr()消費順は sSc→gSc。
function resolveShot(atk,gk,header,A,D,min){
  const sBase=header
    ?eff(atk,"off",min,A,D)*0.45+eff(atk,"pow",min,A,D)*0.55
    :eff(atk,"off",min,A,D)*0.7+eff(atk,"pow",min,A,D)*0.3;
  const sSc=sBase*(fx(atk).shoot||1)*rr();
  const gSc=eff(gk,"def",min,D,A)*(fx(gk).save||1)*D.teamDef*rr();
  return sSc>gSc*TH.gk;
}
