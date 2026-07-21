// ================= カード描画 =================
// タイトル画面のヒーロー: 固有選手をランダムに1名、大きく表示して魅力を見せる
function renderTitleHero(){
  const el=document.getElementById("titleHero");if(!el)return;
  const list=(typeof SIGNATURES!=="undefined")?SIGNATURES:[];
  const nameEl=document.getElementById("titleHeroName");
  if(!list.length){el.textContent="🎴";return;}
  const c=makeSignature(rnd(list).id);        // 中央ヒーロー(トロフィー位置)にランダム固有選手を大きく表示
  el.innerHTML="";
  el.appendChild(spriteCanvas(c,200));
  if(nameEl)nameEl.innerHTML=`${c.flag} <b>${c.name}</b>`;
}
// 6ステの六角レーダー(背景)。頂点順: OF(上)→DF→PO→TE→SP→ST(時計回り)
function radarSVG(c){
  const order=["off","def","pow","tec","spd","sta"],R=42,C=50;
  const ang=i=>(-90+i*60)*Math.PI/180;
  const P=(i,r)=>[(C+Math.cos(ang(i))*r).toFixed(1),(C+Math.sin(ang(i))*r).toFixed(1)];
  const ring=f=>order.map((_,i)=>P(i,R*f).join(",")).join(" ");
  const spokes=order.map((_,i)=>{const[x,y]=P(i,R);return `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}"/>`;}).join("");
  const vpoly=order.map((k,i)=>P(i,R*Math.max(.08,c[k]/20)).join(",")).join(" ");
  return `<svg class="radarsvg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">`
    +`<g class="rgrid"><polygon points="${ring(1)}"/><polygon points="${ring(.66)}"/><polygon points="${ring(.33)}"/></g>`
    +`<g class="rspoke">${spokes}</g><polygon class="rfill" points="${vpoly}"/></svg>`;
}
function cardEl(c,mini){
  const d=document.createElement("div");
  d.className="card "+c.rar+(c.sig&&!c.emo?" sig":"")+(c.par?" par-"+c.par:"")+(mini?" mini":"");
  if(c.rar==="l"){const nc=natColors(c.flag);d.style.setProperty("--c1",nc[0]);d.style.setProperty("--c2",nc[1]);} // Legend/Signatureは国籍カラー背景
  // エモーショナルはスキル枠で「スキル名 ⇄ モーメント」をクロスフェード表示(専用帯は使わない=視認性改善)
  const sk=c.skill
    ?(c.emo&&c.moment
      ?`<div class="sk emoalt"><span class="ea a">✦${c.skill.name}</span><span class="ea b">${c.moment}</span></div>`
      :`<div class="sk">✦${c.skill.name}</div>`)
    :`<div class="sk" style="opacity:.35">スキルなし</div>`;
  const ovr=c.off+c.def+c.pow+c.tec+c.spd+c.sta;
  const grade=c.emo?"EMOTIONAL":c.sig?"SIGNATURE":RARS[c.rar]; // グレード表記(上中央・★★★★→SIGNATURE)
  const cat=typeFlavor(c).cat||"atk";
  const lab=(cls,k)=>`<div class="rlab ${cls}">${STAT_SHORT[k]}<b class="${c.lb&&c.lb[k]?"lb":(c[k]>=20?"mx":"")}">${c[k]}</b></div>`;
  d.innerHTML=`<div class="chead"><span class="pos ${c.pos}">${c.par==="turbulence"?"ANY":c.sub}</span><span class="cgrade"><span class="rar">${grade}</span></span><span class="cflag">${c.flag}</span></div>
  <div class="tp" style="color:${CAT_COL[cat]}">${typeOf(c).n}</div>
  <div class="radar">${radarSVG(c)}${lab("rl-of","off")}${lab("rl-df","def")}${lab("rl-po","pow")}${lab("rl-te","tec")}${lab("rl-sp","spd")}${lab("rl-st","sta")}<div class="face"></div></div>
  <div class="cinfo"><div class="ovr">OVR<b>${ovr}</b></div><div class="pnm"><span class="pnm-in">${c.name}</span></div>${sk}</div>`;
  d.querySelector(".face").appendChild(spriteCanvas(c,mini?40:50));
  if(c.rar==="sr"||c.rar==="l"||c.rar==="emo"){
    const s1=document.createElement("span");s1.className="spark";s1.textContent="✦";
    s1.style.cssText="top:22%;left:9%";
    const s2=document.createElement("span");s2.className="spark s2";s2.textContent="✦";
    s2.style.cssText="bottom:26%;right:10%";
    d.appendChild(s1);d.appendChild(s2);
    if(c.rar==="l"||c.rar==="emo"){
      const s3=document.createElement("span");s3.className="spark";s3.textContent="✦";
      s3.style.cssText="top:48%;right:6%;animation-delay:.45s";
      d.appendChild(s3);
    }
  }
  d.onclick=()=>{const base=`${c.flag} ${natName(c.flag)}代表・${c.name}(${c.sub})`;toast(c.skill?`${base}|【${c.skill.name}】${c.skill.desc}`:base);};
  return d;
}
// カード背景画像(carddesign)を CSS に適用。tier→対象セレクタ。暗幕+中央ビネットを重ね、
// 明るい素材でも白文字/スプライトの視認性を確保する。素材が無いtierは従来のグラデ背景のまま。
// パラレルは sig の背景(!important)に勝てるよう .card.l.sig.par-* の完全形にする。dangerzone は danger のエイリアス。
const CARD_BG_SEL={emotional:".card.emo", signature:".card.l.sig",
  danger:".card.l.sig.par-danger", dangerzone:".card.l.sig.par-danger",
  turbulence:".card.l.sig.par-turbulence", obsidian:".card.l.sig.par-obsidian",
  legend:".card.l:not(.sig)", sr:".card.sr", rare:".card.r", normal:".card.n"};
function applyCardBackgrounds(){
  if(typeof window==="undefined")return;
  if(window.TOP_BG)document.documentElement.style.setProperty("--top-bg","url("+window.TOP_BG+")"); // タイトル画面の背景イラスト
  if(!window.CARD_BG||document.getElementById("cardBgStyle"))return;
  const scrim="linear-gradient(rgba(6,6,14,.24),rgba(6,6,14,.44)),radial-gradient(ellipse at 50% 46%,rgba(4,4,10,0) 34%,rgba(4,4,10,.34) 100%)";
  let css="";
  Object.keys(window.CARD_BG).forEach(t=>{const sel=CARD_BG_SEL[t],url=window.CARD_BG[t];
    if(!sel||!url)return;
    css+=`${sel}{background:${scrim},url(${url}) center/cover!important}`;
    // 背景画像があるtierは、素のキラ演出(虹オーバーレイ::before/光沢スイープ::after/スパーク)を弱めて下地を見せる
    css+=`${sel}::before{opacity:.25!important}${sel}::after{opacity:.30!important}${sel} .spark{opacity:.55!important}`;});
  if(css){const s=document.createElement("style");s.id="cardBgStyle";s.textContent=css;document.head.appendChild(s);}
}

// ================= 編成 =================
let pickSlot=null;
function total(c){return c.off+c.def+c.pow+c.tec+c.spd+c.sta;}
// 枠に置いた時の実効OVR(ポジション適性pen・キーポジション係数を反映した「計算後」の値)
function slotEffOVR(c,sub,i){
  const pen=posFitOf(c,sub);
  const keyStat=(KEYPOS[S.form]||{})[i];
  const ks=["off","def","pow","tec","spd","sta"];
  let sum=0;
  ks.forEach(k=>{let v=c[k]*pen;if(keyStat===k)v*=KEY_MUL;sum+=v;});
  return Math.round(sum);
}
// 編成スロットが監督の采配条件(KP)に該当するか。全采配(名将=単数tac/カスタム=複数tacs)から
// この枠subに合致する最初のcond[sub,stat,th]を返す(無ければnull)。
function slotTacCond(sub){const am=activeManager();for(const t of mgrTacs(am)){const c=t.cond&&t.cond.find(([cs])=>cs===sub);if(c)return c;}return null;}
// ===== ピッチ盤(スロット)描画 — 通常/育成で共通。ctx で編成データ源を差し替える =====
// ctx: {squad(slot→id), find(id→card), onSlot(i,sub), slotOvr?(c,sub,i), tacCond?(sub)}
function pitchSlots(pitchEl, ctx){
  pitchEl.querySelectorAll(".slot").forEach(e=>e.remove());
  const form=ctx.form||S.form; // ctx.form指定で相手偵察など別フォーメーションも同じ盤で描ける
  const kp=KEYPOS[form]||{}, tacCond=ctx.tacCond||slotTacCond, slotOvr=ctx.slotOvr||slotEffOVR;
  FORMS[form].forEach((sl,i)=>{
    const [sub,x,y]=sl, role=subGroup(sub);
    const d=document.createElement("div");d.className="slot";d.style.left=x+"%";d.style.top=y+"%";
    const key=kp[i]; if(key)d.classList.add("keypos");
    const c=ctx.find(ctx.squad[i]);
    let fitCls="",fitMark="";
    if(c){
      const fit=posFitOf(c,sub);
      if(fit>=POSFIT.exact){fitCls="fit-ok";fitMark='<span class="fitmark">✓</span>';}
      else if(fit>POSFIT.group){fitCls="fit-mild";fitMark=`<span class="fitmark">⚠${c.sub}</span>`;}
      else{fitCls="fit-bad";fitMark=`<span class="fitmark">⚠${c.sub}</span>`;}
    }
    const cc=tacCond(sub);
    const kpTag=cc?`<div class="kptag${c&&c[cc[1]]>=cc[2]?" met":""}">KP ${STAT_SHORT[cc[1]]}${cc[2]}</div>`:"";
    if(cc)d.classList.add("kp");
    const head=`<div class="slothead ${role} ${fitCls}">${sub}${fitMark}</div>`+(key?`<div class="keytag">⭐${STAT_SHORT[key]}+${Math.round((KEY_MUL-1)*100)}%</div>`:"")+kpTag;
    if(c){
      d.classList.add("filled");
      const ovr=slotOvr(c,sub,i);
      d.innerHTML=`${head}<div class="slotsprite"><div class="slotring ${c.rar}"></div></div>
        <div class="slotinfo"><span class="flag">${c.flag}</span><b class="nm">${c.name}</b><span class="ovr">OVR<b>${ovr}</b></span></div>`
        +(ctx.roleBadges?ctx.roleBadges(c.id):"");
      d.querySelector(".slotsprite").appendChild(spriteCanvas(c,40));
    }else{d.classList.add("empty");d.innerHTML=`${head}<div class="slotsprite"><div class="ph">＋</div></div>`;}
    d.onclick=()=>ctx.onSlot(i,sub);
    pitchEl.appendChild(d);
  });
}
// ベンチ(交代枠)描画 — 通常/育成で共通。ctx: {bench[], find, onBench(j)}
function benchSlots(box, ctx){
  if(!Array.isArray(ctx.bench))return;
  box.innerHTML='<div class="lg" style="margin:8px 0 2px">🔁 ベンチ(交代枠) — 試合中の交代はここからのみ</div>';
  const row=document.createElement("div");row.className="bench-row";
  for(let j=0;j<BENCH_SIZE;j++){
    const id=ctx.bench[j], c=(id!=null)&&ctx.find(id);
    const d=document.createElement("div");d.className="bench-slot"+(c?" filled":" empty");
    if(c){d.innerHTML=`<div class="bs-sprite"></div><b class="nm">${c.name}</b><span class="ovr">OVR${total(c)}</span>`;
      d.querySelector(".bs-sprite").appendChild(spriteCanvas(c,34));}
    else d.innerHTML=`<div class="ph">＋</div><span class="bs-lb">控え${j+1}</span>`;
    d.onclick=()=>ctx.onBench(j);
    row.appendChild(d);
  }
  box.appendChild(row);
}
function renderPitch(){
  const p=document.getElementById("pitch");
  document.getElementById("fmName").textContent=S.form;
  const find=id=>S.coll.find(k=>k.id===id);
  const ctxN=roleCtxNormal();
  renderChemLines(p, S.squad, find); // 同国籍の選手を結ぶケミストリー線(スロットより背面)
  pitchSlots(p, {squad:S.squad, find, onSlot:openPicker, slotOvr:slotEffOVR, roleBadges:id=>roleBadges(ctxN,id)});
  // 同国籍ケミストリー表示
  const el=document.getElementById("chemStatus");
  if(el){
    const cnt={};let mx=0,nat=null;
    FORMS[S.form].forEach((sl,i)=>{const c=S.coll.find(k=>k.id===S.squad[i]);if(c){const f=c.flag;cnt[f]=(cnt[f]||0)+1;if(cnt[f]>mx){mx=cnt[f];nat=f;}}});
    const pct=Math.round(Math.min(0.06,Math.max(0,mx-2)*0.012)*100);
    el.innerHTML=mx>=3
      ?`🤝 ケミストリー: ${nat} ${natName(nat)}勢 ${mx}人 → チーム能力 <b style="color:var(--gold)">+${pct}%</b>`
      :`🤝 ケミストリー: 同じ国籍を3人以上揃えるとチーム能力アップ(現在 最多${mx}人)`;
  }
  // 自チームの戦力(平均OVR / 編成OVR / 監督の統制OVR)。統制超過はソフト減衰の警告を表示。
  const ov=document.getElementById("teamOvr");
  if(ov){
    const placed=FORMS[S.form].map((_,i)=>S.coll.find(k=>k.id===S.squad[i])).filter(Boolean);
    if(placed.length){
      const base=placed.reduce((s,c)=>s+total(c),0); // 先発XIのみ(ベンチは統制対象外)
      const avg=Math.round(base/placed.length);
      const mgr=effectiveManager(), cap=mgrCtrlOVR(mgr)+coachCtrlBonus(), mul=ovrOverloadMul(base,cap), over=mul<1, drop=Math.round((1-mul)*100);
      ov.innerHTML=`自チーム 平均OVR <b>${avg}</b> ／ 編成OVR <b style="color:${over?"#ff8e8e":"#7dff9e"}">${base}</b> ／ 🧭統制OVR <b>${cap}</b>`
        +`<span class="ovsub">(${placed.length}/11・XIのみ)</span>`
        +(over?`<br><span style="color:#ff8e8e">⚠ 統制超過 → 全能力 -${drop}%（監督『${mgr.title}』の指揮が追いつかない）</span>`:``);
    }else ov.innerHTML=`自チーム 平均OVR <b>—</b>`;
  }
  renderBenchSlots();
  renderRoleTiles(p, ctxN);
  renderManagerAdvice(document.getElementById("mgrAdvice"), effectiveManager(), ctxN);
  // 編成変更のたびに実績判定(合計OVR1000突破など)。付与があれば保存。
  if(typeof checkAchievements==="function"&&checkAchievements())save();
}
// ベンチ(交代枠): 事前に控えを設定。試合中の交代はここからのみ。
function renderBenchSlots(){
  const box=document.getElementById("benchBox"); if(!box)return;
  if(!Array.isArray(S.bench))S.bench=[];
  benchSlots(box, {bench:S.bench, find:id=>S.coll.find(k=>k.id===id), onBench:openBenchPicker});
}
function openBenchPicker(j){
  document.getElementById("pickTitle").textContent=`ベンチ枠${j+1}に置く控え(タップで配置/もう一度で外す)`;
  const g=document.getElementById("pickGrid");g.innerHTML="";
  const used=Object.values(S.squad).concat(S.bench.filter((_,k)=>k!==j)); // 先発・他ベンチと重複不可
  const cur=S.bench[j];
  S.coll.filter(c=>!used.includes(c.id)).sort((a,b)=>total(b)-total(a)).forEach(c=>{
    const e=cardEl(c);
    if(c.id===cur)e.classList.add("sel");
    e.onclick=async()=>{ if(c.id===cur)S.bench[j]=null; else S.bench[j]=c.id;
      await save();renderPitch();document.getElementById("picker").classList.remove("on"); };
    g.appendChild(e);
  });
  document.getElementById("picker").classList.add("on");
}
// ===== ロール設定(キャプテン / プレースキッカー PK・FK・CK) =====
// 関連ステで最適選手を推奨。captain=6ステ合計 / pk=決定力(off主体) / fk=技術(tec主体) / ck=クロス精度(tec主体)。
function roleScore(c,role){return role==="pk"?(c.off*0.6+c.tec*0.4):role==="fk"?(c.tec*0.6+c.off*0.4):role==="ck"?(c.tec*0.7+c.off*0.3):total(c);}
// ロールの格納先/選手ソースを ctx で抽象化。通常編成=S、キャリア編成=cr を差し替えて同一UIを共有。
function roleCtxNormal(){return {squad:()=>S.squad, find:id=>S.coll.find(k=>k.id===id),
  getCap:()=>S.captain, setCap:id=>{S.captain=id;},
  getKick:r=>(S.kickers||{})[r], setKick:(r,id)=>{(S.kickers=S.kickers||{pk:null,fk:null,ck:null})[r]=id;}, rerender:renderPitch};}
function roleCtxCareer(cr){return {squad:()=>cr.squad||{}, find:id=>careerPool(cr).find(k=>k.id===id),
  getCap:()=>cr.captain, setCap:id=>{cr.captain=id;},
  getKick:r=>(cr.kickers||{})[r], setKick:(r,id)=>{(cr.kickers=cr.kickers||{pk:null,fk:null,ck:null})[r]=id;}, rerender:renderCareer};}
function roleStarters(ctx){const sq=ctx.squad();const form=(ctx&&ctx.form)||S.form;return FORMS[form].map((_,i)=>ctx.find(sq[i])).filter(Boolean);}
// 指定があり出場中ならそのid、無ければ自動(captain=6ステ合計最上位 / キッカーは未指定=その場選出でnull)。
function resolveRoleId(ctx,role){
  const st=roleStarters(ctx); if(!st.length)return null;
  const setId=role==="captain"?ctx.getCap():ctx.getKick(role);
  if(setId&&st.some(c=>c.id===setId))return setId;
  return role==="captain"?st.reduce((b,c)=>total(c)>total(b)?c:b,st[0]).id:null;
}
function roleBadges(ctx,cardId){
  let b=""; if(resolveRoleId(ctx,"captain")===cardId)b+='<span class="rb cap">CAP</span>';
  ["pk","fk","ck"].forEach(r=>{ if(ctx.getKick(r)===cardId)b+=`<span class="rb kick">${r.toUpperCase()}</span>`; });
  return b?`<div class="slotroles">${b}</div>`:"";
}
// フィールド内上部のロール割当タイル(CAP/PK/FK/CK)。タップで各ロールのピッカーを開く。設定結果はスロット隅の徽章で確認。
function renderRoleTiles(pitch,ctx){
  if(!pitch)return;
  const old=pitch.querySelector(".role-tiles"); if(old)old.remove();
  const bar=document.createElement("div"); bar.className="role-tiles";
  const st=roleStarters(ctx);
  [["captain","CAP"],["pk","PK"],["fk","FK"],["ck","CK"]].forEach(([r,lb])=>{
    const setId=r==="captain"?ctx.getCap():ctx.getKick(r);
    const setYes=setId&&st.some(c=>c.id===setId);
    const t=document.createElement("div"); t.className="role-tile"+(setYes?" set":""); t.textContent=lb;
    t.onclick=e=>{e.stopPropagation(); openRolePicker(ctx,r);};
    bar.appendChild(t);
  });
  pitch.appendChild(bar);
}
function openRolePicker(ctx,role){
  const LB={captain:"👑 キャプテン",pk:"⚽ PKキッカー",fk:"🎯 FKキッカー",ck:"🚩 CKキッカー"};
  const HINT={captain:"主将は試合前表記に採用・スタミナ低下が緩和",pk:"出場中ならPKを優先的に担当",fk:"出場中なら直接FK/FKを優先的に担当",ck:"出場中ならCKを優先的に担当"};
  document.getElementById("pickTitle").textContent=`${LB[role]} を選択`;
  const g=document.getElementById("pickGrid");g.innerHTML="";
  const sq=ctx.squad();
  // キッカー(pk/fk/ck)はGKスロットを除外(GKは蹴らない=pickKickerが除外)。キャプテンはGKも選択可。
  let ents=FORMS[S.form].map((sl,i)=>({sub:sl[0],c:ctx.find(sq[i])})).filter(e=>e.c);
  if(role!=="captain")ents=ents.filter(e=>subGroup(e.sub)!=="GK");
  const st=ents.map(e=>e.c).sort((a,b)=>roleScore(b,role)-roleScore(a,role));
  const curId=role==="captain"?ctx.getCap():ctx.getKick(role);
  const hint=document.createElement("div");hint.className="lg";hint.style.cssText="width:100%;margin-bottom:6px";hint.textContent="ℹ "+HINT[role];g.appendChild(hint);
  const auto=document.createElement("div");auto.className="pick-auto"+(!curId?" sel":"");
  auto.innerHTML=`🎲 おまかせ(自動) <span class="lv">${role==="captain"?"最上位を主将に":"その場で最適な選手が蹴る"}</span>`;
  auto.onclick=async()=>{ if(role==="captain")ctx.setCap(null); else ctx.setKick(role,null); await save(); ctx.rerender(); document.getElementById("picker").classList.remove("on"); };
  g.appendChild(auto);
  if(!st.length){const e=document.createElement("div");e.className="lg";e.textContent="先発を配置してください";g.appendChild(e);}
  st.forEach((c,i)=>{
    const wrap=document.createElement("div");wrap.className="pick-role-cell"+(i===0?" recommend":"");
    const e=cardEl(c); if(c.id===curId)e.classList.add("sel");
    e.onclick=async()=>{ if(role==="captain")ctx.setCap(c.id); else ctx.setKick(role,c.id); await save(); ctx.rerender(); document.getElementById("picker").classList.remove("on"); };
    wrap.appendChild(e); g.appendChild(wrap);
  });
  document.getElementById("picker").classList.add("on");
}
// ケミストリー線: 同国籍の選手同士を結ぶ(位置順に鎖状)。最多同国籍=実際にボーナスが出ているグループは
// 強調(シアン実線)、その他の同国籍ペアは控えめ(破線)。最多の選び方は recalcAuras と同じ(スロット順で先に
// 最大数に達した国籍=同数時はスロット順で先のもの)。
function renderChemLines(pitch, squad, find, form){
  if(!document||!document.createElementNS)return; // SVG非対応環境(テスト等)ではケミ線を描かない
  squad=squad||S.squad; find=find||(id=>S.coll.find(k=>k.id===id)); form=form||S.form;
  const old=pitch.querySelector("#chemLines");if(old)old.remove();
  const cnt={},groups={};let mx=0,nat=null;
  FORMS[form].forEach((sl,i)=>{const c=find(squad[i]);if(!c)return;
    const f=c.flag||"?";cnt[f]=(cnt[f]||0)+1;if(cnt[f]>mx){mx=cnt[f];nat=f;}
    (groups[f]=groups[f]||[]).push({x:sl[1],y:sl[2]});});
  const NS="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(NS,"svg");
  svg.id="chemLines";svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("preserveAspectRatio","none");
  // ケミストリー: 最多国籍(3人以上=ボーナス)のみ全ペア相互。効果(人数)で濃さ/太さ可変。
  if(mx>=3&&groups[nat]){
    const pts=groups[nat];
    const bonus=Math.min(0.06,Math.max(0,mx-2)*0.012), ratio=bonus/0.06;
    const op=(0.42+ratio*0.55).toFixed(2), wid=(1.5+ratio*2.2).toFixed(1);
    for(let k=0;k<pts.length;k++)for(let j=k+1;j<pts.length;j++){
      const ln=document.createElementNS(NS,"line");
      ln.setAttribute("x1",pts[k].x);ln.setAttribute("y1",pts[k].y);
      ln.setAttribute("x2",pts[j].x);ln.setAttribute("y2",pts[j].y);
      ln.setAttribute("class","chemln");ln.style.opacity=op;ln.style.strokeWidth=wid;svg.appendChild(ln);
    }
  }
  // 名コンビ(ホットライン): 固有ペアが両方スタメンなら金線で結ぶ
  const sigPos={};
  FORMS[form].forEach((sl,i)=>{const c=find(squad[i]);if(c&&c.sig)sigPos[c.sig]={x:sl[1],y:sl[2]};});
  DUOS.forEach(duo=>{const pa=sigPos[duo.a],pb=sigPos[duo.b];if(!pa||!pb)return;
    const ln=document.createElementNS(NS,"line");
    ln.setAttribute("x1",pa.x);ln.setAttribute("y1",pa.y);ln.setAttribute("x2",pb.x);ln.setAttribute("y2",pb.y);
    ln.setAttribute("class","duoln");svg.appendChild(ln);});
  if(svg.childNodes.length)pitch.appendChild(svg);
}
// 編成左上の監督アドバイス: 全身絵+効果の吹き出し(采配の発動条件と達成状況も提示)。
function squadHasCond(ctx,sub,st,th){const sq=ctx.squad();const form=(ctx&&ctx.form)||S.form;return FORMS[form].some((sl,i)=>{if(sl[0]!==sub)return false;const c=ctx.find(sq[i]);return c&&c[st]>=th;});}
// 監督アドバイス札(全身絵+バフ+采配の発動条件)。通常/キャリアで共通: host(描画先)・m(監督)・ctx(編成ソース)を渡す。
function renderManagerAdvice(host,m,ctx){
  if(!host)return;host.innerHTML="";
  if(!m){host.style.display="none";return;}
  host.style.display="";
  host.appendChild(mgrPortrait(m,86));
  const bub=document.createElement("div");bub.className="mgr-bubble";
  // 監督名を表示(カスタム/見習いは名前のみ・名将は肩書+氏名)。
  const nameLine=(m.custom||m.id==="rookie")?m.name:(m.name?`${m.title}<span class="lv" style="opacity:.8"> ${m.name}</span>`:m.title);
  const bd=mgrBoostDesc(m), hasBuff=bd&&bd!=="ブースト無し";
  // 起用中監督が強化するポジション×能力(バフ)を明示。無バフ(見習い)は入手の導線を案内。
  let html=`<div class="mgr-name">🎯 ${nameLine}</div>`
    +(hasBuff?`<div class="lv">🔼 監督バフ: <b>${bd}</b></div>`
             :`<div class="lv" style="opacity:.7">バフ無し(名将を起用 or キャリアで監督を育成すると強化)</div>`);
  mgrTacs(m).forEach(t=>{ // 全采配(カスタムは複数)を発動条件つきで提示
    const ready=(t.cond||[]).every(([sub,st,th])=>squadHasCond(ctx,sub,st,th));
    const conds=(t.cond||[]).map(([sub,st,th])=>`${sub}の${MGR_STAT_JP[st]||st}${th}`).join("・");
    const condTxt=conds?`: ${conds} ${ready?"✅ 発動可!":"を揃えると発動"}`:" ✅"; // cond無し(相手CPU采配)は常時発動可
    html+=`<div class="mgr-tac${ready?" met":""}">采配「${t.name}」${condTxt}</div>`;
  });
  bub.innerHTML=html;host.appendChild(bub);
}
function openPicker(i,sub){
  pickSlot=i;
  const role=subGroup(sub);
  document.getElementById("pickTitle").textContent=`${sub}(${role})の枠に置くカード(タップで配置/もう一度で外す)`;
  const g=document.getElementById("pickGrid");g.innerHTML="";
  const used=Object.entries(S.squad).filter(([k])=>+k!==i).map(([,v])=>v);
  const cur=S.squad[i];
  S.coll.filter(c=>!used.includes(c.id))
    .sort((a,b)=>posFitOf(b,sub)-posFitOf(a,sub)||total(b)-total(a))
    .forEach(c=>{
      const e=cardEl(c); // 図鑑と同じフルカード(ステ数値が見える=入れ替え比較しやすい)
      if(c.id===cur)e.classList.add("sel");
      e.onclick=async()=>{
        if(c.id===cur)delete S.squad[i];else S.squad[i]=c.id;
        await save();renderPitch();document.getElementById("picker").classList.remove("on");
      };
      g.appendChild(e);
    });
  document.getElementById("picker").classList.add("on");
}
document.getElementById("pickClose").onclick=()=>document.getElementById("picker").classList.remove("on");
function keyPosDesc(f){
  const kp=KEYPOS[f]||{};
  const idxs=Object.keys(kp).map(Number);
  if(!idxs.length)return "";
  const subs=idxs.map(i=>FORMS[f][i][0]);
  const stat=kp[idxs[0]];
  return `⭐${subs.join("/")} ${STAT_SHORT[stat]}+${Math.round((KEY_MUL-1)*100)}%`;
}
// フォーメーション選択(通常/育成 共通)。onPick=選択後の再描画コールバック。
function openFormationPicker(onPick){
  const m=document.getElementById("fmModal"),l=document.getElementById("fmList");l.innerHTML="";
  Object.keys(FORMS).forEach(f=>{
    const b=document.createElement("button");b.className="btn ghost";
    const kd=keyPosDesc(f);
    b.innerHTML=`${f}`+(kd?`<br><span style="font-size:10px;color:#8fa3b8">${kd}</span>`:"");
    b.onclick=async()=>{S.form=f;await save();m.classList.remove("on");(onPick||renderPitch)();};
    l.appendChild(b);
  });
  m.classList.add("on");
}
document.getElementById("fmBtn").onclick=()=>openFormationPicker(renderPitch);
document.getElementById("fmModal").onclick=e=>{if(e.target.id==="fmModal")e.target.classList.remove("on");};
document.getElementById("autoBtn").onclick=async()=>{
  S.squad={};const pool=[...S.coll];
  FORMS[S.form].forEach((sl,i)=>{
    const sub=sl[0],grp=subGroup(sub);
    // ①大区分(FW/MF/DF/GK)一致を最優先 → ②同区分内はOVR優先(細分不一致でも高OVRを上に)
    // → ③同OVRなら細分一致(exact>near>far)をタイブレーク
    pool.sort((a,b)=>
      ((subGroup(b.sub)===grp)-(subGroup(a.sub)===grp))
      || (total(b)-total(a))
      || (posFitOf(b,sub)-posFitOf(a,sub)));
    const c=pool.shift();if(c)S.squad[i]=c.id;
  });
  const starters=new Set(Object.values(S.squad)); // 残りの上位をベンチへ自動補充
  const rest=S.coll.filter(c=>!starters.has(c.id)).sort((a,b)=>total(b)-total(a));
  let benchCards=rest.slice(0,BENCH_SIZE);
  if(!benchCards.some(c=>subGroup(c.sub)==="GK")){ const gk=rest.find(c=>subGroup(c.sub)==="GK"); // 控えGKを1枚確保(GK負傷対策)
    if(gk)benchCards=benchCards.slice(0,BENCH_SIZE-1).concat([gk]); }
  S.bench=benchCards.map(c=>c.id);
  await save();renderPitch();toast("自動編成完了!(ベンチ含む)");
};

// ================= クラブ(所属選手) =================
let collRar="all", collNat="all", collSort="rar"; // フィルタ(レア度/国籍)とソート状態
let _collPage=1; const COLL_PAGE=60; // 図鑑ページネーション(一度に描画する枚数。負荷軽減)
const _rarOrd={emo:-1,l:0,sr:1,r:2,n:3};
function _collSorted(list){
  const a=[...list];
  if(collSort==="ovrDesc")a.sort((x,y)=>total(y)-total(x)||_rarOrd[x.rar]-_rarOrd[y.rar]);
  else if(collSort==="ovrAsc")a.sort((x,y)=>total(x)-total(y)||_rarOrd[x.rar]-_rarOrd[y.rar]);
  else if(collSort==="nat")a.sort((x,y)=>(x.flag<y.flag?-1:x.flag>y.flag?1:0)||_rarOrd[x.rar]-_rarOrd[y.rar]||total(y)-total(x));
  else a.sort((x,y)=>_rarOrd[x.rar]-_rarOrd[y.rar]||total(y)-total(x)); // レア度順(既定)
  return a;
}
function renderColl(){
  const g=document.getElementById("collGrid");g.innerHTML="";
  const natC={},rarC={l:0,sr:0,r:0,n:0};
  S.coll.forEach(c=>{natC[c.flag]=(natC[c.flag]||0)+1;rarC[c.rar]=(rarC[c.rar]||0)+1;});
  if(collNat!=="all"&&!natC[collNat])collNat="all"; // 在庫が無くなったフィルタはリセット
  if(collRar!=="all"&&!rarC[collRar])collRar="all";
  // レア度チップ(全/L/SR/R/N)
  const rb=document.getElementById("collFilter");rb.innerHTML="";
  const chip=(key,label,n)=>{const b=document.createElement("button");b.className="natchip"+(collRar===key?" on":"");
    b.innerHTML=`${label}<span>${n}</span>`;b.onclick=()=>{collRar=key;_collPage=1;renderColl();};rb.appendChild(b);};
  chip("all","全",S.coll.length);[["l","L"],["sr","SR"],["r","R"],["n","N"]].forEach(([k,t])=>chip(k,t,rarC[k]||0));
  // 国籍ドロップダウン + ソート + まとめ売却(国籍は増えても省スペース)
  const ctrl=document.getElementById("collCtrl");ctrl.innerHTML="";
  const mkSel=(opts,cur,on)=>{const s=document.createElement("select");s.className="collsel";
    opts.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;if(v===cur)o.selected=true;s.appendChild(o);});
    s.onchange=()=>on(s.value);return s;};
  const natOpts=[["all",`🌍 全ての国籍 (${S.coll.length})`]].concat(
    Object.keys(natC).sort((a,b)=>natC[b]-natC[a]).map(f=>[f,`${f} ${natName(f)} (${natC[f]})`]));
  ctrl.appendChild(mkSel(natOpts,collNat,v=>{collNat=v;_collPage=1;renderColl();}));
  ctrl.appendChild(mkSel([["rar","↕ レア度順"],["ovrDesc","↕ OVR高い順"],["ovrAsc","↕ OVR低い順"],["nat","↕ 国籍順"]],collSort,v=>{collSort=v;_collPage=1;renderColl();}));
  const list=_collSorted(S.coll.filter(c=>(collRar==="all"||c.rar===collRar)&&(collNat==="all"||c.flag===collNat)));
  const sellable=list.filter(c=>!c.sig&&!inSquad(c)&&c.id!==S.favId); // 固有/編成中/お気に入りは除外
  const tot=sellable.reduce((s,c)=>s+(SELL_VALUE[c.rar]||20),0);
  const sb=document.createElement("button");sb.className="collsell"+(sellable.length?"":" dis");
  sb.textContent=`💰 まとめ売却 ${sellable.length}枚 (🪙${tot})`;
  if(sellable.length)sb.onclick=()=>bulkSell(sellable);
  ctrl.appendChild(sb);
  // ページネーション: 一度に COLL_PAGE 枚まで描画(無限アニメ+canvas大量同時稼働を防ぐ)
  const shown=Math.min(list.length,_collPage*COLL_PAGE);
  document.getElementById("collCount").textContent=`所持 ${S.coll.length}/${COLL_CAP}枚 ・ 表示 ${shown}/${list.length}枚 (タップで詳細)`;
  for(let i=0;i<shown;i++){const c=list[i],el=cardEl(c);el.onclick=()=>openCardModal(c);g.appendChild(el);}
  if(shown<list.length){
    const more=document.createElement("button");more.className="collmore";
    more.textContent=`▼ もっと見る (残り ${list.length-shown}枚)`;
    more.onclick=()=>{_collPage++;renderColl();};
    g.appendChild(more);
  }
}
// まとめ売却: 表示中(フィルタ後)の売却可能カードを一括売却。内訳と合計を確認。
function bulkSell(sellable){
  const by={};sellable.forEach(c=>by[c.rar]=(by[c.rar]||0)+1);
  const bd=["l","sr","r","n"].filter(r=>by[r]).map(r=>`${r.toUpperCase()}×${by[r]}`).join(" / ");
  const tot=sellable.reduce((s,c)=>s+(SELL_VALUE[c.rar]||20),0);
  if(!confirm(`表示中の売却可能 ${sellable.length}枚 (${bd}) を 🪙${tot} で売却します。\n※編成中・お気に入り・固有選手は除外されます。`))return;
  const ids=new Set(sellable.map(c=>c.id));
  S.coll=S.coll.filter(c=>!ids.has(c.id));
  S.coins+=tot;coinUI();save();renderColl();toast(`💰 ${sellable.length}枚を売却! +🪙${tot}`);
}
// ================= カード詳細(売却 / 限界突破) =================
const inSquad=c=>Object.values(S.squad).includes(c.id);
// 限界突破に使える重複(同一シグネ・自分以外・編成外)
function lbDups(c){return c.sig?S.coll.filter(x=>x!==c&&x.sig===c.sig&&!inSquad(x)):[];}
function openCardModal(c){
  const m=document.getElementById("cardModal");
  const body=document.getElementById("cardModalBody");body.innerHTML="";body.appendChild(cardEl(c));
  const acts=document.getElementById("cardModalActions");acts.innerHTML="";
  const info=document.getElementById("cardModalInfo");
  if(c.sig){
    const dups=lbDups(c).length;
    const cur=c.lb&&Object.keys(c.lb)[0];
    const curTxt=cur?` 現在: ${STAT_LABEL[cur]} +${c.lb[cur]}`:"";
    info.innerHTML=`固有選手は<b>重複を消費して限界突破(振り直し)</b>。いずれか1能力を<b>+1〜3</b>に再抽選します(OVRは上がり続けず、配分で個性化)。重複: ${dups}枚${curTxt}`;
    const b=document.createElement("button");b.className="btn"+(dups>0?"":" ghost");
    b.textContent=dups>0?`⭐ 限界突破・振り直し (重複${dups}枚)`:"限界突破(重複なし)";
    if(dups>0)b.onclick=()=>limitBreak(c);
    acts.appendChild(b);
  }else{
    const v=SELL_VALUE[c.rar]||20, sq=inSquad(c);
    info.innerHTML=sq?`この選手は<b>編成中</b>のため売却できません(外してから)。`:`不要なら売却してコインに換えられます。`;
    const b=document.createElement("button");b.className="btn"+(sq?" ghost":"");
    b.textContent=`💰 売却 (🪙${v})`;
    if(!sq)b.onclick=()=>{if(confirm(`${c.name} を 🪙${v} で売却しますか?`))sellCard(c,v);};
    acts.appendChild(b);
  }
  m.classList.add("on");
}
function limitBreak(c){
  const dup=lbDups(c)[0];
  if(!dup){toast("使える重複がありません");return;}
  // 振り直し方式: 既存の限界突破ボーナスを一旦戻してから、いずれか1能力に新たな+1〜3を再抽選。
  // (加算累積でOVRが120へ収束し全選手が没個性化する問題への対策。OVRは「素+1〜3」に留まり配分で差別化)
  if(c.lb){for(const s in c.lb){c[s]-=c.lb[s];}}  // 旧ボーナスを素に戻す(1回目はlb空=戻し無し)
  c.lb={};
  const keys=["off","def","pow","tec","spd","sta"].filter(k=>c[k]<20);
  if(!keys.length){toast("全能力が最大です!");return;}
  const k=rnd(keys), inc=Math.min(20-c[k],ri(1,3));
  c[k]+=inc; c.lb={[k]:inc};
  S.coll.splice(S.coll.indexOf(dup),1);   // 重複を1枚消費(振り直しのたびに消費)
  save();renderColl();openCardModal(c);
  toast(`⭐ 限界突破(振り直し)! ${STAT_LABEL[k]} +${inc} (${c[k]})`);
}
function sellCard(c,v){
  if(inSquad(c)){toast("編成中の選手は売却できません");return;}
  S.coll.splice(S.coll.indexOf(c),1);
  S.coins+=v;coinUI();save();
  document.getElementById("cardModal").classList.remove("on");
  renderColl();toast(`💰 売却! +🪙${v}`);
}
document.getElementById("cardModalClose").onclick=()=>document.getElementById("cardModal").classList.remove("on");

// ================= 監督契約書(監督名・チーム名) =================
// はじめから時は契約書風のイントロ。約款テキストでゲームの遊び方を示し、署名(監督名)で契約成立。
const CONTRACT_TERMS=`第一条  本契約をもって、上記クラブは下記の者を新たな監督として迎え入れる。
第二条  監督は限られた統率の内(統制可能OVR)で最強の11人を編成し、あらゆる大会で栄冠を目指す責を負う。
第三条  選手は「スカウト」により獲得し、育成と采配をもってクラブを勝利へ導くこと。
第四条  「名声」を高めてクラブ施設を拡張し、常勝軍団を築くべし。
以上の条項に同意の上、末尾に署名するものとする。`;
let _pfTitle=""; // プロフィール編集中に選択中の称号(保存でS.titleへ)
function openProfile(isNew){
  const m=document.getElementById("profileModal");
  document.getElementById("profileTitle").textContent=isNew?"監督契約書":"契約内容の変更";
  const sub=document.getElementById("profileSub"); if(sub)sub.textContent=isNew?"MANAGER CONTRACT":"EDIT CONTRACT";
  document.getElementById("pfCoach").value=S.coach||"";
  document.getElementById("pfTeam").value=S.teamName||"";
  const terms=document.getElementById("pfTerms"); if(terms){terms.textContent=isNew?CONTRACT_TERMS:"";terms.style.display=isNew?"":"none";}
  const favWrap=document.getElementById("pfFavWrap"); if(favWrap)favWrap.style.display="none"; // お気に入り設定は廃止
  // 称号セレクタ(獲得済みから1つ選ぶ・ヘッダに表示)。新規契約時や未獲得時は隠す。
  const titWrap=document.getElementById("pfTitleWrap"), titPick=document.getElementById("pfTitlePick");
  const titles=(S.titles||[]);
  if(titWrap&&titPick){
    if(isNew||!titles.length){ titWrap.style.display="none"; _pfTitle=S.title||""; }
    else{
      titWrap.style.display=""; titPick.innerHTML=""; _pfTitle=S.title||"";
      const mk=name=>{ const c=document.createElement("div"); c.className="title-chip"+(_pfTitle===name?" sel":""); c.textContent=name||"称号なし";
        c.onclick=()=>{ _pfTitle=name; titPick.querySelectorAll(".title-chip").forEach(x=>x.classList.remove("sel")); c.classList.add("sel"); }; return c; };
      titPick.appendChild(mk("")); titles.forEach(t=>titPick.appendChild(mk(t))); // 先頭=称号なし
    }
  }
  const sv=document.getElementById("pfSave");sv.textContent=isNew?"✍ 契約する":"保存";
  sv.onclick=()=>saveProfile(isNew);
  m.classList.add("on");
}
async function saveProfile(isNew){
  const coach=(document.getElementById("pfCoach").value||"").trim().slice(0,16)||"名無し監督";
  const team=(document.getElementById("pfTeam").value||"").trim().slice(0,16)||"マイチーム";
  document.getElementById("profileModal").classList.remove("on");
  if(isNew){
    await newGame();                       // 初期デッキ生成(Sをリセット)後に名前を載せる
    S.coach=coach;S.teamName=team;await save();
    coinUI();gotoOffice("ach"); // 契約後は監督室の実績ページへ(秘書が導線を案内)
    if(typeof _gotoChallenge==="function")_gotoChallenge(); // チャレンジURL経由なら監督室の対戦へ上書き
  }else{
    S.coach=coach;S.teamName=team;S.title=_pfTitle||"";await save();
    if(typeof renderHeader==="function")renderHeader(); // 称号バッジをヘッダに即反映
    toast("プロフィールを保存しました");
    if(document.getElementById("scr-home").classList.contains("on"))renderHome();
  }
}
document.getElementById("profileClose").onclick=()=>document.getElementById("profileModal").classList.remove("on");

// ================= 実績(トロフィー) =================
function renderAchievements(){
  const list=document.getElementById("achList");if(!list)return;list.innerHTML="";
  S.ms=S.ms||{};
  const done=ACHIEVEMENTS.filter(a=>S.ms[a.id]).length;
  const cnt=document.getElementById("achCount");
  if(cnt)cnt.textContent=`達成 ${done} / ${ACHIEVEMENTS.length} ・ 固有選手の入手はすべて実績報酬です`;
  ACHIEVEMENTS.forEach(a=>{
    const got=!!S.ms[a.id];
    const d=document.createElement("div");d.className="ach-card"+(got?" got":"");
    let prog="";try{prog=a.prog?a.prog():"";}catch(e){}
    d.innerHTML=`<div class="ach-ico">${got?a.icon:"🔒"}</div>
      <div class="ach-body">
        <div class="ach-title">${a.title}${got?'<span class="ach-badge">達成</span>':''}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-rew">🎁 ${a.rewardLabel}</div>
        ${got?'':`<div class="ach-prog">進捗 ${prog}</div>`}
      </div>`;
    list.appendChild(d);
  });
}

