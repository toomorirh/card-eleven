// ================= 俯瞰フィールド(動的シミュレーション) =================
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
// ================= カットイン =================
async function vsCutin(a,A,d,D,label){
  const o=document.createElement("div");o.className="cutin";
  o.innerHTML=`<div class="band"></div>
   <div class="inner">
    <div class="fighter fromL"><div class="fph"></div><div class="fn">${a.c.name}</div><div class="fst">${a.c.skill?"✦"+a.c.skill.name:""}</div></div>
    <div class="vsmark">VS</div>
    <div class="fighter fromR"><div class="fph"></div><div class="fn">${d.c.name}</div><div class="fst">${d.c.skill?"✦"+d.c.skill.name:""}</div></div>
   </div><div class="cutlabel">${label}</div>`;
  const ph=o.querySelectorAll(".fph");
  ph[0].appendChild(spriteCanvas(a.c,92));
  ph[1].appendChild(spriteCanvas(d.c,92));
  document.body.appendChild(o);
  await sleep(1000);o.remove();
}
async function wordCutin(p,T,word,gold,ms){
  const o=document.createElement("div");o.className="cutin";
  o.innerHTML=`<div class="band"></div>
   <div class="inner"><div class="fighter fromL"><div class="fph"></div><div class="fn">${p.c.name}</div></div>
   <div class="cutword${gold?" gold":""}">${word}</div></div>`;
  o.querySelector(".fph").appendChild(spriteCanvas(p.c,gold?100:84));
  if(gold){
    const r=document.createElement("div");r.className="goalrays";document.body.appendChild(r);
    setTimeout(()=>r.remove(),1450);
    document.querySelector(".wrap").classList.add("shake");
    setTimeout(()=>document.querySelector(".wrap").classList.remove("shake"),550);
  }
  document.body.appendChild(o);
  await sleep(ms);o.remove();
}

// ================= 試合進行(非同期ループ) =================
async function tickAsync(){
  const M=MC;
  M.min+=3;
  document.getElementById("clock").textContent=(M.min>=90?"90+":M.min)+"分";
  M.home.tactic=S.tactic;M.home.style=S.style;
  if(M.min===60){
    M.away.tactic=M.away.score<M.home.score?"atk":M.away.score>M.home.score?"def":"bal";
    if(M.away.tactic==="atk")feed(`${M.name}がカードを前に動かしてきた!攻勢だ!`);
  }
  const mh=midPower(M.home,M.away,M.min),ma=midPower(M.away,M.home,M.min);
  let homeAtt=Math.random()<mh/(mh+ma);
  if(!homeAtt&&M.home.style==="long"&&Math.random()<0.22){homeAtt=true;feed("素早い切り替えからロングカウンター!","chance");}
  if(homeAtt&&M.away.style==="long"&&Math.random()<0.22){homeAtt=false;feed("🔴 相手のロングカウンター!","chance");}
  const T=homeAtt?M.home:M.away;
  const dir=dirOf(T);
  // ビルドアップ:保持側の選手へパス
  const c1=pickW(T.players.filter(p=>p.role!=="GK"),p=>p.role==="MF"?2:p.role==="DF"?1:1.4);
  c1.stat.inv++;
  await ballTo(curP(c1).x+dir*2,curP(c1).y,0.4);
  updateField();
  if(Math.random()<0.5){
    await attackEvent(T, homeAtt?M.away:M.home, M.min);
  }else{
    const mates=T.players.filter(p=>p!==c1&&p.role!=="GK");
    const c2=pickW(mates,p=>1+(dir>0?curP(p).x:100-curP(p).x)/50); // 前の選手ほど受けやすい
    c2.stat.inv++;
    await ballTo(curP(c2).x+dir*2,curP(c2).y,0.45);
    if(Math.random()<0.45)feed(["中盤で激しいボールの奪い合い","じっくりとパスを回す","ラインを押し上げていく","セカンドボールを拾った"][ri(0,3)]);
  }
}
async function runLoop(){
  if(!MC||MC.loop)return;
  MC.loop=true;
  while(MC&&!MC.halt&&MC.min<90){
    await tickAsync();
    if(!MC||MC.halt)break;
    await sleep(420);
  }
  if(MC){
    MC.loop=false;
    if(MC.min>=90&&!MC.halt)await endMatch();
  }
}
function startLeagueMatch(idx,name){
  S._leagueMatch=true;
  startMatch(idx);
}
function startMatch(idx){
  const filled=FORMS[S.form].filter((_,i)=>S.squad[i]!=null).length;
  if(filled<11){toast(`スタメンが${filled}/11人です!編成画面で揃えよう`);
    document.querySelector('[data-s="team"]').click();return;}
  const [name,lv,form]=CLUBS[idx];
  S.tactic="bal";S.style="center";
  document.querySelectorAll(".tactics [data-t]").forEach(b=>b.classList.toggle("on",b.dataset.t==="bal"));
  document.querySelectorAll("#styleRow [data-st]").forEach(b=>b.classList.toggle("on",b.dataset.st==="center"));
  document.getElementById("mAway").textContent=name;
  document.getElementById("sH").textContent=0;document.getElementById("sA").textContent=0;
  document.getElementById("feed").innerHTML="";document.getElementById("matchEnd").innerHTML="";
  hideStatOverlay();
  document.querySelectorAll(".screen").forEach(x=>x.classList.remove("on"));
  document.getElementById("scr-match").classList.add("on");

  const home=myTeam(),away=oppTeam(lv,form);
  away.style=oppPickStyle(away);
  MC={home,away,min:0,ball:50,bx:50,by:50,idx,name,lv,subs:3,halt:false,loop:false};
  document.getElementById("subN").textContent=3;
  buildField();
  feed(`⚽ キックオフ! vs ${name}(Lv.${lv})`);
  feed(`相手のフォーメーション:【${form}】`);
  feed(`相手の戦術:${STYLE_LABEL[away.style]}`);
  const ctr=FORM_COUNTER[form];
  if(ctr)feed(`💡 この陣形には ${STYLE_LABEL[ctr.best]} が有効(+${Math.round((COUNTER_BONUS-1)*100)}%) / ${STYLE_LABEL[ctr.worst]} は通じにくい(−${Math.round((1-COUNTER_PENALTY)*100)}%)`,"chance");
  if(home.chemN>=3)feed(`🤝 ${home.chemNat} ${natName(home.chemNat)}勢${home.chemN}人のケミストリー! チーム能力 +${Math.round((home.chem-1)*100)}%`,"chance");
  const srs=away.players.filter(p=>p.c.rar==="sr"||p.c.rar==="l");
  if(srs.length)feed(`⚠ 要注意:相手の${srs.map(p=>p.c.name+"【"+p.c.skill.name+"】").join("、")}`);
  runLoop();
}
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
async function endMatch(){
  const M=MC,lv=M.lv,sh=M.home.score,sa=M.away.score;
  if(S._leagueMatch){
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
    await save();MC=null;return;
  }
  let msg,reward;
  if(sh>sa){msg="🏆 勝利!!";reward=100+lv*40;if(M.idx===S.cleared)S.cleared++;}
  else if(sh===sa){msg="🤝 引き分け";reward=50;}
  else{msg="😢 敗北…";reward=30;}
  S.coins+=reward;coinUI();
  feed(`試合終了 ${sh}-${sa} ${msg} 報酬🪙${reward}`,"goal");
  const dropP=sh>sa?0.18:sh===sa?0.08:0.04;
  let dropMsg="";
  if(Math.random()<dropP){
    S.legendPacks=(S.legendPacks||0)+1;
    dropMsg=`<div class="banner" style="font-size:15px;color:#7dff9e">🎁 レジェンドパックを手に入れた!!</div>`;
    feed("🎁 レジェンドパックを手に入れた!!ガチャ画面で開封できる","goal");
  }
  const e=document.getElementById("matchEnd");
  e.innerHTML=`<div class="banner">${msg}</div>`+dropMsg;
  showStatOverlay(M.home,M.away);
  const b=document.createElement("button");b.className="btn";b.textContent="リーグに戻る";
  b.onclick=()=>{document.querySelector('[data-s="home"]').click();};
  e.appendChild(b);
  MC=null;
  await save();
}
document.querySelectorAll(".tactics [data-t]").forEach(b=>b.onclick=()=>{
  S.tactic=b.dataset.t;
  document.querySelectorAll(".tactics [data-t]").forEach(x=>x.classList.toggle("on",x===b));
  if(MC)feed(b.dataset.t==="atk"?"⚔️ カードを前に動かした!総攻撃!":b.dataset.t==="def"?"🛡️ ラインを下げて守備固め!":"⚖️ バランス重視に戻した");
});
document.querySelectorAll("#styleRow [data-st]").forEach(b=>b.onclick=()=>{
  S.style=b.dataset.st;
  document.querySelectorAll("#styleRow [data-st]").forEach(x=>x.classList.toggle("on",x===b));
  if(MC)feed(`📣 攻撃スタイル変更 → ${STYLE_LABEL[S.style]}`);
});

// ================= 途中交代 =================
document.getElementById("subBtn").onclick=()=>{
  if(!MC){toast("試合中のみ交代できます");return;}
  if(MC.subs<=0){toast("交代枠を使い切りました");return;}
  MC.halt=true; // ループは次のティック前に停止
  renderSubList();
  document.getElementById("subModal").classList.add("on");
};
function fatClass(v){return v<20?"ok":v<40?"mid":"bad";}
function renderSubList(){
  const l=document.getElementById("subList");l.innerHTML="";l.style.display="block";
  document.getElementById("subBench").style.display="none";
  document.getElementById("subTitle").textContent="OUTする選手を選択(試合は一時停止中)";
  MC.home.players.forEach((p,pi)=>{
    const tired=Math.round((1-fatigue(p.c,MC.min-p.enter))*100);
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
  const bench=S.coll.filter(c=>!onField.includes(c.id))
    .sort((a,b)=>posFit(b.sub,out.subRole)-posFit(a.sub,out.subRole)||total(b)-total(a));
  if(!bench.length){toast("ベンチに選手がいません!ガチャで増やそう");return;}
  document.getElementById("subTitle").textContent=`INする選手を選択(OUT: ${out.c.name} / 枠は${out.subRole||out.role})`;
  document.getElementById("subList").style.display="none";
  const g=document.getElementById("subBench");g.style.display="flex";g.innerHTML="";
  bench.forEach(c=>{
    const e=cardEl(c,true);
    e.onclick=()=>{
      const np={c,role:out.role,subRole:out.subRole,pen:posFit(c.sub,out.subRole),x:out.x,y:out.y,enter:MC.min,fside:"H",el:out.el,cur:out.cur,
        stat:{shots:0,goals:0,assists:0,duelW:0,duelL:0,tkl:0,saves:0},
        keyStat:out.keyStat||null,keyMul:out.keyMul||1};
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
