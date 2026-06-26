// ================= 試合の描画・演出(DOM/アニメ) =================
// 俯瞰フィールドの座標変換・選手/ボール移動・カットイン・実況フィード・スキル発動演出。
// 「何が起きるか(match-core)」と「進行(match-flow)」から呼ばれる表示層。
const HOME_KIT=["#1565c0","#ffffff"],AWAY_KIT=["#d32f2f","#ffffff"];

function feed(msg,cls){
  const f=document.getElementById("feed");
  const d=document.createElement("div");if(cls)d.className=cls;d.innerHTML=msg;
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
async function ballTo(x,y,dur,ease){ // ボールを実際に移動(待ち合わせ可能)
  const fb=document.getElementById("fball");
  x=clX(x);y=clY(y);
  const tm=ease==="linear"?"steps(4,end)":"steps(6,end)";
  const s=toScreen(x,y);
  fb.style.transition=`left ${dur}s ${tm}, top ${dur}s ${tm}`;
  fb.style.left=s.sx+"%";fb.style.top=s.sy+"%";
  if(MC){MC.bx=x;MC.by=y;MC.ball=x;}
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
function updateField(){ // 陣形ブロックがボールに追従して全員が敵陣⇔自陣をスライド
  const M=MC;if(!M)return;
  [...M.home.players,...M.away.players].forEach(p=>{
    if(!p.el)return;
    const ty=typeOf(p.c);
    const ballT=p.fside==="H"?M.bx:100-M.bx;        // チーム座標系のボール位置
    const front=Math.min(90,Math.max(45,ballT+16)); // 最前線
    const back=Math.min(58,Math.max(10,ballT-34));  // 最終ライン
    let xT,y;
    if(p.role==="GK"){
      xT=Math.min(26,Math.max(5,back-6+ty.adv*0.7)); // スイーパーは高め
      y=50+(M.by-50)*0.3;
    }else{
      const depth=Math.min(1,Math.max(0,(91-p.y)/73)); // GK=0..FW=1
      xT=back+depth*(front-back)+ty.adv;
      y=laneY(p)+(laneY(p)<50?-1:1)*(ty.wide||0)*0.6;
      y+=(M.by-y)*0.12;                                // コンパクトネス
    }
    let x=p.fside==="H"?xT:100-xT;
    if(p.role!=="GK"){
      const dx=M.bx-x,dy=M.by-y,dist=Math.hypot(dx,dy);
      if(dist<26){const k=(26-dist)/26*ty.chase;x+=dx*k;y+=dy*k;}
      x+=(Math.random()*2-1)*ty.roam;
      y+=(Math.random()*2-1)*ty.roam*1.3;
    }
    movePlayer(p,x,y,0.7);
  });
  // オフザボールの飛び出し
  const all=[...M.home.players,...M.away.players].filter(p=>p.el&&p.role!=="GK");
  for(let k=0;k<2;k++){
    const p=pickW(all,q=>typeOf(q.c).run||0.2);
    if(!p)continue;
    const dir=p.fside==="H"?1:-1;
    movePlayer(p,curP(p).x+dir*ri(4,9),curP(p).y+ri(-7,7),0.55);
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
async function vsCutin(a,A,d,D,label,won){
  const o=document.createElement("div");o.className="cutin";
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
async function wordCutin(p,T,word,gold,ms,big){
  const o=document.createElement("div");o.className="cutin csc";
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
  const o=document.createElement("div");o.className="cutin pk";
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
  const o=document.createElement("div");o.className="cutin csc";
  o.innerHTML=`<div class="band"></div>
   <div class="wc-fig"></div>
   <div class="cutword sp">${title}</div>
   <div class="cutlabel">${p.c.flag} ${p.c.name}</div>`;
  o.querySelector(".wc-fig").appendChild(spriteCanvas(p.c,92));
  document.body.appendChild(o);await sleep(950);o.remove();
}
// ===== アクション系カットイン(スピード型) =====
function _actFrame(extraCls){
  const o=document.createElement("div");o.className="cutin act "+extraCls;
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
  const o=_actFrame("drb");const w=_aword(word,"ok");_catColor(w,cat);
  o.appendChild(_afig(p.c,"",96));o.appendChild(w);o.appendChild(_ctag(p.c));
  document.body.appendChild(o);await sleep(950);o.remove();
}
// パス成功: 蹴り手+種別が左→左へワイプ→右から成功語(出し手タイプ別)→追って右に受け手。
async function passCutin(kicker,receiver,typeWord){
  const fl=typeFlavor(kicker.c),cat=fl.cat||"mid";
  const o=_actFrame("pass");const w2=_aword(fl.pass||"パス成功!","w2 ok");_catColor(w2,cat);
  o.appendChild(_afig(kicker.c,"k",92));o.appendChild(_aword(typeWord,"w1"));o.appendChild(w2);
  if(receiver)o.appendChild(_afig(receiver.c,"r",92));
  o.appendChild(_ctag(kicker.c));
  document.body.appendChild(o);await sleep(1250);o.remove();
}
// クロス: 上げ手が左に登場+スピード感。語句/色はタイプ別(ウインガー/攻撃的SBで変化)。
async function crossCutin(p){
  const fl=typeFlavor(p.c),cat=fl.cat||"atk";
  const o=_actFrame("drb");const w=_aword(fl.cross||"クロス!","");_catColor(w,cat);
  o.appendChild(_afig(p.c,"",92));o.appendChild(w);o.appendChild(_ctag(p.c));
  document.body.appendChild(o);await sleep(950);o.remove();
}
// 名将の采配シグネ発動カットイン: 監督の全身絵を左に表示→左へスワイプ退場→発動選手(exec)が右から登場。
async function tacCutin(tac,mgr,exec){
  const o=_actFrame("tacx");
  if(mgr&&typeof mgrPortrait==="function"){const mf=document.createElement("div");mf.className="afig tm";mf.appendChild(mgrPortrait(mgr,152));o.appendChild(mf);}
  o.appendChild(_aword("🎓 監督の采配!","tw ok"));
  o.appendChild(_aword(`【${tac.name}】${mgr?mgr.title:""}`,"tw2"));
  if(exec&&exec.c){const ef=document.createElement("div");ef.className="afig te";ef.appendChild(spriteCanvas(exec.c,108));o.appendChild(ef);}
  const w=document.querySelector(".wrap");if(w){w.classList.add("shake");setTimeout(()=>w.classList.remove("shake"),550);}
  document.body.appendChild(o);await sleep(1300);o.remove();
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
