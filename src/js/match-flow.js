// ================= 試合進行・攻撃スタイル(オーケストレーション) =================
// 攻撃スタイルは STYLES レジストリにデータ駆動で定義(新スタイル追加=ここに1エントリ)。
// 各 run() は「演出(match-render) + 勝敗判定(match-core の resolve*) + stat更新」を組み合わせるシーケンス。
// 式内のステ配合はスタイル固有なのでインライン(横断的なダイヤルは TUNING)。

const STYLES={
  // 🎯 中央突破: ペナルティエリア手前の得意勝負(spd/pow/tec)→シュート
  center:{label:STYLE_LABEL.center, run:async(A,D,min,m)=>{
    await duel(A,D,min,m.tfA,m.tfD,m.who,1);
  }},
  // 🏃 サイドアタック: ウイング突破(速×技)→クロス→ターゲットのヘディング(力)
  side:{label:STYLE_LABEL.side, run:async(A,D,min,m)=>{
    const {tfA,tfD,who}=m; const dir=dirOf(A),gx=goalXOf(A);
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
      if(fx(w).duelSpd)await skillHit(w);
      const t=pickTarget(A), m2=pickDefender(D);
      t.stat.inv++;m2.stat.inv++;
      const cx2=gx-dir*7, cy2=42+ri(0,16);
      movePlayer(t,cx2-dir*2,cy2,0.4);
      movePlayer(m2,cx2+dir*2,cy2+ri(-4,4),0.4);
      hot(t);hot(m2);
      await ballTo(cx2,cy2,0.4);                    // クロスが中央へ
      const crossM=0.72+eff(w,"tec",min,A,D)/20*0.5;
      const tSc=(eff(t,"pow",min,A,D)*0.55+eff(t,"off",min,A,D)*0.25+eff(t,"spd",min,A,D)*0.2)*(fx(t).duelPow||1)*crossM*rr();
      const mSc=(eff(m2,"pow",min,D,A)*0.5+eff(m2,"def",min,D,A)*0.5)*(fx(m2).duelD||1)*tfD*rr();
      if(tSc>mSc*TH.cross){
        t.stat.duelW++;
        feed(`クロス!中央で<b>${t.c.name}</b>(力${t.c.pow})が${m2.c.name}(力${m2.c.pow})に競り勝った!`,"chance");
        if(fx(t).duelPow)await skillHit(t);
        await tryShot(t,A,D,min,true,cx2,cy2,w);
      }else{
        t.stat.duelL++;m2.stat.duelW++;
        feed(`クロスは${m2.c.name}(力${m2.c.pow})が跳ね返した!`);if(fx(m2).duelD)await skillHit(m2);
        await ballTo(50+dir*6,cy2+ri(-18,18),0.55); // クリア
      }
    }else{
      w.stat.duelL++;d.stat.duelW++;
      feed(`${who}🏃 ${w.c.name}のサイド突破 → ${d.c.name}(守${d.c.def}・速${d.c.spd})が対応!`);if(fx(d).duelD)await skillHit(d);
      await ballTo(50,wy+(wy<50?14:-14),0.5);
    }
  }},
  // 🚀 ロングパス: 後方からのロブ→裏抜けの駆けっこ(速)→GKと1対1
  long:{label:STYLE_LABEL.long, run:async(A,D,min,m)=>{
    const {tfA,tfD,who}=m; const dir=dirOf(A),gx=goalXOf(A);
    const p=pickPasser(A), r=pickTarget(A), cut=pickPress(D);
    p.stat.inv++;r.stat.inv++;cut.stat.inv++;
    await ballTo(curP(p).x,curP(p).y,0.35);          // 後方の起点へ
    const pSc=eff(p,"tec",min,A,D)*tfA*rr();
    const cSc=(eff(cut,"spd",min,D,A)*0.5+eff(cut,"def",min,D,A)*0.5)*tfD*rr();
    hot(p);
    if(pSc>cSc*TH.longPass){
      feed(`${who}🚀 <b>${p.c.name}</b>(技${p.c.tec})が最前線へロングフィード!`,"chance");
      await skillAny(p,["duelTec","mid"]);            // 正確なフィードを通したMFのtec/mid系を明示
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
        if(fx(r).duelSpd)await skillHit(r);
        await tryShot(r,A,D,min,false,null,null,p);
      }else{
        r.stat.duelL++;d.stat.duelW++;
        feed(`${d.c.name}(速${d.c.spd})が先回りしてクリア!`);if(fx(d).duelD)await skillHit(d);
        await ballTo(50,ly+ri(-12,12),0.55);
      }
    }else{
      cut.stat.tkl++;
      feed(`${who}🚀 ロングパスは${cut.c.name}がインターセプト!`);hot(cut);
      await ballTo(curP(cut).x,curP(cut).y,0.4);
    }
  }},
  // 🔄 ショートパス: MF同士のワンツー(技)→連携成立で中央勝負(ボーナス付き)
  short:{label:STYLE_LABEL.short, run:async(A,D,min,m)=>{
    const {tfA,tfD,who}=m; const dir=dirOf(A);
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
      await skillAny(m1,["duelTec","mid"]);await skillAny(m2,["duelTec","mid"]); // 連携を司るMFのtec/mid系を明示
      await duel(A,D,min,tfA,tfD,who,TH.shortBonus);
    }else{
      pr.stat.tkl++;
      feed(`${who}🔄 ${pr.c.name}がパスカット!ショートパスを読まれている`);hot(pr);
      await ballTo(curP(pr).x,curP(pr).y,0.35);
    }
  }},
};
async function attackEvent(A,D,min){
  // tfA/tfDに戦術補正 +「攻撃スタイル × 相手フォーメーション」の相性係数を畳み込む
  const tfA=(A.tactic==="atk"?TUNING.tactic.atk:A.tactic==="def"?TUNING.tactic.def:1)*counterFactor(A.style,D.form);
  const tfD=D.tactic==="def"?TUNING.tactic.atk:D.tactic==="atk"?TUNING.tactic.def:1;
  const who=A.side==="A"?"🔴 ":"";
  await (STYLES[A.style]||STYLES.center).run(A,D,min,{tfA,tfD,who});
}
// 中央1対1(center/short 共用): 演出 → resolveDuel で判定 → 成否の演出/シュート
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
  if(resolveDuel(atk,df,type,A,D,min,tfA,tfD,bonus)){
    atk.stat.duelW++;
    movePlayer(atk,gx-dir*8,ey+(50-ey)*0.25,0.35);
    await ballTo(gx-dir*9,ey+(50-ey)*0.25,0.3);     // 抜き去る
    feed(`${who}${dt.icon} ${dt.label}! <b>${atk.c.name}</b>(${STAT_LABEL[type]}${atk.c[type]}) vs ${df.c.name}(守${df.c.def})…突破!`,"chance");
    if(fx(atk)[duelKey])await skillHit(atk);
    await tryShot(atk,A,D,min,false);
  }else{
    atk.stat.duelL++;df.stat.duelW++;
    feed(`${who}${dt.icon} ${atk.c.name}の${dt.label} → ${df.c.name}(守${df.c.def})が止めた!`);
    if(fx(df).duelD)await skillHit(df);
    await ballTo(ex+dir*9,ey+ri(-8,8),0.5);          // 奪ってクリア
  }
}
// シュート: 演出 → resolveShot で判定 → ゴール/セーブ(奇跡の手は1試合1回失点無効)
async function tryShot(atk,A,D,min,header,fx0,fy0,assist){
  atk.stat.shots++;
  const gk=pickGK(D);
  atk.stat.inv++;gk.stat.inv++;
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
    A.score++;
    atk.stat.goals++;
    if(assist)assist.stat.assists++;
    document.getElementById(A.side==="H"?"sH":"sA").textContent=A.score;
    feed(`⚽ ゴーーール!!<b>${atk.c.name}</b>が${header?"ヘディングで":""}決めた!(${header?"力"+atk.c.pow:"攻"+atk.c.off})`,"goal");
    if(fxA.shoot)await skillHit(atk); // スキルカットイン → GOAL演出へ繋ぐ
    await wordCutin(atk,A,"GOAL!!!",true,1450);
    await kickoffReset();                          // 全員定位置→キックオフ
  }else{
    gk.stat.saves++;
    await ballTo(gx-dir*1,gy,0.22,"linear");
    movePlayer(gk,gx-dir*1,gy,0.18);               // GKが触る
    feed(`GK ${gk.c.name}(守${gk.c.def})がストップ!`);
    if(fxG.save)await skillHit(gk);
    await auraSkill(D,"teamDef",TUNING.aura.teamDef); // 守備陣を統率する teamDef の発動を明示
    await wordCutin(gk,D,"SAVE!!",false,720);
    await ballTo(gx-dir*14,gy+ri(-12,12),0.5);     // 弾き出し
  }
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
  await auraSkill(T,"mid",TUNING.aura.mid); // 中盤を支配した側の mid 系スキル(支配率)の発動を明示
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
  const club=CLUBS[idx], name=club.name, lv=club.lv, form=club.form;
  S.tactic="bal";S.style="center";
  document.querySelectorAll(".tactics [data-t]").forEach(b=>b.classList.toggle("on",b.dataset.t==="bal"));
  document.querySelectorAll("#styleRow [data-st]").forEach(b=>b.classList.toggle("on",b.dataset.st==="center"));
  document.getElementById("mAway").textContent=name;
  document.getElementById("sH").textContent=0;document.getElementById("sA").textContent=0;
  document.getElementById("feed").innerHTML="";document.getElementById("matchEnd").innerHTML="";
  hideStatOverlay();
  document.querySelectorAll(".screen").forEach(x=>x.classList.remove("on"));
  document.getElementById("scr-match").classList.add("on");

  const home=myTeam(),away=oppTeam(lv,club);
  away.style=oppPickStyle(away);
  MC={home,away,min:0,ball:50,bx:50,by:50,idx,name,lv,subs:3,halt:false,loop:false};
  document.getElementById("subN").textContent=3;
  buildField();
  feed(`⚽ キックオフ! vs ${name}(Lv.${lv})`);
  feed(`相手のフォーメーション:【${form}】`);
  if(FORM_DESC[form])feed(`📋 ${FORM_DESC[form]}`,"chance");
  feed(`相手の攻撃スタイル:${STYLE_LABEL[away.style]}`);
  if(home.chemN>=3)feed(`🤝 ${home.chemNat} ${natName(home.chemNat)}勢${home.chemN}人のケミストリー! チーム能力 +${Math.round((home.chem-1)*100)}%`,"chance");
  const srs=away.players.filter(p=>p.c.rar==="sr"||p.c.rar==="l");
  if(srs.length)feed(`⚠ 要注意:相手の${srs.map(p=>p.c.name+"【"+p.c.skill.name+"】").join("、")}`);
  runLoop();
}

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
  const bk=document.createElement("button");bk.className="btn ghost";bk.textContent="ステージへ戻る";
  bk.onclick=()=>{document.querySelector('[data-s="home"]').click();};
  row.appendChild(rt);row.appendChild(bk);
  e.appendChild(row);
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
