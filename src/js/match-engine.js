// ================= 試合エンジン =================
// マッチアップの基本は据え置き(バランス検証済みの数値):
//  支配=中盤の技/速/持、中央=得意勝負、サイド=速技→クロス→力、ロング=技→速の駆けっこ、ショート=技の連携
const TH={duel:1.1,gk:0.88,side:0.9,cross:0.78,longPass:0.95,longRace:1.08,chain:0.92,shortBonus:1.12};
const STYLE_LABEL={center:"🎯中央突破",side:"🏃サイドアタック",long:"🚀ロングパス",short:"🔄ショートパス"};
const HOME_KIT=["#1565c0","#ffffff"],AWAY_KIT=["#d32f2f","#ffffff"];
let MC=null; // 進行中の試合コンテキスト
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fatigue(c,played){
  if(c.skill&&c.skill.fx.iron)return 1;
  return 1-(Math.min(Math.max(played,0),90)/90)*0.35*(1-(c.sta-1)/19);
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
function oppTeam(lv,form){
  form=form||"4-4-2"; // 省略時は従来通り4-4-2(テスト互換)
  const avg=6.6+lv*1.0; // 1選手あたり平均ステ(クラブLv1≈7.6 → Lv8≈14.6)
  const kp=KEYPOS[form]||{};
  const cards=FORMS[form].map((sl,i)=>{
    const a=avg+ri(-1,1);
    const rar=a>=13?"sr":a>=10?"r":"n";
    const c=makeCard(subGroup(sl[0]),rar,null,sl[0]);
    scaleTo(c,a*6); // チームLvに応じて合計を微調整
    return {c,role:subGroup(sl[0]),subRole:sl[0],pen:1,x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  });
  if(lv>=8){ // 最終ボスのエースはレジェンド(陣形のFW枠からランダムに1名)
    const fwIdx=FORMS[form].map((sl,i)=>subGroup(sl[0])==="FW"?i:-1).filter(i=>i>=0);
    const i=fwIdx.length?rnd(fwIdx):FORMS[form].length-1;
    const sb=cards[i].subRole;
    cards[i]={c:makeCard(subGroup(sb),"l",null,sb),role:subGroup(sb),subRole:sb,pen:1,x:cards[i].x,y:cards[i].y,enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  }
  return buildTeam(cards,"A",form);
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
function eff(p,k,min,T,opT){
  const km=p.keyStat===k?(p.keyMul||1):1;
  return p.c[k]*p.pen*fatigue(p.c,min-p.enter)*situ(p,T,opT,min)*(T&&T.chem||1)*km;
}
function fx(p){return p.c.skill?p.c.skill.fx:{};}
function midPower(T,opT,min){
  let m=0;
  T.players.forEach(p=>{
    const w=(p.role==="MF"?1:0.32)*(fx(p).mid||1)*typeOf(p.c).poss;
    m+=(eff(p,"tec",min,T,opT)*0.45+eff(p,"spd",min,T,opT)*0.3+eff(p,"sta",min,T,opT)*0.25)*w;
  });
  const tf=T.tactic==="atk"?1.05:T.tactic==="def"?0.92:1;
  const sf=T.style==="short"?1.06:T.style==="long"?0.94:1;
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
const rr=()=>0.6+Math.random()*0.8;

function feed(msg,cls){
  const f=document.getElementById("feed");
  const d=document.createElement("div");if(cls)d.className=cls;d.innerHTML=msg;
  f.appendChild(d);f.scrollTop=f.scrollHeight;
}
function skillFeed(p){if(p.c.skill)feed(`✨ スキル発動!【${p.c.skill.name}】${p.c.name}`,"chance");}

// ================= 攻撃シーケンス =================
async function maybeVs(a,A,d,D,label){
  if(["sr","l"].includes(a.c.rar)||["sr","l"].includes(d.c.rar)||Math.random()<0.18)await vsCutin(a,A,d,D,label);
}
async function tryShot(atk,A,D,min,header,fx0,fy0,assist){
  atk.stat.shots++;
  const gk=pickGK(D);
  atk.stat.inv++;gk.stat.inv++;
  const fxA=fx(atk),fxG=fx(gk);
  const dir=dirOf(A),gx=goalXOf(A);
  const sx=fx0!=null?fx0:curP(atk).x, sy=fy0!=null?fy0:curP(atk).y;
  const gy=42+ri(0,16);
  movePlayer(atk,sx,sy,0.3);
  movePlayer(gk,gx-dir*2,gy,0.3);     // GKがコースに立つ
  hot(atk);hot(gk);
  await wordCutin(atk,A,header?"ヘディング!!":"シュート!!",false,750);
  const sBase=header
    ?eff(atk,"off",min,A,D)*0.45+eff(atk,"pow",min,A,D)*0.55
    :eff(atk,"off",min,A,D)*0.7+eff(atk,"pow",min,A,D)*0.3;
  const sSc=sBase*(fxA.shoot||1)*rr();
  const gSc=eff(gk,"def",min,D,A)*(fxG.save||1)*D.teamDef*rr();
  if(sSc>gSc*TH.gk){
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
    A.score++;
    atk.stat.goals++;
    if(assist)assist.stat.assists++;
    document.getElementById(A.side==="H"?"sH":"sA").textContent=A.score;
    feed(`⚽ ゴーーール!!<b>${atk.c.name}</b>が${header?"ヘディングで":""}決めた!(${header?"力"+atk.c.pow:"攻"+atk.c.off})`,"goal");
    if(fxA.shoot)skillFeed(atk);
    await wordCutin(atk,A,"GOAL!!!",true,1450);
    await kickoffReset();                          // 全員定位置→キックオフ
  }else{
    gk.stat.saves++;
    await ballTo(gx-dir*1,gy,0.22,"linear");
    movePlayer(gk,gx-dir*1,gy,0.18);               // GKが触る
    feed(`GK ${gk.c.name}(守${gk.c.def})がストップ!`);
    if(fxG.save)skillFeed(gk);
    await wordCutin(gk,D,"SAVE!!",false,720);
    await ballTo(gx-dir*14,gy+ri(-12,12),0.5);     // 弾き出し
  }
}
async function attackEvent(A,D,min){
  // tfAに「攻撃スタイル × 相手フォーメーション」の相性係数を畳み込む(全スタイルの主判定に一律適用)
  const tfA=(A.tactic==="atk"?1.15:A.tactic==="def"?0.85:1)*counterFactor(A.style,D.form);
  const tfD=D.tactic==="def"?1.15:D.tactic==="atk"?0.85:1;
  const who=A.side==="A"?"🔴 ":"";
  const st=A.style;
  const dir=dirOf(A),gx=goalXOf(A);

  if(st==="side"){ // ウイングがタッチライン際を駆け上がる
    const w=pickWide(A), d=pickWideDef(D);
    w.stat.inv++;d.stat.inv++;
    const wy=curP(w).y<50?12:88;
    movePlayer(w,50+dir*16,wy,0.5);
    movePlayer(d,50+dir*24,wy+(wy<50?5:-5),0.5);
    await ballTo(50+dir*14,wy,0.5);                 // サイドへ展開
    hot(w);hot(d);
    await maybeVs(w,A,d,D,"🏃 サイドの仕掛け(速×技)");
    const aSc=(eff(w,"spd",min,A,D)*0.6+eff(w,"tec",min,A,D)*0.4)*(fx(w).duelSpd||1)*A.teamChance*tfA*rr();
    const dSc=(eff(d,"def",min,D,A)*0.55+eff(d,"spd",min,D,A)*0.45)*(fx(d).duelD||1)*D.teamDef*tfD*rr();
    if(aSc>dSc*TH.side){
      w.stat.duelW++;
      movePlayer(w,gx-dir*10,wy,0.45);
      await ballTo(gx-dir*11,wy,0.45);              // 縦に突破
      feed(`${who}🏃 サイド突破!<b>${w.c.name}</b>(速${w.c.spd}・技${w.c.tec})が${d.c.name}を振り切った!`,"chance");
      if(fx(w).duelSpd)skillFeed(w);
      const t=pickTarget(A), m=pickDefender(D);
      t.stat.inv++;m.stat.inv++;
      const cx2=gx-dir*7, cy2=42+ri(0,16);
      movePlayer(t,cx2-dir*2,cy2,0.4);
      movePlayer(m,cx2+dir*2,cy2+ri(-4,4),0.4);
      hot(t);hot(m);
      await ballTo(cx2,cy2,0.4);                    // クロスが中央へ
      const crossM=0.72+eff(w,"tec",min,A,D)/20*0.5;
      const tSc=(eff(t,"pow",min,A,D)*0.55+eff(t,"off",min,A,D)*0.25+eff(t,"spd",min,A,D)*0.2)*(fx(t).duelPow||1)*crossM*rr();
      const mSc=(eff(m,"pow",min,D,A)*0.5+eff(m,"def",min,D,A)*0.5)*(fx(m).duelD||1)*tfD*rr();
      if(tSc>mSc*TH.cross){
        t.stat.duelW++;
        feed(`クロス!中央で<b>${t.c.name}</b>(力${t.c.pow})が${m.c.name}(力${m.c.pow})に競り勝った!`,"chance");
        if(fx(t).duelPow)skillFeed(t);
        await tryShot(t,A,D,min,true,cx2,cy2,w);
      }else{
        t.stat.duelL++;m.stat.duelW++;
        feed(`クロスは${m.c.name}(力${m.c.pow})が跳ね返した!`);if(fx(m).duelD)skillFeed(m);
        await ballTo(50+dir*6,cy2+ri(-18,18),0.55); // クリア
      }
    }else{
      w.stat.duelL++;d.stat.duelW++;
      feed(`${who}🏃 ${w.c.name}のサイド突破 → ${d.c.name}(守${d.c.def}・速${d.c.spd})が対応!`);if(fx(d).duelD)skillFeed(d);
      await ballTo(50,wy+(wy<50?14:-14),0.5);
    }
  }

  else if(st==="long"){ // 後方からのロブが前線へ
    const p=pickPasser(A), r=pickTarget(A), cut=pickPress(D);
    p.stat.inv++;r.stat.inv++;cut.stat.inv++;
    await ballTo(curP(p).x,curP(p).y,0.35);          // 後方の起点へ
    const pSc=eff(p,"tec",min,A,D)*tfA*rr();
    const cSc=(eff(cut,"spd",min,D,A)*0.5+eff(cut,"def",min,D,A)*0.5)*tfD*rr();
    hot(p);
    if(pSc>cSc*TH.longPass){
      feed(`${who}🚀 <b>${p.c.name}</b>(技${p.c.tec})が最前線へロングフィード!`,"chance");
      const d=pickDefender(D);
      d.stat.inv++;
      const lx=gx-dir*18, ly=20+ri(0,60);
      movePlayer(r,lx-dir*2,ly,0.5);
      movePlayer(d,lx+dir*2,ly+ri(-5,5),0.5);
      hot(r);hot(d);
      await ballTo(lx,ly,0.55);                      // ロブが落ちる
      await maybeVs(r,A,d,D,"🚀 DFラインの裏の駆けっこ(速)");
      const aSc=eff(r,"spd",min,A,D)*(fx(r).duelSpd||1)*A.teamChance*tfA*rr();
      const dSc=(eff(d,"spd",min,D,A)*0.55+eff(d,"def",min,D,A)*0.45)*(fx(d).duelD||1)*D.teamDef*tfD*rr();
      if(aSc>dSc*TH.longRace){
        r.stat.duelW++;
        movePlayer(r,gx-dir*8,ly+(50-ly)*0.3,0.35);
        await ballTo(gx-dir*9,ly+(50-ly)*0.3,0.3);   // 裏に抜けた
        feed(`<b>${r.c.name}</b>(速${r.c.spd})が${d.c.name}(速${d.c.spd})を出し抜いて裏へ抜けた!GKと1対1!`,"chance");
        if(fx(r).duelSpd)skillFeed(r);
        await tryShot(r,A,D,min,false,null,null,p);
      }else{
        r.stat.duelL++;d.stat.duelW++;
        feed(`${d.c.name}(速${d.c.spd})が先回りしてクリア!`);if(fx(d).duelD)skillFeed(d);
        await ballTo(50,ly+ri(-12,12),0.55);
      }
    }else{
      cut.stat.tkl++;
      feed(`${who}🚀 ロングパスは${cut.c.name}がインターセプト!`);hot(cut);
      await ballTo(curP(cut).x,curP(cut).y,0.4);
    }
  }

  else if(st==="short"){ // 三角パスで崩す
    const mfs=A.players.filter(p=>p.role==="MF");
    const m1=mfs.length?rnd(mfs):pickAttacker(A);
    let m2=mfs.filter(p=>p!==m1);m2=m2.length?rnd(m2):m1;
    const pr=pickPress(D);
    m1.stat.inv++;m2.stat.inv++;pr.stat.inv++;
    hot(m1);hot(m2);
    await ballTo(curP(m1).x,curP(m1).y,0.3);
    await ballTo(curP(m2).x+dir*3,curP(m2).y,0.3);   // ワンツー
    const chain=((eff(m1,"tec",min,A,D)+eff(m2,"tec",min,A,D))/2)*((fx(m1).mid||1)+(fx(m2).mid||1))/2*tfA*rr();
    const prSc=(eff(pr,"def",min,D,A)*0.5+eff(pr,"spd",min,D,A)*0.5)*tfD*rr();
    if(chain>prSc*TH.chain){
      feed(`${who}🔄 <b>${m1.c.name}</b>→<b>${m2.c.name}</b>(技${m1.c.tec}・${m2.c.tec})、細かいパスワークで崩す!`,"chance");
      await duel(A,D,min,tfA,tfD,who,TH.shortBonus);
    }else{
      pr.stat.tkl++;
      feed(`${who}🔄 ${pr.c.name}がパスカット!ショートパスを読まれている`);hot(pr);
      await ballTo(curP(pr).x,curP(pr).y,0.35);
    }
  }

  else await duel(A,D,min,tfA,tfD,who,1);
}
async function duel(A,D,min,tfA,tfD,who,bonus){
  const atk=pickAttacker(A), df=pickDefender(D);
  atk.stat.inv++;df.stat.inv++;
  const dir=dirOf(A),gx=goalXOf(A);
  const ex=gx-dir*16, ey=30+ri(0,40);   // ペナルティエリア手前で勝負
  movePlayer(atk,ex-dir*3,ey,0.45);
  movePlayer(df,ex+dir*3,ey+ri(-4,4),0.45);
  await ballTo(ex-dir*4,ey,0.45);
  const type=pickW(["spd","pow","tec"],k=>atk.c[k]*atk.c[k]);
  const duelKey="duel"+type[0].toUpperCase()+type.slice(1);
  const dt=DUEL_TYPES[type];
  hot(atk);hot(df);
  await maybeVs(atk,A,df,D,`${dt.icon} ${dt.label}(${STAT_LABEL[type]}${atk.c[type]} vs 守${df.c.def})`);
  const aSc=eff(atk,type,min,A,D)*(fx(atk)[duelKey]||1)*A.teamChance*tfA*bonus*rr();
  const dSc=(eff(df,"def",min,D,A)*0.62+eff(df,type,min,D,A)*0.38)*(fx(df).duelD||1)*D.teamDef*tfD*rr();
  if(aSc>dSc*TH.duel){
    atk.stat.duelW++;
    movePlayer(atk,gx-dir*8,ey+(50-ey)*0.25,0.35);
    await ballTo(gx-dir*9,ey+(50-ey)*0.25,0.3);     // 抜き去る
    feed(`${who}${dt.icon} ${dt.label}! <b>${atk.c.name}</b>(${STAT_LABEL[type]}${atk.c[type]}) vs ${df.c.name}(守${df.c.def})…突破!`,"chance");
    if(fx(atk)[duelKey])skillFeed(atk);
    await tryShot(atk,A,D,min,false);
  }else{
    atk.stat.duelL++;df.stat.duelW++;
    feed(`${who}${dt.icon} ${atk.c.name}の${dt.label} → ${df.c.name}(守${df.c.def})が止めた!`);
    if(fx(df).duelD)skillFeed(df);
    await ballTo(ex+dir*9,ey+ri(-8,8),0.5);          // 奪ってクリア
  }
}
