// ================= カード描画 =================
// タイトル画面のヒーロー: 固有選手をランダムに1名、大きく表示して魅力を見せる
function renderTitleHero(){
  const el=document.getElementById("titleHero");if(!el)return;
  const list=(typeof SIGNATURES!=="undefined")?SIGNATURES:[];
  if(!list.length){el.textContent="🎴";return;}
  const c=makeSignature(rnd(list).id);
  el.innerHTML="";
  el.appendChild(spriteCanvas(c,150));
  const cap=document.createElement("div");cap.className="thero-cap";
  cap.innerHTML=`${c.flag} <b>${c.name}</b>`;
  el.appendChild(cap);
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
  d.className="card "+c.rar+(mini?" mini":"");
  // エモーショナルはスキル枠で「スキル名 ⇄ モーメント」をクロスフェード表示(専用帯は使わない=視認性改善)
  const sk=c.skill
    ?(c.emo&&c.moment
      ?`<div class="sk emoalt"><span class="ea a">✦${c.skill.name}</span><span class="ea b">${c.moment}</span></div>`
      :`<div class="sk">✦${c.skill.name}</div>`)
    :`<div class="sk" style="opacity:.35">スキルなし</div>`;
  const ovr=c.off+c.def+c.pow+c.tec+c.spd+c.sta;
  const lab=(cls,k)=>`<div class="rlab ${cls}">${STAT_SHORT[k]}<b class="${c.lb&&c.lb[k]?"lb":(c[k]>=20?"mx":"")}">${c[k]}</b></div>`;
  d.innerHTML=`<div class="chead"><span class="pos ${c.pos}">${c.sub}</span></div>
  <div class="radar">${radarSVG(c)}${lab("rl-of","off")}${lab("rl-df","def")}${lab("rl-po","pow")}${lab("rl-te","tec")}${lab("rl-sp","spd")}${lab("rl-st","sta")}<div class="face"></div></div>
  <div class="cinfo"><div class="pnm">${c.flag} ${c.name}</div><div class="ovr">OVR<b>${ovr}</b><span class="rar">${c.emo?"EMOTIONAL":c.sig?"★★★★":RARS[c.rar]}</span></div><div class="tp">${typeOf(c).n}</div>${sk}</div>`;
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

// ================= 編成 =================
let pickSlot=null;
function total(c){return c.off+c.def+c.pow+c.tec+c.spd+c.sta;}
// 枠に置いた時の実効OVR(ポジション適性pen・キーポジション係数を反映した「計算後」の値)
function slotEffOVR(c,sub,i){
  const pen=posFit(c.sub,sub);
  const keyStat=(KEYPOS[S.form]||{})[i];
  const ks=["off","def","pow","tec","spd","sta"];
  let sum=0;
  ks.forEach(k=>{let v=c[k]*pen;if(keyStat===k)v*=KEY_MUL;sum+=v;});
  return Math.round(sum);
}
// 編成スロットが監督の采配条件(KP)に該当するか。一致したcond[sub,stat,th]を返す(無ければnull)。
function slotTacCond(sub){const am=activeManager();const t=am&&am.tac;return t?t.cond.find(([cs])=>cs===sub)||null:null;}
function renderPitch(){
  const p=document.getElementById("pitch");
  p.querySelectorAll(".slot").forEach(e=>e.remove());
  document.getElementById("fmName").textContent=S.form;
  const kp=KEYPOS[S.form]||{};
  renderChemLines(p); // 同国籍の選手を結ぶケミストリー線(スロットより背面)
  FORMS[S.form].forEach((sl,i)=>{
    const [sub,x,y]=sl;
    const role=subGroup(sub);
    const d=document.createElement("div");d.className="slot";
    d.style.left=x+"%";d.style.top=y+"%";
    const key=kp[i];
    if(key)d.classList.add("keypos");
    const c=S.coll.find(k=>k.id===S.squad[i]);
    let fitCls="",fitMark="";
    if(c){
      const fit=posFit(c.sub,sub);
      if(fit>=POSFIT.exact){fitCls="fit-ok";fitMark='<span class="fitmark">✓</span>';}                 // 完全一致
      else if(fit>POSFIT.group){fitCls="fit-mild";fitMark=`<span class="fitmark">⚠${c.sub}</span>`;}    // 同分類・細分違い(本来の細分を表示)
      else{fitCls="fit-bad";fitMark=`<span class="fitmark">⚠${c.sub}</span>`;}                          // 大分類違い
    }
    const cc=slotTacCond(sub); // 監督の采配KP(該当ポジなら必要ステを表示)
    const kpTag=cc?`<div class="kptag${c&&c[cc[1]]>=cc[2]?" met":""}">KP ${STAT_SHORT[cc[1]]}${cc[2]}</div>`:"";
    if(cc)d.classList.add("kp");
    const head=`<div class="slothead ${role} ${fitCls}">${sub}${fitMark}</div>`+(key?`<div class="keytag">⭐${STAT_SHORT[key]}+${Math.round((KEY_MUL-1)*100)}%</div>`:"")+kpTag;
    if(c){
      d.classList.add("filled");
      const ovr=slotEffOVR(c,sub,i);
      d.innerHTML=`${head}<div class="slotsprite"><div class="slotring ${c.rar}"></div></div>
        <div class="slotinfo"><span class="flag">${c.flag}</span><b class="nm">${c.name}</b><span class="ovr">OVR<b>${ovr}</b></span></div>`;
      d.querySelector(".slotsprite").appendChild(spriteCanvas(c,40));
    }else{d.classList.add("empty");d.innerHTML=`${head}<div class="slotsprite"><div class="ph">＋</div></div>`;}
    d.onclick=()=>openPicker(i,sub);
    p.appendChild(d);
  });
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
  // 自チームの戦力(平均OVR / TOTAL OVR)。配置済みカードの6ステ合計で算出。
  const ov=document.getElementById("teamOvr");
  if(ov){
    const placed=FORMS[S.form].map((_,i)=>S.coll.find(k=>k.id===S.squad[i])).filter(Boolean);
    if(placed.length){
      const tot=placed.reduce((s,c)=>s+total(c),0);
      const avg=Math.round(tot/placed.length);
      ov.innerHTML=`自チーム 平均OVR <b>${avg}</b> ／ TOTAL <b>${tot}</b> <span class="ovsub">(${placed.length}/11人)</span>`;
    }else ov.innerHTML=`自チーム 平均OVR <b>—</b>`;
  }
  renderManagerAdvice();
  // 編成変更のたびに実績判定(合計OVR1000突破など)。付与があれば保存。
  if(typeof checkAchievements==="function"&&checkAchievements())save();
}
// ケミストリー線: 同国籍の選手同士を結ぶ(位置順に鎖状)。最多同国籍=実際にボーナスが出ているグループは
// 強調(シアン実線)、その他の同国籍ペアは控えめ(破線)。最多の選び方は recalcAuras と同じ(スロット順で先に
// 最大数に達した国籍=同数時はスロット順で先のもの)。
function renderChemLines(pitch){
  const old=pitch.querySelector("#chemLines");if(old)old.remove();
  const cnt={},groups={};let mx=0,nat=null;
  FORMS[S.form].forEach((sl,i)=>{const c=S.coll.find(k=>k.id===S.squad[i]);if(!c)return;
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
  FORMS[S.form].forEach((sl,i)=>{const c=S.coll.find(k=>k.id===S.squad[i]);if(c&&c.sig)sigPos[c.sig]={x:sl[1],y:sl[2]};});
  DUOS.forEach(duo=>{const pa=sigPos[duo.a],pb=sigPos[duo.b];if(!pa||!pb)return;
    const ln=document.createElementNS(NS,"line");
    ln.setAttribute("x1",pa.x);ln.setAttribute("y1",pa.y);ln.setAttribute("x2",pb.x);ln.setAttribute("y2",pb.y);
    ln.setAttribute("class","duoln");svg.appendChild(ln);});
  if(svg.childNodes.length)pitch.appendChild(svg);
}
// 編成左上の監督アドバイス: 全身絵+効果の吹き出し(采配の発動条件と達成状況も提示)。
function squadHasCond(sub,st,th){return FORMS[S.form].some((sl,i)=>{if(sl[0]!==sub)return false;const c=S.coll.find(k=>k.id===S.squad[i]);return c&&c[st]>=th;});}
function renderManagerAdvice(){
  const box=document.getElementById("mgrAdvice");if(!box)return;box.innerHTML="";
  const m=activeManager();
  if(!m){box.style.display="none";return;}
  box.style.display="";
  box.appendChild(mgrPortrait(m,86));
  const bub=document.createElement("div");bub.className="mgr-bubble";
  let html=`<div class="mgr-name">🎯 ${m.title}</div>「${mgrBoostDesc(m)}を引き上げろ！」`;
  if(m.tac){
    const ready=m.tac.cond.every(([sub,st,th])=>squadHasCond(sub,st,th));
    const conds=m.tac.cond.map(([sub,st,th])=>`${sub}の${MGR_STAT_JP[st]||st}${th}`).join("・");
    html+=`<div class="mgr-tac${ready?" met":""}">采配「${m.tac.name}」: ${conds} ${ready?"✅ 発動可!":"を揃えると発動"}</div>`;
  }
  bub.innerHTML=html;box.appendChild(bub);
}
function openPicker(i,sub){
  pickSlot=i;
  const role=subGroup(sub);
  document.getElementById("pickTitle").textContent=`${sub}(${role})の枠に置くカード(タップで配置/もう一度で外す)`;
  const g=document.getElementById("pickGrid");g.innerHTML="";
  const used=Object.entries(S.squad).filter(([k])=>+k!==i).map(([,v])=>v);
  const cur=S.squad[i];
  S.coll.filter(c=>!used.includes(c.id))
    .sort((a,b)=>posFit(b.sub,sub)-posFit(a.sub,sub)||total(b)-total(a))
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
document.getElementById("fmBtn").onclick=()=>{
  const m=document.getElementById("fmModal"),l=document.getElementById("fmList");l.innerHTML="";
  Object.keys(FORMS).forEach(f=>{
    const b=document.createElement("button");b.className="btn ghost";
    const kd=keyPosDesc(f);
    b.innerHTML=`${f}`+(kd?`<br><span style="font-size:10px;color:#8fa3b8">${kd}</span>`:"");
    b.onclick=async()=>{S.form=f;await save();m.classList.remove("on");renderPitch();};
    l.appendChild(b);
  });
  m.classList.add("on");
};
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
      || (posFit(b.sub,sub)-posFit(a.sub,sub)));
    const c=pool.shift();if(c)S.squad[i]=c.id;
  });
  await save();renderPitch();toast("自動編成完了!");
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
    info.innerHTML=`固有選手は<b>重複を消費して限界突破</b>できます(20未満の能力を+1〜3・上限20)。重複: ${dups}枚`;
    const b=document.createElement("button");b.className="btn"+(dups>0?"":" ghost");
    b.textContent=dups>0?`⭐ 限界突破 (重複${dups}枚)`:"限界突破(重複なし)";
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
  const keys=["off","def","pow","tec","spd","sta"].filter(k=>c[k]<20);
  if(!keys.length){toast("全能力が最大です!");return;}
  const k=rnd(keys), inc=Math.min(20-c[k],ri(1,3));
  c[k]+=inc; c.lb=c.lb||{}; c.lb[k]=(c.lb[k]||0)+inc;
  S.coll.splice(S.coll.indexOf(dup),1);   // 重複を1枚消費
  save();renderColl();openCardModal(c);
  toast(`⭐ 限界突破! ${STAT_LABEL[k]} +${inc} (${c[k]})`);
}
function sellCard(c,v){
  if(inSquad(c)){toast("編成中の選手は売却できません");return;}
  S.coll.splice(S.coll.indexOf(c),1);
  S.coins+=v;coinUI();save();
  document.getElementById("cardModal").classList.remove("on");
  renderColl();toast(`💰 売却! +🪙${v}`);
}
document.getElementById("cardModalClose").onclick=()=>document.getElementById("cardModal").classList.remove("on");

// ================= プロフィール(監督名・チーム名・お気に入り) =================
let _pfFav=0; // 選択中のお気に入りカードid
function openProfile(isNew){
  const m=document.getElementById("profileModal");
  document.getElementById("profileTitle").textContent=isNew?"チーム設定(はじめに)":"プロフィール編集";
  document.getElementById("pfCoach").value=S.coach||"";
  document.getElementById("pfTeam").value=S.teamName||"";
  _pfFav=S.favId||0;
  const favWrap=document.getElementById("pfFavWrap"),grid=document.getElementById("pfFavGrid");
  if(isNew||!S.coll.length){favWrap.style.display="none";}
  else{
    favWrap.style.display="";grid.innerHTML="";
    const ord={l:0,sr:1,r:2,n:3};
    [...S.coll].sort((a,b)=>ord[a.rar]-ord[b.rar]||total(b)-total(a)).forEach(c=>{
      const el=cardEl(c,true);el._cid=c.id;if(c.id===_pfFav)el.classList.add("sel");
      el.onclick=()=>{_pfFav=(_pfFav===c.id?0:c.id);[...grid.children].forEach(x=>x.classList.toggle("sel",x._cid===_pfFav));};
      grid.appendChild(el);
    });
  }
  const sv=document.getElementById("pfSave");sv.textContent=isNew?"⚽ はじめる":"保存";
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
    coinUI();show("home");
    if(typeof _gotoChallenge==="function")_gotoChallenge(); // チャレンジURL経由ならフレンドへ
  }else{
    S.coach=coach;S.teamName=team;S.favId=_pfFav||0;await save();
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

