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
  const sk=c.skill?`<div class="sk">✦${c.skill.name}</div>`:`<div class="sk" style="opacity:.35">スキルなし</div>`;
  const ovr=c.off+c.def+c.pow+c.tec+c.spd+c.sta;
  const lab=(cls,k)=>`<div class="rlab ${cls}">${STAT_SHORT[k]}<b class="${c.lb&&c.lb[k]?"lb":(c[k]>=20?"mx":"")}">${c[k]}</b></div>`;
  d.innerHTML=`<div class="chead"><span class="pos ${c.pos}">${c.sub}</span></div>
  <div class="radar">${radarSVG(c)}${lab("rl-of","off")}${lab("rl-df","def")}${lab("rl-po","pow")}${lab("rl-te","tec")}${lab("rl-sp","spd")}${lab("rl-st","sta")}<div class="face"></div></div>
  <div class="cinfo"><div class="pnm">${c.flag} ${c.name}</div><div class="ovr">OVR<b>${ovr}</b><span class="rar">${c.sig?"★★★★":RARS[c.rar]}</span></div><div class="tp">${typeOf(c).n}</div>${sk}</div>`;
  d.querySelector(".face").appendChild(spriteCanvas(c,mini?40:50));
  if(c.rar==="sr"||c.rar==="l"){
    const s1=document.createElement("span");s1.className="spark";s1.textContent="✦";
    s1.style.cssText="top:22%;left:9%";
    const s2=document.createElement("span");s2.className="spark s2";s2.textContent="✦";
    s2.style.cssText="bottom:26%;right:10%";
    d.appendChild(s1);d.appendChild(s2);
    if(c.rar==="l"){
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
function renderPitch(){
  const p=document.getElementById("pitch");
  p.querySelectorAll(".slot").forEach(e=>e.remove());
  document.getElementById("fmName").textContent=S.form;
  const kp=KEYPOS[S.form]||{};
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
    const head=`<div class="slothead ${role} ${fitCls}">${sub}${fitMark}</div>`+(key?`<div class="keytag">⭐${STAT_SHORT[key]}+${Math.round((KEY_MUL-1)*100)}%</div>`:"");
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
  // 編成変更のたびに実績判定(合計OVR1000突破など)。付与があれば保存。
  if(typeof checkAchievements==="function"&&checkAchievements())save();
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
    const sub=sl[0];
    pool.sort((a,b)=>posFit(b.sub,sub)-posFit(a.sub,sub)||total(b)-total(a));
    const c=pool.shift();if(c)S.squad[i]=c.id;
  });
  await save();renderPitch();toast("おまかせ編成完了!");
};

// ================= 図鑑 =================
let collNatFilter="all";
function renderColl(){
  const g=document.getElementById("collGrid");g.innerHTML="";
  const counts={};S.coll.forEach(c=>counts[c.flag]=(counts[c.flag]||0)+1);
  if(!(collNatFilter==="all"||counts[collNatFilter]))collNatFilter="all"; // 在庫が無くなったフィルタはリセット
  const bar=document.getElementById("collFilter");bar.innerHTML="";
  const chip=(key,label,n)=>{const b=document.createElement("button");
    b.className="natchip"+(collNatFilter===key?" on":"");
    b.innerHTML=`${label}<span>${n}</span>`;
    b.onclick=()=>{collNatFilter=key;renderColl();};bar.appendChild(b);};
  chip("all","全て",S.coll.length);
  Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).forEach(f=>chip(f,`${f} ${natName(f)}`,counts[f]));
  const list=S.coll.filter(c=>collNatFilter==="all"||c.flag===collNatFilter);
  document.getElementById("collCount").textContent=`所持 ${S.coll.length}枚 / 表示 ${list.length}枚(カードをタップで詳細)`;
  const ord={l:0,sr:1,r:2,n:3};
  list.sort((a,b)=>ord[a.rar]-ord[b.rar]||total(b)-total(a)).forEach(c=>{
    const el=cardEl(c);el.onclick=()=>openCardModal(c);g.appendChild(el);
  });
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

