// ================= リーグ(ステージ攻略) =================
// クラブの平均OVR(固定ロスターの6ステ合計平均)。seed固定なので毎回同じ=偵察=本番と一致。
function clubAvgOVR(club){
  const t=oppTeam(club.lv,club);
  const tot=t.players.reduce((s,p)=>s+p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta,0);
  return Math.round(tot/t.players.length);
}
function renderLeague(){
  const l=document.getElementById("leagueList");l.innerHTML="";
  CLUBS.forEach((club,i)=>{
    const {name,lv,form}=club;
    const locked=i>S.cleared;
    const d=document.createElement("div");d.className="league-card"+(i<S.cleared?" done":"");
    if(locked){
      d.innerHTML=`<div class="lc-info"><div class="ln">🔒 ${name}</div>
        <div class="lv">前のクラブを攻略するとデータ開放</div></div>`;
    }else{
      const avg=clubAvgOVR(club), reward=TUNING.reward.base+lv*TUNING.reward.perLv;
      d.innerHTML=`<div class="lc-info">
        <div class="ln">${i<S.cleared?"✅ ":""}${name} <span class="scout-hint">🔍偵察</span></div>
        <div class="lv">平均OVR <b style="color:var(--gold)">${avg}</b> ／ 陣形 <b>${form}</b> ／ 報酬 🪙${reward}</div>
        <div class="lc-desc">${FORM_DESC[form]||""}</div></div>`;
      const info=d.querySelector(".lc-info");info.onclick=()=>openScout(i); // チーム名(情報)タップで偵察
      const ko=document.createElement("button");ko.className="btn ko-btn";ko.textContent="KickOff";
      ko.onclick=()=>startMatch(i);
      d.appendChild(ko);
    }
    l.appendChild(d);
  });
  if(S.cleared>=CLUBS.length){
    const w=document.createElement("div");w.className="banner";w.textContent="🏆 全クラブ制覇!ワールドツアー解放!";
    l.prepend(w);
  }
  // ワールドツアーは全クラブ制覇で解放
  const wb=document.querySelector('#modeRow [data-m="world"]');
  if(wb)wb.style.display=(S.cleared>=CLUBS.length)?"":"none";
}
// 偵察(事前調査): 相手の固定ロスターをフルサイズのフォーメーション図で表示(数値はOVRのみ)。
// 直接的な相性表現はせず、平均OVR+陣形+チーム解説(間接表現)を見せる。ステージ/ワールド共用。
function renderScout(title,infoHtml,away){
  document.getElementById("scoutTitle").textContent=title;
  document.getElementById("scoutInfo").innerHTML=infoHtml;
  const wrap=document.getElementById("scoutList");wrap.innerHTML="";
  const pitch=document.createElement("div");pitch.className="pitch scoutpitch";
  pitch.innerHTML='<div class="circle"></div>';
  away.players.forEach(p=>{
    const ovr=p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta;
    const s=document.createElement("div");s.className="sslot";
    s.style.left=p.x+"%";s.style.top=p.y+"%";
    s.innerHTML=`<span class="pos ${p.role}">${p.subRole||p.role}</span>
      <div class="ssp"></div><span class="sovr">${ovr}</span>`;
    s.querySelector(".ssp").appendChild(spriteCanvas(p.c,38));
    s.onclick=()=>{const base=`${p.c.flag} ${p.c.name}(${p.c.sub})`;toast(p.c.skill?`${base}|【${p.c.skill.name}】${p.c.skill.desc}`:base);};
    pitch.appendChild(s);
  });
  wrap.appendChild(pitch);
  document.getElementById("scoutModal").classList.add("on"); // 情報専用(試合開始はKickOffから)
}
function openScout(idx){
  const club=CLUBS[idx], away=oppTeam(club.lv,club); // seed固定=プレビュー=本番一致
  renderScout(`偵察: ${club.name}`,
    `平均OVR <b style="color:var(--gold)">${clubAvgOVR(club)}</b> ／ 陣形 <b>${club.form}</b><br><span class="lc-desc">${FORM_DESC[club.form]||""}</span>`, away);
}
function openWorldScout(k){
  const nation=WORLD_NATIONS[k], away=worldTeam(nation,k);
  const tot=away.players.reduce((s,p)=>s+p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta,0);
  const sigs=SIGNATURES.filter(s=>s.flag===nation.flag);
  renderScout(`偵察: ${nation.flag} ${nation.name}`,
    `平均OVR <b style="color:var(--gold)">${Math.round(tot/away.players.length)}</b> ／ 陣形 <b>${nation.form}</b> ／ 国籍ボーナス <b style="color:var(--gold)">+${Math.round((away.chem-1)*100)}%</b>`
    +(sigs.length?`<br><span class="lc-desc">⚠ 固有選手: ${sigs.map(s=>s.name).join("、")}</span>`:""), away);
}
document.getElementById("scoutClose").onclick=()=>document.getElementById("scoutModal").classList.remove("on");

// ================= リーグ戦モード =================
const LG_CLUBS=["マイチーム",...CLUBS.map(c=>c.name)]; // 自分+8クラブ=9チーム(内部キー)
const lgName=i=>i===0?myName():LG_CLUBS[i]; // 表示名(自分はプロフィールのチーム名)
function lgLevel(name){const c=CLUBS.find(x=>x.name===name);return c?c.lv:0;}
// ラウンドロビン(円卓法)で全8節の対戦表を生成
function makeFixtures(){
  const real=LG_CLUBS.length;          // 9チーム(奇数)
  const BYE=-1;
  let idx=[...Array(real).keys(),BYE];  // ダミーを足して偶数化(10)
  const n=idx.length, rounds=[];
  for(let r=0;r<n-1;r++){               // n-1=9節
    const games=[];
    for(let i=0;i<n/2;i++){
      const a=idx[i],b=idx[n-1-i];
      if(a!==BYE&&b!==BYE)games.push([a,b]); // ダミー戦=休み
    }
    rounds.push(games);
    idx=[idx[0],idx[n-1],...idx.slice(1,n-1)]; // 0番固定で時計回り回転
  }
  return rounds; // 9節・各チーム8試合
}
function blankTable(){
  const t={};LG_CLUBS.forEach((nm,i)=>t[i]={p:0,w:0,d:0,l:0,gf:0,ga:0,pt:0});return t;
}
// CPU同士の試合結果を高速算出(戦力Lvベースのポアソン風)
function simCpu(aLv,bLv){
  const exp=l=>0.6+l*0.18;
  const pois=m=>{let L=Math.exp(-m),k=0,p=1;do{k++;p*=Math.random();}while(p>L);return k-1;}
  let ga=pois(exp(aLv)*(1+(aLv-bLv)*0.08));
  let gb=pois(exp(bLv)*(1+(bLv-aLv)*0.08));
  return [Math.max(0,ga),Math.max(0,gb)];
}
function applyResult(T,hi,ai,hs,as){
  T[hi].p++;T[ai].p++;T[hi].gf+=hs;T[hi].ga+=as;T[ai].gf+=as;T[ai].ga+=hs;
  if(hs>as){T[hi].w++;T[hi].pt+=3;T[ai].l++;}
  else if(hs<as){T[ai].w++;T[ai].pt+=3;T[hi].l++;}
  else{T[hi].d++;T[ai].d++;T[hi].pt++;T[ai].pt++;}
}
function rankList(T){
  return Object.keys(T).map(i=>({i:+i,...T[i]}))
    .sort((a,b)=>b.pt-a.pt||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.i-b.i);
}
function startSeason(){
  S.league={fixtures:makeFixtures(),round:0,table:blankTable()};
  save();renderLeagueMode();
}
function renderLeagueMode(){
  const lg=S.league;
  const head=document.getElementById("leagueHead");
  const fb=document.getElementById("fixtureBox");
  const tbl=document.getElementById("standings");
  if(!lg){
    head.innerHTML='<div class="banner" style="font-size:15px">― リーグ戦 ―</div><div class="lg">全9チームの総当たり(8節)。優勝で🏆+賞金🪙500(初優勝は実績でチャンピオンパック!)</div>';
    fb.innerHTML="";tbl.innerHTML="";
    const b=document.createElement("button");b.className="btn";b.textContent="シーズン開始";
    b.onclick=startSeason;fb.appendChild(b);
    return;
  }
  // 順位表
  const rk=rankList(lg.table);
  let h='<tr><th>順位</th><th>クラブ</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得失</th><th>点</th></tr>';
  rk.forEach((r,n)=>{
    const me=r.i===0?' class="me"':'';
    h+=`<tr${me}><td>${n+1}</td><td style="text-align:left">${lgName(r.i)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${(r.gf-r.ga>=0?"+":"")+(r.gf-r.ga)}</td><td><b>${r.pt}</b></td></tr>`;
  });
  tbl.innerHTML=h;
  const done=lg.round>=lg.fixtures.length;
  head.innerHTML=`<div class="banner" style="font-size:15px">― リーグ戦 第${Math.min(lg.round+1,lg.fixtures.length)}節${done?"終了":""} ―</div>`;
  fb.innerHTML="";
  if(done){
    const champ=rk[0];
    const meRank=rk.findIndex(r=>r.i===0)+1;
    const w=document.createElement("div");w.className="banner";
    w.textContent=champ.i===0?"🏆 優勝!!":`シーズン終了 ${meRank}位`;
    fb.appendChild(w);
    const b=document.createElement("button");b.className="btn";b.textContent="新シーズンを開始";
    b.onclick=()=>{startSeason();};  // 報酬は下の自動付与で1回だけ。ここでは再付与しない(二重付与バグ修正)
    fb.appendChild(b);
    if(!lg.claimed){claimSeason(meRank);lg.claimed=true;save();}
    return;
  }
  // 今節の対戦カード
  const games=lg.fixtures[lg.round];
  const myGame=games.find(g=>g[0]===0||g[1]===0);
  games.forEach(g=>{
    const [hi,ai]=g;const mine=hi===0||ai===0;
    const row=document.createElement("div");row.className="fixrow"+(mine?" mine":"");
    row.innerHTML=`<span>${lgName(hi)}</span><span class="vs">vs</span><span>${lgName(ai)}</span>`;
    fb.appendChild(row);
  });
  const b=document.createElement("button");b.className="btn";
  b.textContent=myGame?"自分の試合を行う":"この節を消化(自分は休み)";
  b.onclick=()=>playLeagueRound();
  fb.appendChild(b);
}
// シーズン報酬: コインは順位別に毎回付与。パック類は実績(初優勝など)に一本化(checkAchievements)。
function claimSeason(rank){
  let reward=100,msg=`${rank}位 参加賞🪙100`;
  if(rank===1){reward=500;msg="🏆 優勝賞金🪙500!";S.leagueWins=(S.leagueWins||0)+1;}
  else if(rank<=3){reward=250;msg=`${rank}位入賞🪙250`;}
  S.coins+=reward;coinUI();toast(msg);
  if(checkAchievements())save(); // 初優勝の実績(チャンピオンパック+シグネチャーパック)などを付与
}
function playLeagueRound(){
  const lg=S.league;
  const games=lg.fixtures[lg.round];
  const myGame=games.find(g=>g[0]===0||g[1]===0);
  if(myGame){
    // 他カードを先にCPU処理し、自分の試合は実プレイ
    lg._pending=games.filter(g=>g!==myGame);
    const oppName=LG_CLUBS[myGame[0]===0?myGame[1]:myGame[0]];
    const idx=CLUBS.findIndex(c=>c.name===oppName);
    lg._myHome=(myGame[0]===0);
    startLeagueMatch(idx,oppName);
  }else{
    games.forEach(([hi,ai])=>{const[hs,as]=simCpu(lgLevel(LG_CLUBS[hi]),lgLevel(LG_CLUBS[ai]));applyResult(lg.table,hi,ai,hs,as);});
    lg.round++;save();renderLeagueMode();
  }
}
function finishLeagueRound(myHS,myAS){
  const lg=S.league;
  const games=lg.fixtures[lg.round];
  const myGame=games.find(g=>g[0]===0||g[1]===0);
  if(lg._myHome)applyResult(lg.table,myGame[0],myGame[1],myHS,myAS);
  else applyResult(lg.table,myGame[0],myGame[1],myAS,myHS); // 自分がawayなら入替
  (lg._pending||[]).forEach(([hi,ai])=>{const[hs,as]=simCpu(lgLevel(LG_CLUBS[hi]),lgLevel(LG_CLUBS[ai]));applyResult(lg.table,hi,ai,hs,as);});
  lg._pending=null;lg.round++;save();
}
// ================= ワールドツアー =================
function renderWorld(){
  const tour=S.tour||(S.tour={i:0,res:[]});
  const done=tour.i>=WORLD_NATIONS.length;
  const wins=tour.res.filter(x=>x==="W").length;
  document.getElementById("worldHead").innerHTML=
    `<div class="banner" style="font-size:15px">― 🌍 ワールドツアー ${Math.min(tour.i+(done?0:1),WORLD_NATIONS.length)}/${WORLD_NATIONS.length} ―</div>`
    +`<div class="lg">強豪国代表(平均OVR90↑・国籍ボーナス満)を${WORLD_NATIONS.length}連戦。勝敗に関わらず次へ進む。${wins}勝</div>`;
  const list=document.getElementById("worldList");list.innerHTML="";
  WORLD_NATIONS.forEach((nation,k)=>{
    const res=tour.res[k], cur=(k===tour.i)&&!done, locked=k>tour.i;
    const sigs=SIGNATURES.filter(s=>s.flag===nation.flag);
    const d=document.createElement("div");
    d.className="wt-card"+(res?" played":"")+(cur?" cur":"")+(locked?" lock":"");
    const chip=res?`<span class="wt-res ${res}">${res==="W"?"🏆 勝":res==="D"?"🤝 分":"😢 敗"}</span>`:(cur?`<span class="wt-res cur">▶ 挑戦</span>`:`<span class="wt-res">🔒</span>`);
    d.innerHTML=`<div class="wt-flag">${nation.flag}</div>
      <div class="wt-info"><div class="wt-name">${nation.name}${sigs.length?` <span class="wt-sig">★${sigs.length}</span>`:""} ${(!locked)?'<span class="scout-hint">🔍</span>':''}</div>
      <div class="lv">${cur?"挑戦中":locked?"未到達":"対戦済"}・陣形 ${nation.form}</div></div>${chip}`;
    if(!locked)d.querySelector(".wt-info").onclick=()=>openWorldScout(k);
    if(cur){const ko=document.createElement("button");ko.className="btn ko-btn";ko.textContent="KickOff";ko.onclick=()=>startWorldMatch();d.appendChild(ko);}
    list.appendChild(d);
  });
  const foot=document.getElementById("worldFoot");foot.innerHTML="";
  if(done){
    const perfect=tour.res.every(x=>x==="W");
    const w=document.createElement("div");w.className="banner";
    w.textContent=perfect?"🌐 全勝!世界制覇!!":`ツアー終了 ${wins}勝${tour.res.filter(x=>x==="D").length}分${tour.res.filter(x=>x==="L").length}敗`;
    foot.appendChild(w);
    const b=document.createElement("button");b.className="btn";b.textContent="新しいツアーを始める";
    b.onclick=()=>{S.tour={i:0,res:[]};save();renderWorld();};foot.appendChild(b);
  }
}
// ================= フレンド対戦(チームコード共有・非同期/サーバ不要) =================
// スタメン11+陣形+監督名をコード化→URLで共有。相手が開く/貼ると自チームvs相手チームを試合。
const _b64e=s=>btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const _b64d=s=>decodeURIComponent(escape(atob((s||"").replace(/-/g,"+").replace(/_/g,"/"))));
const serCard=c=>({s:c.sub,r:c.rar,t:c.type,h:(c.look&&c.look.headIdx)||0,b:(c.look&&c.look.bodyVar)||0,
  st:[c.off,c.def,c.pow,c.tec,c.spd,c.sta],fl:c.flag,nm:c.name,sg:c.sig||0,sk:c.skill?{n:c.skill.name,f:c.skill.fx}:0,lb:c.lb||0});
function exportTeam(){
  const cards=FORMS[S.form].map((sl,i)=>{const c=S.coll.find(k=>k.id===S.squad[i]);return c?serCard(c):0;});
  const favC=S.favId&&S.coll.find(k=>k.id===S.favId);
  return _b64e(JSON.stringify({v:1,c:S.coach||"名無し監督",tn:S.teamName||"マイチーム",f:S.form,fav:favC?serCard(favC):0,cards}));
}
function challengeURL(){return location.origin+location.pathname+"#team="+exportTeam();}
function rebuildCard(cd){
  if(cd.sg){const c=makeSignature(cd.sg)||makeCard("FW","l");
    ["off","def","pow","tec","spd","sta"].forEach((k,i)=>{if(cd.st&&cd.st[i]!=null)c[k]=cd.st[i];});
    if(cd.lb)c.lb=cd.lb; return c;}
  return {id:uid++,name:cd.nm||"?",flag:cd.fl||"🏳️",pos:subGroup(cd.s),sub:cd.s,rar:cd.r||"n",type:cd.t,
    look:{headIdx:cd.h||0,bodyVar:cd.b||0},
    off:cd.st[0],def:cd.st[1],pow:cd.st[2],tec:cd.st[3],spd:cd.st[4],sta:cd.st[5],
    skill:cd.sk?{name:cd.sk.n,desc:"",fx:cd.sk.f}:null,lb:cd.lb||undefined};
}
function importTeam(raw){
  let code=(raw||"").trim();
  const m=code.match(/team=([A-Za-z0-9_-]+)/); if(m)code=m[1]; // URL貼り付けにも対応
  const data=JSON.parse(_b64d(code));
  if(!data||data.v!==1||!Array.isArray(data.cards)||!data.cards.length)throw new Error("bad");
  const form=FORMS[data.f]?data.f:"4-4-2", kp=KEYPOS[form]||{};
  const cards=FORMS[form].map((sl,i)=>{
    const cd=data.cards[i];
    const c=cd?rebuildCard(cd):makeCard(subGroup(sl[0]),"n",null,sl[0]);
    return {c,role:subGroup(sl[0]),subRole:sl[0],pen:posFit(c.sub,sl[0]),x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  });
  return {team:buildTeam(cards,"A",form), coach:(data.c||"名無し監督").slice(0,20),
    teamName:(data.tn||"相手チーム").slice(0,20), fav:data.fav?rebuildCard(data.fav):null, form};
}
let _pendingChallenge=null; // チャレンジURL(#team=)で来たコードを保持
function renderFriend(){
  document.getElementById("friendHead").innerHTML=
    '<div class="banner" style="font-size:15px">― 🤝 フレンド対戦 ―</div>'
    +'<div class="lg">自分のチームをURLで共有し、相手のURL/コードを貼って非同期で対戦。サーバ不要・カジュアル用(コードは編集可能)。</div>';
  const body=document.getElementById("friendBody");body.innerHTML="";
  const add=el=>body.appendChild(el), mk=(t,cls)=>{const e=document.createElement(t);if(cls)e.className=cls;return e;};
  // 自分のプロフィール表示 + 編集
  const pf=mk("div","wt-card");
  pf.innerHTML=`<div class="wt-info"><div class="wt-name">${myName()}</div><div class="lv">監督: ${S.coach||"未設定"}${S.favId&&S.coll.find(c=>c.id===S.favId)?` ・ お気に入り: ${S.coll.find(c=>c.id===S.favId).name}`:""}</div></div>`;
  const ed=mk("button","btn ghost");ed.textContent="👤 編集";ed.style.cssText="width:auto;flex:0 0 auto;margin-left:8px";ed.onclick=()=>openProfile(false);
  pf.appendChild(ed);add(pf);
  // 共有(URL生成)
  const ex=mk("button","btn");ex.style.marginTop="8px";ex.textContent="🔗 自分のチームを共有(URL生成)";
  const out=mk("div");out.style.marginTop="6px";
  ex.onclick=()=>{
    const url=challengeURL();out.innerHTML="";
    const ta=mk("textarea","ci-input");ta.rows=3;ta.readOnly=true;ta.value=url;out.appendChild(ta);
    const cp=mk("button","btn ghost");cp.style.marginTop="4px";cp.textContent="📋 コピー";
    cp.onclick=()=>{ta.select();let ok=false;try{ok=document.execCommand("copy");}catch(e){}
      if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>toast("URLをコピーしました")).catch(()=>toast(ok?"コピーしました":"長押しでコピー"));
      else toast(ok?"コピーしました":"長押しでコピー");};
    out.appendChild(cp);
  };
  add(ex);add(out);
  // 取り込み → 相手プロフィールを確認してからキックオフ
  const il=mk("div","lg");il.style.marginTop="12px";il.textContent="相手のURL/コードを貼り付け:";add(il);
  const imp=mk("textarea","ci-input");imp.rows=3;imp.placeholder="https://.../#team=... または コード";
  if(_pendingChallenge)imp.value=location.origin+location.pathname+"#team="+_pendingChallenge;
  add(imp);
  const prev=mk("div");prev.style.marginTop="8px";
  const go=mk("button","btn");go.style.marginTop="6px";go.textContent="🔎 相手を確認";
  go.onclick=()=>{ let r;try{r=importTeam(imp.value);}catch(e){toast("コードを読み取れませんでした");return;}
    prev.innerHTML="";
    const h=mk("div","banner");h.style.fontSize="14px";h.textContent=`🆚 ${r.teamName}`;prev.appendChild(h);
    const ci=mk("div","lg");ci.innerHTML=`監督: <b>${r.coach}</b>`;prev.appendChild(ci);
    if(r.fav){const fl=mk("div","lg");fl.textContent="お気に入り選手:";prev.appendChild(fl);
      const fc=mk("div");fc.style.cssText="display:flex;justify-content:center";fc.appendChild(cardEl(r.fav));prev.appendChild(fc);}
    const ko=mk("button","btn");ko.style.marginTop="6px";ko.textContent="⚔️ キックオフ";
    ko.onclick=()=>{ if(!_checkSquad())return; _pendingChallenge=null; startFriendMatch(r.team,r.coach,r.teamName,r.form); };
    prev.appendChild(ko);
  };
  add(go);add(prev);
  // 対戦成績
  const rec=S.friendRec||{},keys=Object.keys(rec);
  if(keys.length){
    const rh=mk("div","banner");rh.style.cssText="font-size:14px;margin-top:14px";rh.textContent="― 対戦成績 ―";add(rh);
    keys.forEach(k=>{const r=rec[k],d=mk("div","wt-card");
      d.innerHTML=`<div class="wt-info"><div class="wt-name">${k}</div><div class="lv">${r.w||0}勝 ${r.d||0}分 ${r.l||0}敗</div></div>`;add(d);});
  }
}
// ホーム表示時に「現在アクティブなモード」を再描画(タブ戻り時に古い表示が残らないように)。
function renderHome(){
  const on=document.querySelector("#modeRow [data-m].on");
  const m=on?on.dataset.m:"stage";
  const wb=document.querySelector('#modeRow [data-m="world"]');
  if(wb)wb.style.display=(S.cleared>=CLUBS.length)?"":"none"; // 解放状態を常に反映
  if(m==="league")renderLeagueMode();
  else if(m==="world")renderWorld();
  else if(m==="friend")renderFriend();
  else renderLeague();
}
// モード切替(stage / league / world)
document.querySelectorAll("#modeRow [data-m]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("#modeRow [data-m]").forEach(x=>x.classList.toggle("on",x===b));
  const m=b.dataset.m;
  document.getElementById("stageMode").style.display=m==="stage"?"block":"none";
  document.getElementById("leagueMode").style.display=m==="league"?"block":"none";
  document.getElementById("worldMode").style.display=m==="world"?"block":"none";
  document.getElementById("friendMode").style.display=m==="friend"?"block":"none";
  if(m==="league")renderLeagueMode();else if(m==="world")renderWorld();else if(m==="friend")renderFriend();else renderLeague();
});
