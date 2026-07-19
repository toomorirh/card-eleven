// ================= 試合の描画・演出(DOM/アニメ) =================
// 俯瞰フィールドの座標変換・選手/ボール移動・カットイン・実況フィード・スキル発動演出。
// 「何が起きるか(match-core)」と「進行(match-flow)」から呼ばれる表示層。
const HOME_KIT=["#1565c0","#ffffff"],AWAY_KIT=["#d32f2f","#ffffff"];

// 実況の side センチネル(不可視制御文字): whoPrefix がプレー文に埋め、feed が判定して除去する。
const FEED_ALLY=String.fromCharCode(1), FEED_OPP=String.fromCharCode(2); // 味方/相手プレーの不可視センチネル
function feed(msg,cls){
  // 色分け: ゴール系=金 > 味方のプレー=青(ally) / 相手のプレー=赤(opp) > その他=白。
  let side="";
  if(typeof msg==="string"){
    if(msg.indexOf(FEED_ALLY)>=0){side="ally";msg=msg.split(FEED_ALLY).join("");}
    else if(msg.indexOf(FEED_OPP)>=0){side="opp";msg=msg.split(FEED_OPP).join("");}
  }
  const c=(cls==="goal")?"goal":side; // ゴール系を最優先(味方/相手のゴールも金)
  const f=document.getElementById("feed");
  const d=document.createElement("div");if(c)d.className=c;d.innerHTML=msg;
  f.appendChild(d);f.scrollTop=f.scrollHeight;
}

// ===== 俯瞰フィールド(動的シミュレーションの可視化) =====
function fieldPos(p){ // フォーメーション定位置(横ピッチ座標)
  if(p.fside==="H")return {x:8+(100-p.y)*0.40, y:10+p.x*0.80};
  return {x:92-(100-p.y)*0.40, y:90-p.x*0.80};
}
const clX=x=>Math.max(3,Math.min(97,x)), clY=y=>Math.max(7,Math.min(93,y));
function toScreen(x,y){ // 内部(攻撃軸x,横y) → 画面(縦ピッチ left,top)
  return {sx:6+y*0.88, sy:97-x*0.94};
}
function setPos(el,x,y,dur){
  const s=toScreen(x,y);
  el.style.transition=`left ${dur}s steps(7,end), top ${dur}s steps(7,end)`;
  el.style.left=s.sx+"%";el.style.top=s.sy+"%";
}
function curP(p){return p.cur||(p.cur=fieldPos(p));}
function movePlayer(p,x,y,dur){
  if(!p.el)return;
  x=clX(x);y=clY(y);p.cur={x,y};setPos(p.el,x,y,dur);
}
async function ballTo(x,y,dur,ease,react){ // ボールを実際に移動(待ち合わせ可能)。react=攻撃側("H"/"A")を渡すと陣形も追従(A案)
  const fb=document.getElementById("fball");
  x=clX(x);y=clY(y);
  const tm=ease==="linear"?"steps(4,end)":"steps(6,end)";
  const s=toScreen(x,y);
  fb.style.transition=`left ${dur}s ${tm}, top ${dur}s ${tm}`;
  fb.style.left=s.sx+"%";fb.style.top=s.sy+"%";
  if(MC){MC.bx=x;MC.by=y;MC.ball=x;}
  if(react)reactField(react===true?null:react,Math.min(dur,0.6)); // ボール移動に合わせて陣形ブロックが追従
  await sleep(dur*1000);
}
const dirOf=T=>T.side==="H"?1:-1;       // 攻める方向
const goalXOf=T=>T.side==="H"?94:6;     // 攻め込む先のゴールx
function buildField(){
  const fv=document.getElementById("fieldview");
  fv.querySelectorAll(".tok").forEach(e=>e.remove());
  const mk=p=>{
    const t=document.createElement("div");t.className="tok";
    const ring=document.createElement("div");ring.className="ring "+p.fside;
    t.appendChild(ring);
    t.appendChild(spriteCanvas(p.c,26));
    fv.appendChild(t);p.el=t;
    p.cur=fieldPos(p);
    setPos(t,p.cur.x,p.cur.y,0);
  };
  MC.home.players.forEach(mk);
  MC.away.players.forEach(mk);
  const fb=document.getElementById("fball");
  const s0=toScreen(50,50);
  fb.style.transition="none";fb.style.left=s0.sx+"%";fb.style.top=s0.sy+"%";
  MC.bx=50;MC.by=50;
}
function laneY(p){return p.fside==="H"?10+p.x*0.80:90-p.x*0.80;}
// 陣形ブロックの目標座標(現在のボール位置に追従)。updateField(ティック単位)/reactField(連鎖中)で共有。
// roamScale=ランダム揺れの倍率(連鎖中は控えめにして滑らかに)。
function blockPos(p,roamScale){
  const M=MC, ty=typeOf(p.c);
  const ballT=p.fside==="H"?M.bx:100-M.bx;        // チーム座標系のボール位置
  const front=Math.min(90,Math.max(45,ballT+16)); // 最前線
  const back=Math.min(58,Math.max(10,ballT-34));  // 最終ライン
  if(p.role==="GK"){
    const xT=Math.min(26,Math.max(5,back-6+ty.adv*0.7)); // スイーパーは高め
    return {x:p.fside==="H"?xT:100-xT, y:50+(M.by-50)*0.3};
  }
  const depth=Math.min(1,Math.max(0,(91-p.y)/73)); // GK=0..FW=1
  const xT=back+depth*(front-back)+ty.adv;
  let y=laneY(p)+(laneY(p)<50?-1:1)*(ty.wide||0)*0.6;
  y+=(M.by-y)*0.12;                                // コンパクトネス
  let x=p.fside==="H"?xT:100-xT;
  const dx=M.bx-x,dy=M.by-y,dist=Math.hypot(dx,dy);
  if(dist<26){const k=(26-dist)/26*ty.chase;x+=dx*k;y+=dy*k;} // 近ければボールへ寄る
  const rs=roamScale==null?1:roamScale;
  x+=(Math.random()*2-1)*ty.roam*rs;
  y+=(Math.random()*2-1)*ty.roam*1.3*rs;
  return {x,y};
}
// C: 攻撃側のオフザボールのラン。高run選手1人がゴール方向へ+ボールの縦位置へ寄せて走り込む(崩しの連動)。
function offBallRun(attSide,dur){
  const M=MC;if(!M||!attSide)return;
  const T=attSide==="H"?M.home:M.away, dir=attSide==="H"?1:-1;
  const near=p=>Math.hypot(curP(p).x-M.bx,curP(p).y-M.by)<12;
  const r=pickW(T.players.filter(p=>p.el&&p.role!=="GK"&&!near(p)),q=>(typeOf(q.c).run||0.2)*ageInv(q));
  if(!r)return;
  const tx=curP(r).x+dir*ri(5,11);
  const ty=curP(r).y+(M.by-curP(r).y)*0.35+ri(-4,4); // ゴール方向へ+ボールの縦へ寄せる
  movePlayer(r,tx,ty,dur||0.55);
}
function updateField(attSide){ // 陣形ブロックがボールに追従して全員が敵陣⇔自陣をスライド(ティック単位)
  const M=MC;if(!M)return;
  [...M.home.players,...M.away.players].forEach(p=>{
    if(!p.el)return;
    const q=blockPos(p,1);movePlayer(p,q.x,q.y,0.7);
  });
  // オフザボールの飛び出し(攻撃側はゴール方向へ+汎用ラン1本)
  offBallRun(attSide,0.55);
  const p=pickW([...M.home.players,...M.away.players].filter(p=>p.el&&p.role!=="GK"),q=>typeOf(q.c).run||0.2);
  if(p){const dir=p.fside==="H"?1:-1;movePlayer(p,curP(p).x+dir*ri(4,9),curP(p).y+ri(-7,7),0.55);}
}
// A: ボール駆動の陣形リアクション。連鎖チェーンの各局面でオフザボールのブロックを現在のボールへ追従させ、
// 「ボールだけが進む」違和感を解消。ボール近傍=関与中の選手は明示アニメを尊重して触らない。
function reactField(attSide,dur){
  const M=MC;if(!M)return;
  dur=dur||0.5;
  const near=p=>Math.hypot(curP(p).x-M.bx,curP(p).y-M.by)<12;
  [...M.home.players,...M.away.players].forEach(p=>{
    if(!p.el)return;
    if(p.role!=="GK"&&near(p))return; // 関与選手(ボール付近)は明示配置を尊重
    const q=blockPos(p,0.6);movePlayer(p,q.x,q.y,dur);
  });
  offBallRun(attSide,dur); // C: 攻撃側ランナーがゴール方向へ走り込む
}
// B: 近い守備者n人をボール(x,y)付近へ収縮させる。抜かれた側は後続の明示move/reactFieldで置き去りに。
function collapseDefenders(D,x,y,n,dur){
  if(!D)return;
  const defs=D.players.filter(p=>p.el&&p.role!=="GK")
    .sort((a,b)=>Math.hypot(curP(a).x-x,curP(a).y-y)-Math.hypot(curP(b).x-x,curP(b).y-y));
  for(let i=0;i<Math.min(n||1,defs.length);i++){
    const p=defs[i], cx=curP(p).x+(x-curP(p).x)*0.5, cy=curP(p).y+(y-curP(p).y)*0.5;
    movePlayer(p,cx+(Math.random()*4-2),cy+(Math.random()*4-2),dur||0.4);
  }
}
async function kickoffReset(){ // ゴール後:全員定位置→センターサークルへ
  if(!MC)return;
  [...MC.home.players,...MC.away.players].forEach(p=>{
    const b=fieldPos(p);movePlayer(p,b.x,b.y,0.8);
  });
  await ballTo(50,50,0.7);
}
function hot(p,ms){
  if(!p||!p.el)return;
  p.el.classList.add("hot");
  setTimeout(()=>p.el&&p.el.classList.remove("hot"),ms||1600);
}

// ===== カットイン =====
// VSカットイン。won(真偽)を渡すと対決後に勝者を発光・敗者を暗転し、中央に決着語を表示
// (won=攻撃側=左の勝ち / !won=守備側=右の勝ち=DF演出)。won未指定なら従来のフェイスオフのみ。
// カットイン背景のチーム識別チント。チーム(.side)/選手(.fside)/側文字列いずれからも判定(味方=home青/相手=away赤)。
function _tint(x){const s=(x&&(x.side||x.fside))||x;return s==="A"?"away":"home";}
async function vsCutin(a,A,d,D,label,won){
  const o=document.createElement("div");o.className="cutin"; // マッチアップは中立色から開始→決着で勝者チームの色
  o.innerHTML=`<div class="band"></div>
   <div class="inner">
    <div class="side l"><div class="fph"></div><div class="fn">${a.c.name}</div><div class="fst">${a.c.skill?"✦"+a.c.skill.name:""}</div></div>
    <div class="ctr"><span class="vsmark">VS</span></div>
    <div class="side r"><div class="fph"></div><div class="fn">${d.c.name}</div><div class="fst">${d.c.skill?"✦"+d.c.skill.name:""}</div></div>
    <div class="cutlabel">${label}</div>
   </div>`;
  const ph=o.querySelectorAll(".fph");
  ph[0].appendChild(spriteCanvas(a.c,92));
  ph[1].appendChild(spriteCanvas(d.c,92));
  document.body.appendChild(o);
  if(typeof won==="boolean"){
    await sleep(560);
    o.classList.add(_tint(won?a:d)); // 決着=勝者チームの色(味方が勝てば青 / 相手が勝てば赤)
    const sides=o.querySelectorAll(".side"), win=sides[won?0:1], lose=sides[won?1:0];
    win.classList.add("win"); lose.classList.add("lose");
    // 決着語/色は勝者のタイプ別フレーバー(攻=突破系暖色 / 守=ブロック系青)
    const fl=typeFlavor((won?a:d).c), cat=won?(fl.cat||"atk"):"def";
    const word=won?(fl.atkWin||"突破!"):(fl.defWin||"STOP!");
    const col=CAT_COL[cat]||CAT_COL.atk;
    const m=document.createElement("span");m.className="vsmark res";m.textContent=word;
    m.style.color=col;m.style.textShadow="0 0 13px "+col+"e0";
    const ctr=o.querySelector(".ctr");ctr.innerHTML="";ctr.appendChild(m);
    await sleep(680);
  }else{
    await sleep(1000);
  }
  o.remove();
}
// 固有選手のスキル発動カットイン(スポットライト/スローモー演出)。
// ゴールの「回転放射光＋シェイク」とは別系統: 画面を暗転させ、選手にスポット光を当て、
// ゆっくりズームしながら技名が静かに浮かぶ。awaitで順次再生し後続の演出へ繋げる。
async function sigCutin(p){
  if(!p||!p.c||!p.c.skill)return;
  const o=document.createElement("div");o.className="sigcut";
  o.innerHTML=`<div class="sigcut-veil"></div><div class="sigcut-spot"></div>
   <div class="sigcut-fig"></div>
   <div class="sigcut-name">✦ ${p.c.skill.name} ✦</div>
   <div class="sigcut-sub">${p.c.flag} ${p.c.name} ・ シグネチャースキル</div>`;
  o.querySelector(".sigcut-fig").appendChild(spriteCanvas(p.c,132));
  document.body.appendChild(o);
  await sleep(1300);o.remove();
}
// エモーショナル(最上位)の“モーメント”カットイン。実写級モチーフ画像を大判ヒーローで使い、
// 虹色ホログラフ+題字でキャリアの一瞬を演出。1試合1回(_emoCut)。
async function emoMoment(p){
  if(!p||!p.c||p._emoCut)return; p._emoCut=true;
  const c=p.c, img=(typeof window!=="undefined"&&window.SIG_IMG&&window.SIG_IMG[c.sig])||"";
  const o=document.createElement("div");o.className="emocut";
  o.innerHTML=`<div class="emocut-rays"></div><div class="emocut-veil"></div>
   <div class="emocut-frame">${img?`<img class="emocut-hero" src="${img}" alt="">`:`<div class="emocut-fig"></div>`}</div>
   <div class="emocut-tag">EMOTIONAL</div>
   <div class="emocut-title">${c.moment||c.skill.name}</div>
   <div class="emocut-sub">${c.flag} ${c.name}${c.momentSub?` ・ ${c.momentSub}`:""}</div>`;
  if(!img)o.querySelector(".emocut-fig").appendChild(spriteCanvas(c,150));
  const w=document.querySelector(".wrap");if(w){w.classList.add("shake");setTimeout(()=>w.classList.remove("shake"),600);}
  document.body.appendChild(o);
  await sleep(1700);o.remove();
}
async function wordCutin(p,T,word,gold,ms,big){
  const o=document.createElement("div");o.className="cutin csc "+_tint(T||p);
  o.innerHTML=`<div class="band"></div>
   <div class="wc-fig"></div>
   <div class="cutword${gold?" gold":""}${big?" big":""}">${word}</div>`;
  o.querySelector(".wc-fig").appendChild(spriteCanvas(p.c,gold?100:84));
  if(gold){
    const r=document.createElement("div");r.className="goalrays"+(big?" big":"");document.body.appendChild(r);
    setTimeout(()=>r.remove(),big?1700:1450);
    const w=document.querySelector(".wrap");if(w){w.classList.add(big?"shake-big":"shake");
      setTimeout(()=>w.classList.remove("shake","shake-big"),big?700:550);}
  }
  document.body.appendChild(o);
  await sleep(ms);o.remove();
}
async function maybeVs(a,A,d,D,label,won){
  if(["sr","l"].includes(a.c.rar)||["sr","l"].includes(d.c.rar)||Math.random()<0.18)await vsCutin(a,A,d,D,label,won);
}
// PK専用カットイン: キッカー vs GK の一騎打ち(緊張のフェイスオフ)。
async function pkCutin(a,d){
  const o=document.createElement("div");o.className="cutin pk "+_tint(a);
  o.innerHTML=`<div class="band"></div>
   <div class="inner">
    <div class="side l"><div class="fph"></div><div class="fn">${a.c.flag} ${a.c.name}</div><div class="fst">キッカー</div></div>
    <div class="ctr"><span class="vsmark pk">PK</span></div>
    <div class="side r"><div class="fph"></div><div class="fn">${d.c.flag} ${d.c.name}</div><div class="fst">守護神</div></div>
    <div class="cutlabel">ペナルティキック</div>
   </div>`;
  const ph=o.querySelectorAll(".fph");ph[0].appendChild(spriteCanvas(a.c,92));ph[1].appendChild(spriteCanvas(d.c,92));
  document.body.appendChild(o);await sleep(1100);o.remove();
}
// セットプレーのカットイン(語句型・縦中央スタック): 蹴る選手の絵+種別名+名前。
async function spCutin(p,title){
  const o=document.createElement("div");o.className="cutin csc "+_tint(p);
  o.innerHTML=`<div class="band"></div>
   <div class="wc-fig"></div>
   <div class="cutword sp">${title}</div>
   <div class="cutlabel">${p.c.flag} ${p.c.name}</div>`;
  o.querySelector(".wc-fig").appendChild(spriteCanvas(p.c,92));
  document.body.appendChild(o);await sleep(950);o.remove();
}
// ===== アクション系カットイン(スピード型) =====
function _actFrame(extraCls,tintSrc){
  const o=document.createElement("div");o.className="cutin act "+extraCls+" "+_tint(tintSrc);
  o.innerHTML='<div class="band"></div><div class="streak"></div>';
  return o;
}
function _afig(card,cls,sz){const d=document.createElement("div");d.className="afig"+(cls?" "+cls:"");d.appendChild(spriteCanvas(card,sz||92));return d;}
function _aword(text,cls){const d=document.createElement("div");d.className="aword"+(cls?" "+cls:"");d.textContent=text;return d;}
// タイプ系統色を語句に乗せる(演出フレーバー)。
function _catColor(el,cat){const col=CAT_COL[cat]||CAT_COL.atk;el.style.color=col;el.style.textShadow="0 0 16px "+col+"cc,0 2px 4px #000";}
// 帯上部に色分けタイプ名タグ(例: ⚔ ドリブラー)。
function _ctag(card){const fl=typeFlavor(card),cat=fl.cat||"atk";
  const d=document.createElement("div");d.className="ctag";d.textContent=(CAT_ICON[cat]||"")+" "+typeOf(card).n;d.style.color=CAT_COL[cat]||CAT_COL.atk;return d;}
// ドリブル/カットイン突破: 選手が左→右へ駆け抜けワイプアウト、突破語句が追従。語句/色はタイプ別。
async function dribbleCutin(p,kind){
  const fl=typeFlavor(p.c),cat=fl.cat||"atk";
  const word=fl[kind]||fl.drive||(kind==="cutin"?"カットイン成功!":"ドリブル突破!");
  const o=_actFrame("drb",p);const w=_aword(word,"ok");_catColor(w,cat);
  o.appendChild(_afig(p.c,"",96));o.appendChild(w);o.appendChild(_ctag(p.c));
  document.body.appendChild(o);await sleep(950);o.remove();
}
// パス成功: 蹴り手+種別が左→左へワイプ→右から成功語(出し手タイプ別)→追って右に受け手。
async function passCutin(kicker,receiver,typeWord){
  const fl=typeFlavor(kicker.c),cat=fl.cat||"mid";
  const o=_actFrame("pass",kicker);const w2=_aword(fl.pass||"パス成功!","w2 ok");_catColor(w2,cat);
  o.appendChild(_afig(kicker.c,"k",92));o.appendChild(_aword(typeWord,"w1"));o.appendChild(w2);
  if(receiver)o.appendChild(_afig(receiver.c,"r",92));
  o.appendChild(_ctag(kicker.c));
  document.body.appendChild(o);await sleep(1250);o.remove();
}
// クロス: 上げ手が左に登場+スピード感。語句/色はタイプ別(ウインガー/攻撃的SBで変化)。
async function crossCutin(p){
  const fl=typeFlavor(p.c),cat=fl.cat||"atk";
  const o=_actFrame("drb",p);const w=_aword(fl.cross||"クロス!","");_catColor(w,cat);
  o.appendChild(_afig(p.c,"",92));o.appendChild(w);o.appendChild(_ctag(p.c));
  document.body.appendChild(o);await sleep(950);o.remove();
}
// トレードマーク(必殺の型)カットイン: 選手が駆け抜け、タイプ系統色の決め技名が走る(通常アクション演出のレア変種)。
async function markCutin(p,word){
  const cat=typeFlavor(p.c).cat||"atk", col=CAT_COL[cat]||CAT_COL.atk;
  const o=_actFrame("drb mark",p);
  const w=_aword(word,"");w.style.color=col;w.style.textShadow="0 0 18px "+col+"e0,0 2px 5px #000";
  o.appendChild(_afig(p.c,"",104));o.appendChild(w);o.appendChild(_ctag(p.c));
  const r=document.createElement("div");r.className="goalrays";document.body.appendChild(r);setTimeout(()=>r.remove(),1100);
  document.body.appendChild(o);await sleep(1050);o.remove();
}
// トレードマーク発動判定。局面atがその選手の型のmark.atに合致し、熱気が十分・低確率で炸裂。
// 発動すれば markCutin を再生し true を返す(呼び出し側は通常のアクション演出をスキップできる)。
async function trademark(p,at){
  if(!p||!p.c)return false;
  const m=typeFlavor(p.c).mark;
  if(!m||m.at!==at)return false;
  if(!MC||(MC.volt||0)<TUNING.mark.volt)return false;
  if(Math.random()>=TUNING.mark.chance)return false;
  await markCutin(p,m.w);
  return true;
}
// 名将の采配シグネ発動カットイン: 監督の全身絵を左に表示→左へスワイプ退場→発動選手(exec)が右から登場。
async function tacCutin(tac,mgr,exec){
  const o=_actFrame("tacx",exec); // 発動選手のside=采配チームの色(味方=青 / 相手=赤)
  if(mgr&&typeof mgrPortrait==="function"){const mf=document.createElement("div");mf.className="afig tm";mf.appendChild(mgrPortrait(mgr,152));o.appendChild(mf);}
  o.appendChild(_aword("🎓 監督の采配!","tw ok"));   // 監督とともに左から中央へ→左へフェードアウト
  o.appendChild(_aword(`✦ ${tac.name} ✦`,"tw2"));    // 起点選手が右から入る時に采配スキル名を表示
  if(exec&&exec.c){const ef=document.createElement("div");ef.className="afig te";ef.appendChild(spriteCanvas(exec.c,108));o.appendChild(ef);}
  const w=document.querySelector(".wrap");if(w){w.classList.add("shake");setTimeout(()=>w.classList.remove("shake"),550);}
  document.body.appendChild(o);await sleep(1300);o.remove();
}
// 名コンビ(ホットライン)発動カットイン: 出し手を左・受け手を右に表示し、中央にコンビ名(金・放射光+強シェイク)。
async function duoCutin(duo,passer,fin,team){
  const o=_actFrame("duo",team||"H"); // 攻撃側でtint(相手の名コンビは赤系)
  o.appendChild(_afig(passer.c,"k",104));      // 出し手=左
  o.appendChild(_afig(fin.c,"r",104));         // 受け手=右
  o.appendChild(_aword("⚡ 名コンビ ⚡","tw"));
  o.appendChild(_aword(`✦ ${duo.name} ✦`,"tw2 ok")); // コンビ名(中央・金)
  const r=document.createElement("div");r.className="goalrays big";document.body.appendChild(r);setTimeout(()=>r.remove(),1500);
  const w=document.querySelector(".wrap");if(w){w.classList.add("shake-big");setTimeout(()=>w.classList.remove("shake-big"),700);}
  document.body.appendChild(o);await sleep(1450);o.remove();
}
// KICK OFF カットイン: 両チームの主将(最高OVR)を左右に、中央に「KICK OFF」。
async function kickoffCutin(hc,ac,awayName){
  const o=document.createElement("div");o.className="cutin";
  o.innerHTML=`<div class="band"></div>
   <div class="inner">
    <div class="side l"><div class="fph"></div><div class="fn">${hc.c.flag} ${hc.c.name}</div><div class="fst">${myName()} 主将</div></div>
    <div class="ctr"><span class="vsmark kickoff">⚽ KICK OFF</span></div>
    <div class="side r"><div class="fph"></div><div class="fn">${ac.c.flag} ${ac.c.name}</div><div class="fst">${awayName} 主将</div></div>
   </div>`;
  const ph=o.querySelectorAll(".fph");ph[0].appendChild(spriteCanvas(hc.c,92));ph[1].appendChild(spriteCanvas(ac.c,92));
  document.body.appendChild(o);await sleep(2300);o.remove();
}
// GAME SET カットイン: 中央に「GAME SET」+最終スコア(縦中央スタック)。
async function gameSetCutin(sh,sa){
  const o=document.createElement("div");o.className="cutin gameset csc";
  o.innerHTML=`<div class="band"></div><div class="cutword">GAME SET</div><div class="cutlabel">${sh} - ${sa}</div>`;
  document.body.appendChild(o);await sleep(1500);o.remove();
}
// 歓声パルス(得点時に画面端が一瞬光る)。
function crowdPulse(){
  const o=document.createElement("div");o.className="crowd";document.body.appendChild(o);
  setTimeout(()=>o.remove(),900);
}
// スコア数字のポップ。
function scorePop(side){
  const el=document.getElementById(side==="H"?"sH":"sA");if(!el)return;
  el.classList.remove("pop");void el.offsetWidth;el.classList.add("pop");
  setTimeout(()=>el&&el.classList.remove("pop"),700);
}

// ===== スキル発動の明示(実況テキスト + 固有カットイン) =====
function skillFeed(p){ // 実況テキストのみ
  if(!p.c.skill)return;
  feed(`✨ スキル発動!【${p.c.skill.name}】${p.c.name}`,"chance");
}
// スキルの系統(色分け用): 守備/支配/攻撃。
function skillCat(fxo){
  if(fxo.save||fxo.duelD||fxo.teamDef||fxo.miracle)return "def";
  if(fxo.mid||fxo.teamChance)return "mid";
  return "atk";
}
// スキル発動時にトークンを系統色で一瞬光らせる(個性の可視化)。
function skillPulse(p){
  if(!p||!p.el)return;const cls="sk-"+skillCat(fx(p));
  p.el.classList.add(cls);setTimeout(()=>p.el&&p.el.classList.remove(cls),900);
}
// ボルテージ・ゲート: 発動「演出」の出やすさ。序盤(volt低)は抑制、熱気が上がると解放。
// ※スキルの効果係数(eff/resolve)は常時適用で不変。ここは演出の表示確率のみ。
function skillShow(){
  const v=(typeof MC!=="undefined"&&MC)?(MC.volt||0):1;
  return Math.random()<Math.min(1,TUNING.volt.gateBase+v);
}
// スキル発動を明示。固有選手は実況もカットインも「1試合1回だけ」(_sigCut で重複防止)。
// 通常スキルは局面ごとに実況(カットインなし)+系統色パルス。ボルテージで表示を抑制。
async function skillHit(p){
  if(!p||!p.c||!p.c.skill)return;
  if(!skillShow())return;          // 序盤など熱気が低い時は発動演出を出さない(係数は別途常時適用)
  if(p.c.emo){                     // エモーショナル: 専用モーメント・カットイン(1試合1回)
    if(p._emoCut)return;
    skillFeed(p);skillPulse(p);
    await emoMoment(p);
    return;
  }
  if(p.c.sig){
    if(p._sigCut)return;            // 2回目以降は実況もカットインも出さない
    p._sigCut=true;
    skillFeed(p);skillPulse(p);
    await sigCutin(p);
    return;
  }
  skillFeed(p);skillPulse(p);
}
// チーム系スキル(teamChance/teamDef/mid)を、意味的に妥当な局面で「発動」として明示する。
// 勝敗ロジックには影響しない演出専用(係数自体は eff/recalcAuras 側で常時掛かっている)。
async function auraSkill(T,key,prob){
  if(!T||Math.random()>=prob)return;
  const hs=T.players.filter(p=>fx(p)[key]);
  if(hs.length)await skillHit(rnd(hs));
}
// 指定fxキーのいずれかを持つ選手のスキルを明示(MFのtec/mid系をビルドアップ/連携で出す)
async function skillAny(p,keys){if(p&&p.c.skill&&keys.some(k=>fx(p)[k]))await skillHit(p);}
