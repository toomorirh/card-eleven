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
    head.innerHTML='<div class="banner" style="font-size:15px">― リーグ戦 ― '+helpIcon("league")+'</div>';
    fb.innerHTML="";tbl.innerHTML="";
    const b=document.createElement("button");b.className="btn";b.textContent="シーズン開始";
    b.onclick=startSeason;fb.appendChild(b);
    return;
  }
  // 順位表
  const rk=rankList(lg.table);
  let h='<tr><th>順位</th><th>クラブ</th><th>試</th><th>W</th><th>D</th><th>L</th><th>得失</th><th>点</th></tr>';
  rk.forEach((r,n)=>{
    const me=r.i===0?' class="me"':'';
    const nmCell=r.i===0?`<td style="text-align:left">${lgName(r.i)}</td>`
      :`<td class="scout-td" data-club-lg="${r.i}" style="text-align:left">${lgName(r.i)} <span class="scout-hint">🔍</span></td>`; // クラブ名タップで偵察
    h+=`<tr${me}><td>${n+1}</td>${nmCell}<td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${(r.gf-r.ga>=0?"+":"")+(r.gf-r.ga)}</td><td><b>${r.pt}</b></td></tr>`;
  });
  tbl.innerHTML=h;
  tbl.querySelectorAll("[data-club-lg]").forEach(td=>{td.onclick=()=>openScout(+td.dataset.clubLg-1);}); // LG_CLUBS[i]=CLUBS[i-1]
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
  const letters=rank===1?2:1; // 周回報酬: シーズン完了で紹介状(優勝は2枚)→スカウト画面の監督スカウトに使う
  S.introLetters=(S.introLetters||0)+letters;
  toast(`✉️ 監督の紹介状 +${letters}(計${S.introLetters}) ・ スカウト画面の「監督スカウト」で獲得`);
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
    `<div class="banner" style="font-size:15px">― 🌍 ワールドツアー ${Math.min(tour.i+(done?0:1),WORLD_NATIONS.length)}/${WORLD_NATIONS.length} ― ${helpIcon("world")}</div>`
    +`<div class="lg">${wins}勝</div>`;
  const list=document.getElementById("worldList");list.innerHTML="";
  WORLD_NATIONS.forEach((nation,k)=>{
    const res=tour.res[k], cur=(k===tour.i)&&!done, locked=k>tour.i;
    const sigs=SIGNATURES.filter(s=>s.flag===nation.flag);
    const d=document.createElement("div");
    d.className="wt-card"+(res?" played":"")+(cur?" cur":"")+(locked?" lock":"");
    const chip=res?`<span class="wt-res ${res}">${resWordEmoji(res)}</span>`:(cur?`<span class="wt-res cur">▶ 挑戦</span>`:`<span class="wt-res">🔒</span>`);
    d.innerHTML=`<div class="wt-flag">${nation.flag}</div>
      <div class="wt-info"><div class="wt-name">${nation.name}${sigs.length?` <span class="wt-sig">★${sigs.length}</span>`:""} ${(!locked)?'<span class="scout-hint">🔍偵察</span>':''}</div>
      <div class="lv">${cur?"挑戦中":locked?"未到達":"対戦済"}・陣形 ${nation.form}</div></div>${chip}`;
    if(!locked)d.querySelector(".wt-info").onclick=()=>openWorldScout(k);
    if(cur){const ko=document.createElement("button");ko.className="btn ko-btn";ko.textContent="KickOff";ko.onclick=()=>startWorldMatch();d.appendChild(ko);}
    list.appendChild(d);
  });
  const foot=document.getElementById("worldFoot");foot.innerHTML="";
  if(done){
    const perfect=tour.res.every(x=>x==="W");
    const w=document.createElement("div");w.className="banner";
    w.textContent=perfect?"🌐 全勝!世界制覇!!":`ツアー終了 ${wins}W ${tour.res.filter(x=>x==="D").length}D ${tour.res.filter(x=>x==="L").length}L`;
    foot.appendChild(w);
    const b=document.createElement("button");b.className="btn";b.textContent="新しいツアーを始める";
    b.onclick=()=>{S.tour={i:0,res:[]};save();renderWorld();};foot.appendChild(b);
  }
}
// ================= デイリークエスト(毎日2チーム・全勝でシグネチャーチケット) =================
function renderDaily(){
  const d=ensureDaily(), doneN=d.done.filter(x=>x).length, allDone=doneN>=d.teams.length;
  document.getElementById("dailyHead").innerHTML=
    `<div class="banner" style="font-size:15px">― 📅 デイリークエスト ${doneN}/${d.teams.length} ― ${helpIcon("daily")}</div>`
    +`<div class="lg">本日の全チーム撃破で <b>🎟️シグネチャーチケット</b>(1日1枚)。状態: ${d.claimed?"🎟️獲得済(また明日)":allDone?"未受取":"挑戦中"}</div>`;
  const list=document.getElementById("dailyList");list.innerHTML="";
  d.teams.forEach((t,k)=>{
    const nation=WORLD_NATIONS[t.idx], away=worldTeam(nation,t.idx);
    const ovr=Math.round(away.players.reduce((s,p)=>s+p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta,0)/away.players.length);
    const sigs=SIGNATURES.filter(s=>s.flag===nation.flag), cleared=d.done[k];
    const card=document.createElement("div");card.className="wt-card"+(cleared?" played":" cur");
    card.innerHTML=`<div class="wt-flag">${nation.flag}</div>
      <div class="wt-info"><div class="wt-name">${nation.name}${sigs.length?` <span class="wt-sig">★${sigs.length}</span>`:""} <span class="scout-hint">🔍偵察</span></div>
      <div class="lv">平均OVR ${ovr} ・ 陣形 ${nation.form}</div></div>
      ${cleared?`<span class="wt-res W">🏆 撃破</span>`:`<span class="wt-res cur">▶ 挑戦</span>`}`;
    card.querySelector(".wt-info").onclick=()=>renderScout(`偵察: ${nation.flag} ${nation.name}`,
      `平均OVR <b style="color:var(--gold)">${ovr}</b> / 陣形 <b>${nation.form}</b>${sigs.length?`<br><span class="lc-desc">⚠ 固有: ${sigs.map(s=>s.name).join("、")}</span>`:""}`, away);
    if(!cleared){const ko=document.createElement("button");ko.className="btn ko-btn";ko.textContent="KickOff";ko.onclick=()=>startDailyMatch(k);card.appendChild(ko);}
    list.appendChild(card);
  });
}
// ================= フレンド対戦(チームコード共有・非同期/サーバ不要) =================
// スタメン11+お気に入り+陣形+監督名/チーム名を「ビット詰めバイナリ→base64url」で短縮共有(QR向け)。
// 1カード=61bit。監督名/チーム名のみ可変長UTF8(先頭にバイト整列で格納)、以降はビットストリーム。
const _SUBS=["CF","ST","LWG","RWG","OMF","CMF","DMF","LMF","RMF","LSB","CB","RSB","GK"];
const _RARS=["n","r","sr","l"];
const _FORMS=Object.keys(FORMS);
const _u8=s=>new TextEncoder().encode(s||"");
const _us=b=>new TextDecoder().decode(b);
const _b64u=a=>btoa(String.fromCharCode.apply(null,a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const _unb64u=s=>{const t=atob((s||"").replace(/-/g,"+").replace(/_/g,"/"));const a=new Uint8Array(t.length);for(let i=0;i<t.length;i++)a[i]=t.charCodeAt(i);return a;};
function _BW(){return {b:[],c:0,n:0,
  push(v,bits){for(let i=bits-1;i>=0;i--){this.c=(this.c<<1)|((v>>i)&1);if(++this.n===8){this.b.push(this.c);this.c=0;this.n=0;}}},
  done(){if(this.n)this.b.push(this.c<<(8-this.n));return this.b;}};}
function _BR(bytes){return {bytes,bit:0,
  read(bits){let v=0;for(let i=0;i<bits;i++){const byte=this.bytes[this.bit>>3]||0,bv=(byte>>(7-(this.bit&7)))&1;v=(v<<1)|bv;this.bit++;}return v;}};}
const _SIGBITS=10; // v3+(0xC3/0xC4/0xC5): sigインデックスのビット幅=最大1023体。v2(0xC2)は5bit。
const _TYPEBITS=3; // v4+(0xC4/0xC5): タイプ(プレースタイル)のビット幅=最大8種/ポジション。v3以前は2bit。
const _AGEBITS=5;  // v5(0xC5): 年齢(age-16を格納=16〜47)。v4以前は非同梱→取り込みは全盛期(AGE_DEF)扱い。
function _encCard(w,c,sigBits,typeBits,ageBits){
  sigBits=sigBits||5; typeBits=typeBits||2;
  const pos=subGroup(c.sub);
  const sig=c.sig?Math.max(0,SIGNATURES.findIndex(s=>s.id===c.sig)+1):0;
  let skCh=0;
  if(!c.sig&&c.rar!=="n"&&c.skill){const a=c.rar==="l"?LSKILLS[pos]:SKILLS[pos][c.rar];const i=a.findIndex(s=>s[0]===c.skill.name);skCh=i>0?1:0;}
  w.push(Math.max(0,_SUBS.indexOf(c.sub)),4);
  w.push(Math.max(0,_RARS.indexOf(c.rar)),2);
  w.push(Math.max(0,Object.keys(TYPES[pos]).indexOf(c.type)),typeBits);
  w.push((c.look&&c.look.headIdx)||0,5);
  w.push((c.look&&c.look.bodyVar)||0,2);
  ["off","def","pow","tec","spd","sta"].forEach(k=>w.push(Math.min(31,Math.max(0,c[k]|0)),5));
  w.push(Math.max(0,FLAGS.indexOf(c.flag)),4);
  w.push(sig,sigBits);
  w.push(skCh,1);
  w.push(c.sig?0:Math.max(0,NAMES.indexOf(c.name)),6);
  if(ageBits)w.push(Math.max(0,Math.min((1<<ageBits)-1,(c.age!=null?c.age:AGE_DEF)-16)),ageBits); // 年齢(age-16)
}
function _decCard(r,sigBits,typeBits,ageBits){
  sigBits=sigBits||5; typeBits=typeBits||2;
  const sub=_SUBS[r.read(4)]||"CMF", rar=_RARS[r.read(2)]||"n", pos=subGroup(sub);
  const tIdx=r.read(typeBits), head=r.read(5), bv=r.read(2);
  const st=[r.read(5),r.read(5),r.read(5),r.read(5),r.read(5),r.read(5)];
  const flagIdx=r.read(4), sig=r.read(sigBits), skCh=r.read(1), nameIdx=r.read(6);
  const age=ageBits?(r.read(ageBits)+16):null; // sig分岐の前に必ず読む(ビット整合)。sigはmakeSignatureが年齢を持つ
  if(sig>0&&SIGNATURES[sig-1]){const c=makeSignature(SIGNATURES[sig-1].id)||makeCard("FW","l");
    ["off","def","pow","tec","spd","sta"].forEach((k,i)=>c[k]=st[i]); return c;}
  const tk=Object.keys(TYPES[pos]); const type=tk[tIdx]||tk[0];
  let sk=null; if(rar!=="n"){const a=rar==="l"?LSKILLS[pos]:SKILLS[pos][rar];const e=a[skCh]||a[0];sk={name:e[0],desc:e[1],fx:e[2]};}
  return {id:uid++,name:NAMES[nameIdx]||"?",flag:FLAGS[flagIdx]||"🏳️",pos,sub,rar,type,age:(age!=null?age:AGE_DEF),
    look:{headIdx:head,bodyVar:bv}, off:st[0],def:st[1],pow:st[2],tec:st[3],spd:st[4],sta:st[5], skill:sk};
}
function exportTeam(){
  const coach=_u8((S.coach||"名無し監督").slice(0,16)), team=_u8((S.teamName||"マイチーム").slice(0,16));
  const w=_BW();
  w.push(Math.max(0,_FORMS.indexOf(S.form)),3);
  const favC=S.favId&&S.coll.find(k=>k.id===S.favId);
  w.push(favC?1:0,1);
  FORMS[S.form].forEach((sl,i)=>{const c=S.coll.find(k=>k.id===S.squad[i]);_encCard(w,c||makeCard(subGroup(sl[0]),"n",null,sl[0]),_SIGBITS,_TYPEBITS,_AGEBITS);});
  if(favC)_encCard(w,favC,_SIGBITS,_TYPEBITS,_AGEBITS);
  const bits=w.done();
  const head=[0xC5,coach.length,...coach,team.length,...team]; // 0xC5=v5(age 5bit)。0xC4/0xC3/0xC2は読込互換
  return _b64u(Uint8Array.from(head.concat(bits)));
}
function challengeURL(){return location.origin+location.pathname+"#team="+exportTeam();}
function importTeam(raw){
  let code=(raw||"").trim();
  const m=code.match(/team=([A-Za-z0-9_-]+)/); if(m)code=m[1]; // URL貼り付けにも対応
  const bytes=_unb64u(code);
  const ver=bytes[0]; if(ver!==0xC2&&ver!==0xC3&&ver!==0xC4&&ver!==0xC5)throw new Error("bad");
  const sigBits=(ver===0xC3||ver===0xC4||ver===0xC5)?10:5; // sig ビット幅(v2=5/v3以降=10)
  const typeBits=(ver===0xC4||ver===0xC5)?3:2;             // type ビット幅(v4以降=3で最大8種/ポジション)
  const ageBits=ver===0xC5?5:0;                            // age ビット幅(v5=5。以前は非同梱→AGE_DEF)
  let p=1; const cl=bytes[p++], coach=_us(bytes.slice(p,p+cl)); p+=cl;
  const tl=bytes[p++], team=_us(bytes.slice(p,p+tl)); p+=tl;
  const r=_BR(bytes.slice(p));
  const form=_FORMS[r.read(3)]||"4-4-2", favFlag=r.read(1), kp=KEYPOS[form]||{};
  const cards=FORMS[form].map((sl,i)=>{const c=_decCard(r,sigBits,typeBits,ageBits);
    return {c,role:subGroup(sl[0]),subRole:sl[0],pen:posFit(c.sub,sl[0]),x:sl[1],y:sl[2],enter:0,keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};});
  const fav=favFlag?_decCard(r,sigBits,typeBits,ageBits):null;
  return {team:buildTeam(cards,"A",form), coach:(coach||"名無し監督").slice(0,20),
    teamName:(team||"相手チーム").slice(0,20), fav, form};
}
let _pendingChallenge=null; // チャレンジURL(#team=)で来たコードを保持
function renderFriend(){
  document.getElementById("friendHead").innerHTML=
    '<div class="banner" style="font-size:15px">― 🤝 フレンド対戦 ― '+helpIcon("friend")+'</div>';
  const body=document.getElementById("friendBody");body.innerHTML="";
  const add=el=>body.appendChild(el), mk=(t,cls)=>{const e=document.createElement(t);if(cls)e.className=cls;return e;};
  // 共有(URL生成)
  const ex=mk("button","btn");ex.style.marginTop="8px";ex.textContent="🔗 自分のチームを共有(URL生成)";
  const out=mk("div");out.style.marginTop="6px";
  ex.onclick=()=>{
    const url=challengeURL();out.innerHTML="";
    // QRコード(相手はスマホのカメラ等で読めば、開くだけで対戦できる)
    try{ if(typeof qrcode!=="undefined"){
      const qr=qrcode(0,"M");qr.addData(url);qr.make();
      const n=qr.getModuleCount(),sc=4,pad=4,sz=(n+pad*2)*sc;
      const cv=mk("canvas");cv.width=cv.height=sz;cv.style.cssText="display:block;margin:4px auto;width:"+Math.min(sz,260)+"px;image-rendering:pixelated;background:#fff;border-radius:6px";
      const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,sz,sz);x.fillStyle="#000";
      for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))x.fillRect((c+pad)*sc,(r+pad)*sc,sc,sc);
      out.appendChild(cv);
      const cap=mk("div","lg");cap.style.textAlign="center";cap.textContent="↑ QRを相手のカメラで読み取り(or 下のURLを共有)";out.appendChild(cap);
    }}catch(e){}
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
  go.onclick=()=>{ let r;try{r=importTeam(imp.value);}catch(e){toast("コードを読み取れませんでした(送信側・受信側を同じ最新版で開いてください)");return;}
    prev.innerHTML="";
    const h=mk("div","banner");h.style.fontSize="14px";h.textContent=`🆚 ${r.teamName}`;prev.appendChild(h);
    const ci=mk("div","lg");ci.innerHTML=`オーナー: <b>${r.coach}</b>`;prev.appendChild(ci);
    if(r.fav){const fl=mk("div","lg");fl.textContent="お気に入り選手:";prev.appendChild(fl);
      const fc=mk("div");fc.style.cssText="display:flex;justify-content:center";fc.appendChild(cardEl(r.fav));prev.appendChild(fc);}
    const ko=mk("button","btn");ko.style.marginTop="6px";ko.textContent="⚔️ キックオフ";
    ko.onclick=()=>{ if(!_checkSquad())return; _pendingChallenge=null; startFriendMatch(r.team,r.coach,r.teamName,r.form); };
    prev.appendChild(ko);
  };
  add(go);add(prev);
}
// ===== 監督室(プロフィール集約 + サブタブ: 対戦/戦績/実績) =====
let _ofTab="match"; // 監督室の現在サブタブ
function renderOffice(){
  S.ms=S.ms||{};
  const rec=S.friendRec||{}; let w=0,d=0,l=0;
  Object.keys(rec).forEach(k=>{const r=rec[k];w+=r.w||0;d+=r.d||0;l+=r.l||0;});
  const tot=w+d+l, wr=tot?Math.round(w/tot*100):0;
  const done=ACHIEVEMENTS.filter(a=>S.ms[a.id]).length;
  const fav=S.favId&&S.coll.find(c=>c.id===S.favId);
  const mk=(t,cls)=>{const e=document.createElement(t);if(cls)e.className=cls;return e;};
  const head=document.getElementById("officeHead");head.innerHTML="";
  const card=mk("div","wt-card");
  card.innerHTML=`<div class="wt-info">`
    +`<div class="wt-name">${myName()}</div>`
    +`<div class="lv">オーナー: <b>${S.coach||"未設定"}</b>${fav?` ・ ⭐${fav.name}`:""}</div>`
    +`<div class="lv">🤝 フレンド勝率 ${tot?`<b>${wr}%</b> (${w}W ${d}D ${l}L)`:"—"} ・ 🏅 実績 <b>${done}</b>/${ACHIEVEMENTS.length}</div>`
    +`<div class="lv">🎯 監督: ${activeManager()?`<b>${activeManager().title}</b>(${mgrBoostDesc(activeManager())})`:"未契約"} ・ ✉️${S.introLetters||0}</div>`
    +`</div>`;
  const ed=mk("button","btn ghost");ed.textContent="👤 編集";ed.style.cssText="width:auto;flex:0 0 auto;margin-left:8px";ed.onclick=()=>openProfile(false);
  card.appendChild(ed);head.appendChild(card);
  document.querySelectorAll('#ofTabs [data-o]').forEach(b=>b.onclick=()=>_selectOfTab(b.dataset.o));
  _selectOfTab(_ofTab);
}
function _selectOfTab(o){
  _ofTab=o;
  document.querySelectorAll('#ofTabs [data-o]').forEach(x=>x.classList.toggle("on",x.dataset.o===o));
  document.getElementById("ofMatch").style.display=o==="match"?"block":"none";
  document.getElementById("ofRec").style.display=o==="rec"?"block":"none";
  document.getElementById("ofMgr").style.display=o==="mgr"?"block":"none";
  document.getElementById("ofAch").style.display=o==="ach"?"block":"none";
  if(o==="match")renderFriend();
  else if(o==="rec")renderFriendRec();
  else if(o==="mgr")renderManagers();
  else if(o==="ach")renderAchievements();
}
// ===== 監督(契約): 紹介済みの監督から起用する1名を選ぶ(契約=起用ごとにコイン・交代制)。監督スカウトはスカウト画面側。 =====
function renderManagers(){
  const box=document.getElementById("ofMgr");box.innerHTML="";
  S.mgrOwned=S.mgrOwned||[];
  const mk=(t,cls)=>{const e=document.createElement(t);if(cls)e.className=cls;return e;};
  const head=mk("div","banner");head.style.cssText="font-size:14px";head.innerHTML="― 🎯 監督(契約) ― "+helpIcon("office");box.appendChild(head);
  // 現在の起用
  const act=activeManager();
  const cur=mk("div","wt-card");
  if(act){
    cur.appendChild(mgrPortrait(act,76));
    const info=mk("div","wt-info");info.innerHTML=`<div class="wt-name">${act.title}</div><div class="lv">${act.name} ・ 🔼 ${mgrBoostDesc(act)}${mgrTacDesc(act)?` ・ ${mgrTacDesc(act)}`:""}</div>`;
    cur.appendChild(info);
    const dz=mk("button","btn ghost");dz.textContent="解任";dz.style.cssText="width:auto;flex:0 0 auto;margin-left:8px";
    dz.onclick=()=>{S.mgrActive="";save();renderOffice();toast("監督を解任しました");};
    cur.appendChild(dz);
  }else cur.innerHTML=`<div class="wt-info"><div class="wt-name">監督 未契約</div><div class="lv">下の一覧から契約してチームを強化</div></div>`;
  box.appendChild(cur);
  // 契約候補(紹介済み監督の一覧)
  const ch=mk("div","banner");ch.style.cssText="font-size:13px;margin-top:14px";ch.textContent="― 契約候補 ―";box.appendChild(ch);
  const owned=MANAGERS.filter(m=>S.mgrOwned.includes(m.id));
  if(!owned.length){const e=mk("div","lg");e.innerHTML="まだ監督がいません。<b>スカウト</b>画面の「監督スカウト」(✉️紹介状)で獲得しましょう。";box.appendChild(e);}
  owned.forEach(m=>{
    const d=mk("div","wt-card");const isAct=S.mgrActive===m.id;
    d.appendChild(mgrPortrait(m,62));
    const info=mk("div","wt-info");info.innerHTML=`<div class="wt-name">${m.title}${isAct?' <span class="lv" style="color:var(--gold)">起用中</span>':''}</div><div class="lv">${m.name} ・ 🔼 ${mgrBoostDesc(m)}${mgrTacDesc(m)?` ・ ${mgrTacDesc(m)}`:""}</div>`;
    d.appendChild(info);
    const b=mk("button","btn"+(isAct?" ghost":""));b.style.cssText="width:auto;flex:0 0 auto;margin-left:8px";
    b.textContent=isAct?"起用中":`契約 🪙${m.cost}`;
    if(!isAct)b.onclick=()=>rentManager(m.id);
    d.appendChild(b);box.appendChild(d);
  });
  // カスタム監督(監督キャリアモードで育成した自作監督・コイン不要で起用)
  const customs=S.customMgrs||[];
  if(customs.length){
    const ch2=mk("div","banner");ch2.style.cssText="font-size:13px;margin-top:14px";ch2.textContent="― 🎓 あなたのカスタム監督 ―";box.appendChild(ch2);
    customs.forEach(m=>{
      const d=mk("div","wt-card");const isAct=S.mgrActive===m.id;
      d.appendChild(mgrPortrait(m,62));
      const info=mk("div","wt-info");info.innerHTML=`<div class="wt-name">${m.name}${isAct?' <span class="lv" style="color:var(--gold)">起用中</span>':''}</div><div class="lv">🔼 ${mgrBoostDesc(m)}${mgrTacDesc(m)?` ・ ${mgrTacDesc(m)}`:""}</div>`;
      d.appendChild(info);
      const b=mk("button","btn"+(isAct?" ghost":""));b.style.cssText="width:auto;flex:0 0 auto;margin-left:8px";
      b.textContent=isAct?"起用中":"起用";
      if(!isAct)b.onclick=()=>rentManager(m.id);
      d.appendChild(b);box.appendChild(d);
    });
  }
}
// ===== 監督キャリア(リーグ内モード) =====
// 監督育成の独立画面(下部メニュー「🎓 育成」= scr-career)を開く。試合終了後の復帰などから呼ぶ。
function gotoCareer(){
  const nav=document.querySelector('.tabs [data-s="career"]'); if(nav)nav.click(); else renderCareer();
}
// 活動スケジュール(ワールドツアーと同じ wt-card 縦リスト)。48週ぶんの行を先に全て並べ、
// 進行した週(cr.history[i])だけ活動+結果を記録表示。現在週=▶で強調、未来週=淡色の未定。
function careerScheduleList(cr,noActions){ // noActions=現在週の操作ボタンを省く(操作はハブの「今週の活動」に集約)
  const wrap=document.createElement("div");
  const row=(cls,flag,name,sub,chip)=>{
    const d=document.createElement("div");d.className="wt-card "+cls;
    d.innerHTML=`<div class="wt-flag">${flag}</div><div class="wt-info"><div class="wt-name">${name}</div><div class="lv">${sub}</div></div>${chip||""}`;
    return d;
  };
  const actBtn=(label,fn,dis)=>{const b=document.createElement("button");b.className="btn"+(dis?" ghost":"");b.textContent=label;
    if(dis){b.disabled=true;b.style.opacity=".45";}else b.onclick=fn;return b;};
  for(let i=0;i<(cr.stepsMax||CAREER.steps);i++){
    const h=cr.history&&cr.history[i], wk=`第${i+1}週`;
    if(h&&h.act==="L"){
      const chip=`<span class="wt-res ${h.res}">${resWordEmoji(h.res)}</span>`;
      const league=h.cont?`🌐${h.cont}リーグ`:`DIV${h.div}`;
      const sub=`${league} 第${h.nd||"?"}節${h.opp?" vs "+h.opp:""} ・ ${h.sc||""}${h.season?` ・ 🏆制覇! バフ+${h.pct}%`:""}`;
      wrap.appendChild(row("played",h.season?"🏆":"⚽",wk,sub,chip));
    }else if(h&&h.act==="P"){
      wrap.appendChild(row("played","💪",wk,`練習 ・ OVR上限+${h.gain||"?"}→${h.cap||""}`,`<span class="wt-res">💪</span>`));
    }else if(h&&h.act==="C"){
      const chip=`<span class="wt-res ${h.res}">${resWordEmoji(h.res)}${h.pk?"<br><span style='font-size:8px'>PK</span>":""}</span>`;
      wrap.appendChild(row("played","🏆",wk,`${h.name||"カップ"} ${h.round||""}${h.opp?" vs "+h.opp:""} ・ ${h.sc||""}`,chip));
    }else if(i===cr.step){ // 現在週=次の実施を選ぶ箱(ボタン内蔵)
      const opp=careerOpponent(cr), oppOvr=opp?Math.round((6.6+opp.lv)*6):0;
      if(cr.cup){ // カップ進行中: 敗退/優勝までカップ戦のみ選択可
        const rl=roundLabel((cr.cup.bracket[cr.cup.round]||[]).length);
        const oppTxt=opp?`相手: ${opp.name}${opp.boss?" 👑":""}(OVR約${oppOvr}・${opp.form})`:"";
        wrap.appendChild(row("cur",cr.cup.emoji,`${wk} ・ ${cr.cup.name}`,`${rl} ・ ${oppTxt}`,`<span class="wt-res cur">${rl}</span>`));
        if(!noActions){
          const panel=document.createElement("div");panel.className="cur-actions";
          panel.appendChild(actBtn(`▶ ${rl}`,startCareerMatch));
          panel.appendChild(actBtn("🔍 偵察",()=>careerScout(cr)));
          wrap.appendChild(panel);
        }
      }else{
        const cont=cr.contId?continentById(cr.contId):null;
        const needCont=cr.stage==="cont"&&!cr.contId; // 大陸未選択(DIV1制覇後)
        const cupsHere=CUPS.filter(c=>cupEntryWeek(c,i));
        const cupOpp=cupsHere.length?` ・ ${cupsHere.map(c=>c.emoji).join("")}カップ参加機会`:"";
        const league=cont?`${cont.emoji}${cont.name}リーグ 第${cr.node+1}/${CAREER.nodes}節`:needCont?"大陸リーグ(選択待ち)":`DIV${cr.div} 第${cr.node+1}/${CAREER.nodes}節`;
        const oppTxt=(opp&&!needCont)?` ・ 次戦: ${opp.name}${opp.derby?" ⚔宿敵":opp.boss?" 👑":""}(OVR約${oppOvr}・${opp.form})`:"";
        wrap.appendChild(row("cur","▶",`${wk} ・ 次の活動`,`${league}${oppTxt}${cupOpp}`,""));
        if(!noActions){
          const panel=document.createElement("div");panel.className="cur-actions";
          if(needCont)panel.appendChild(actBtn("① 大陸リーグ選択",careerContPicker));
          else panel.appendChild(actBtn(cont?`① ${cont.name}リーグ進行`:"① リーグ進行",startCareerMatch));
          panel.appendChild(actBtn("② カップ挑戦",careerCupPicker,!CUPS.some(c=>cupEnterable(c,cr)))); // 参加不可なら非活性
          panel.appendChild(actBtn("③ 練習",careerPractice));
          if(!needCont)panel.appendChild(actBtn("🔍 偵察",()=>careerScout(cr)));
          wrap.appendChild(panel);
        }
      }
    }else{ // 未来週
      const cupsHere=CUPS.filter(c=>cupEntryWeek(c,i));
      if(cupsHere.length)wrap.appendChild(row("cupwk",cupsHere.map(c=>c.emoji).join(""),wk,cupsHere.map(c=>c.name).join(" / ")+" 参加機会",`<span class="wt-res">🎫</span>`));
      else wrap.appendChild(row("future","・",wk,"未定",`<span class="wt-res">—</span>`));
    }
  }
  return wrap;
}
// リーグ順位表(WCCF風): 自チーム(🎓)+同DIV6クラブ(⚔=宿敵)。緑=昇格圏/赤=降格圏。
function careerStandingsTable(cr){
  const rows=(typeof careerStandings==="function")?careerStandings(cr):[]; if(!rows.length)return null;
  const promoteRank=CAREER.promote[cr.div]||1, size=rows.length, wrap=document.createElement("div");
  let h='<table class="ctable"><tr><th>#</th><th>クラブ</th><th>試</th><th>勝点</th><th>差</th></tr>';
  rows.forEach((r,i)=>{const rank=i+1, zone=rank<=promoteRank?"promo":(cr.div<3&&rank>=size)?"releg":"";
    const nm=r.me?`🎓 ${r.name}`:r.rival?`⚔ ${r.name}`:r.name;
    const nmCell=r.me?`<td>${nm}</td>`
      :`<td class="scout-td" data-club="${r.id}">${nm} <span class="scout-hint">🔍</span></td>`; // クラブ名タップで偵察
    h+=`<tr class="${r.me?"meRow ":""}${zone}"><td>${rank}</td>${nmCell}<td>${r.pl}</td><td><b>${r.pts}</b></td><td>${r.gd>0?"+"+r.gd:r.gd}</td></tr>`;});
  h+=`</table><div class="lg" style="font-size:10px">🟩昇格圏(上位${promoteRank})${cr.div<3?" / 🟥降格圏(最下位)":""} ・ ⚔宿敵レガリア ・ クラブ名タップで偵察</div>`;
  wrap.innerHTML=h;
  wrap.querySelectorAll("[data-club]").forEach(td=>{td.onclick=()=>scoutClub(careerClubById(cr,td.dataset.club));});
  return wrap;
}
// 育成スカッド: 現在の自動編成XIを年齢/フェーズ・調子・成長・OVR(成長込み)で一覧。育てた実感を見せる。
function careerSquadView(cr){
  if(!cr)return null;
  let team; try{team=careerTeam(careerCap(cr));}catch(e){return null;}
  if(!team||!team.players.length)return null;
  const CI={peak:"⤴",good:"↗",ok:"→",bad:"↘",poor:"⤵"};
  const gsum=p=>{const g=p.grow||{};return(g.off||0)+(g.def||0)+(g.pow||0)+(g.tec||0)+(g.spd||0)+(g.sta||0);};
  const ovrG=p=>p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta+gsum(p);
  const wrap=document.createElement("div");
  let h='<table class="ctable sq"><tr><th>枠</th><th>選手</th><th>年齢</th><th>調子</th><th>成長</th><th>OVR</th></tr>';
  team.players.forEach(p=>{
    const age=effAge(p), ph=agePhase(age), ck=cr.cond&&cr.cond[p.c.id], gs=gsum(p);
    const gtxt=gs>=0.05?`<span style="color:#7dff9e">+${gs.toFixed(1)}</span>`:gs<=-0.05?`<span style="color:#ff8e8e">${gs.toFixed(1)}</span>`:"−";
    h+=`<tr><td><span class="pos ${p.role}">${p.subRole||p.role}</span></td><td>${p.c.name}</td>`
      +`<td>${age}${ph.icon}</td><td>${ck?CI[ck]:"−"}</td><td>${gtxt}</td><td><b>${Math.round(ovrG(p))}</b></td></tr>`;
  });
  h+='</table><div class="lg" style="font-size:10px">🌱若手/⭐全盛期/🎖ベテラン/🔥老雄 ・ 調子⤴〜⤵ ・ 成長=キャリア中の伸び(上限別枠・引退で消える)</div>';
  wrap.innerHTML=h; return wrap;
}
// ===== 育成のスカッド編成: 通常編成と同じピッチ盤(pitchSlots/benchSlots)を使い、#picker で選手選択 =====
// 先発スロットのピッカー(careerPool=手持ち+助っ人。先発他枠・ベンチと重複不可・cr.squadへ格納)。
function openCareerSlotPicker(i,sub){
  const cr=S.career; if(!cr)return;
  document.getElementById("pickTitle").textContent=`${sub}(${subGroup(sub)})の枠に置く選手(タップで配置/もう一度で外す)`;
  const g=document.getElementById("pickGrid");g.innerHTML="";
  const used=Object.entries(cr.squad||{}).filter(([k])=>+k!==i).map(([,v])=>v).concat((cr.bench||[]).filter(Boolean));
  const cur=(cr.squad||{})[i];
  careerPool(cr).filter(c=>!used.includes(c.id))
    .sort((a,b)=>posFit(b.sub,sub)-posFit(a.sub,sub)||cardOvr(b)-cardOvr(a))
    .forEach(c=>{
      const e=cardEl(c);
      if(c.id===cur)e.classList.add("sel");
      e.onclick=async()=>{cr.squad=cr.squad||{}; if(c.id===cur)delete cr.squad[i]; else cr.squad[i]=c.id;
        await save(); document.getElementById("picker").classList.remove("on"); renderCareer();};
      g.appendChild(e);
    });
  document.getElementById("picker").classList.add("on");
}
// ベンチ枠のピッカー(先発・他ベンチと重複不可・cr.benchへ格納)。
function openCareerBenchPicker(j){
  const cr=S.career; if(!cr)return;
  document.getElementById("pickTitle").textContent=`ベンチ枠${j+1}に置く控え(タップで配置/もう一度で外す)`;
  const g=document.getElementById("pickGrid");g.innerHTML="";
  const used=Object.values(cr.squad||{}).concat((cr.bench||[]).filter((_,k)=>k!==j));
  const cur=(cr.bench||[])[j];
  careerPool(cr).filter(c=>!used.includes(c.id)).sort((a,b)=>cardOvr(b)-cardOvr(a)).forEach(c=>{
    const e=cardEl(c);
    if(c.id===cur)e.classList.add("sel");
    e.onclick=async()=>{cr.bench=cr.bench||[]; if(c.id===cur)cr.bench[j]=null; else cr.bench[j]=c.id;
      await save(); document.getElementById("picker").classList.remove("on"); renderCareer();};
    g.appendChild(e);
  });
  document.getElementById("picker").classList.add("on");
}
// クラブ施設パネル(名声で段階解放): スタジアム/アカデミー/メディカル + 助っ人招へい。
function careerFacilities(cr){
  const wrap=document.createElement("div");
  FACILITIES.forEach(f=>{
    const lv=facLv(cr,f.id), cost=facCost(f,lv), maxed=lv>=f.max, afford=(cr.prestige||0)>=cost;
    const row=document.createElement("div");row.className="fac-row";
    row.innerHTML=`<div class="fac-info"><b>${f.icon} ${f.name}</b> <span class="lv">Lv${lv}/${f.max}</span><br>`
      +`<span class="lg" style="font-size:10px">${f.descL(lv)}${maxed?"":` → 次Lv: ${f.descL(lv+1)}`}</span></div>`;
    const b=document.createElement("button");b.className="btn"+(maxed||!afford?" ghost":"");b.style.cssText="flex:0 0 auto;padding:6px 10px";
    b.textContent=maxed?"MAX":`🏛${cost}`;
    if(maxed||!afford){b.disabled=true;b.style.opacity=".5";}
    else b.onclick=async()=>{cr.fac[f.id]=lv+1;cr.prestige-=cost;await save();toast(`${f.icon}${f.name}をLv${lv+1}に強化!`);renderCareer();};
    row.appendChild(b);wrap.appendChild(row);
  });
  // 助っ人(固有選手)招へい: 名声を払い、シーズン限定で固有選手をプールへ追加。
  const loanRow=document.createElement("div");loanRow.className="fac-row";
  if(cr.loan){
    loanRow.innerHTML=`<div class="fac-info"><b>💫 招へい中: ${cr.loan.flag||""}${cr.loan.name}</b><br><span class="lg" style="font-size:10px">シーズン終了で契約満了。編成盤で先発起用できる</span></div>`;
  }else{
    const afford=(cr.prestige||0)>=CAREER.loanCost;
    loanRow.innerHTML=`<div class="fac-info"><b>💫 助っ人を招へい</b><br><span class="lg" style="font-size:10px">固有選手をシーズン限定でプールへ(🏛${CAREER.loanCost})</span></div>`;
    const b=document.createElement("button");b.className="btn"+(afford?"":" ghost");b.style.cssText="flex:0 0 auto;padding:6px 10px";b.textContent=`🏛${CAREER.loanCost}`;
    if(!afford){b.disabled=true;b.style.opacity=".5";}else b.onclick=()=>careerLoanOffer(cr);
    loanRow.appendChild(b);
  }
  wrap.appendChild(loanRow);
  return wrap;
}
// 助っ人オファー: ランダム3人の固有選手から1人を選ぶ(名声を消費)。
function careerLoanOffer(cr){
  const ids=SIGNATURES.map(s=>s.id), pick=[];
  while(pick.length<3&&ids.length)pick.push(ids.splice(ri(0,ids.length-1),1)[0]);
  const ov=document.createElement("div");ov.className="tac-offer";
  const inn=document.createElement("div");inn.className="tac-offer-in";
  inn.innerHTML=`<div class="banner">💫 助っ人招へい(🏛${CAREER.loanCost})</div><div class="lg">シーズン限定で加入する固有選手を1人選択</div>`;
  pick.forEach(id=>{const s=signatureById(id);if(!s)return;
    const b=document.createElement("button");b.className="btn";b.style.cssText="margin-top:6px;text-align:left";
    b.innerHTML=`<b>${s.flag} ${s.name}</b> <span class="lv">${s.age}歳${agePhase(s.age).icon} ${s.pos}</span><br><span class="lg" style="font-size:10px">✦${s.skill.name}</span>`;
    b.onclick=async()=>{cr.loan=makeSignature(id);cr.prestige-=CAREER.loanCost;await save();ov.remove();toast(`💫 ${s.name}が加入! 編成盤で起用しよう`);renderCareer();};
    inn.appendChild(b);});
  ov.appendChild(inn);document.body.appendChild(ov);
}
// ===== 育成メイン: ハブ(ステータス+今週の活動)+ セクションタブ切替 =====
let _careerTab="schedule"; // 現在のセクションタブ
const CAREER_TABS=[{id:"schedule",lb:"📅 日程"},{id:"league",lb:"🏆 リーグ&カップ"},{id:"squad",lb:"👥 スカッド"},{id:"club",lb:"🏛 クラブ"},{id:"manager",lb:"🎓 監督"}];
// ステータスカード(監督名・週の進捗バー・ステージ・名声・OVR上限)。
function careerStatusCard(cr){
  const contNow=cr.contId?continentById(cr.contId):null;
  const stageTxt=contNow?`${contNow.emoji}${contNow.name}リーグ`:cr.stage==="cont"?"大陸リーグ(選択待ち)":`DIV${cr.div}`;
  const stepsMax=cr.stepsMax||CAREER.steps, pct=Math.min(100,Math.round(cr.step/stepsMax*100));
  const d=document.createElement("div");d.className="career-status";
  d.innerHTML=`<div class="cs-top"><span>👤 <b>${cr.name}</b> 監督</span><span>🏛 名声 <b>${cr.prestige||0}</b></span></div>
    <div class="cs-bar"><div class="cs-fill" style="width:${pct}%"></div><span class="cs-bar-lb">${cr.step}/${stepsMax}週${(cr.term||0)?` (延長${cr.term})`:""}</span></div>
    <div class="cs-row"><span><b>${stageTxt}</b> 第${cr.node+1}/${CAREER.nodes}節 ・ 勝点${cr.pts||0}</span><span>統制OVR <b>${careerCap(cr)}</b>${careerOverloadMul(cr)<1?` <span style="color:#ff8e8e">⚠-${Math.round((1-careerOverloadMul(cr))*100)}%</span>`:""}${cr.season?` ・ ${cr.season}季`:""}</span></div>`;
  return d;
}
// 今週の活動カード(=主操作。①リーグ/②カップ/③練習/偵察 or カップ戦)。ハブに常時表示。
function careerCurrentActivity(cr){
  const wrap=document.createElement("div");wrap.className="career-now";
  const actBtn=(label,fn,dis)=>{const b=document.createElement("button");b.className="btn"+(dis?" ghost":"");b.textContent=label;if(dis){b.disabled=true;b.style.opacity=".45";}else b.onclick=fn;return b;};
  if(cr.step>=(cr.stepsMax||CAREER.steps)){wrap.innerHTML=`<div class="cn-head">🎓 任期満了</div><div class="lg">「①」で監督を確定します</div>`;
    const p=document.createElement("div");p.className="cur-actions";p.appendChild(actBtn("① 任期を締める",()=>finalizeCareerIfDone()||renderCareer()));wrap.appendChild(p);return wrap;}
  const opp=careerOpponent(cr), oppOvr=opp?Math.round((6.6+opp.lv)*6):0;
  if(cr.cup){
    const rl=roundLabel((cr.cup.bracket[cr.cup.round]||[]).length);
    const oppTxt=opp?`相手: <span class="scout-name">${opp.name}${opp.boss?" 👑":""} <span class="scout-hint">🔍</span></span>(OVR約${oppOvr}・${opp.form})`:"";
    wrap.innerHTML=`<div class="cn-head">${cr.cup.emoji} ${cr.cup.name} ・ ${rl}</div><div class="lg">${oppTxt}</div>`;
    const p=document.createElement("div");p.className="cur-actions";
    p.appendChild(actBtn(`▶ ${rl}`,startCareerMatch));
    p.appendChild(actBtn("🔍 偵察",()=>careerScout(cr)));
    wrap.appendChild(p);
  }else{
    const cont=cr.contId?continentById(cr.contId):null, needCont=cr.stage==="cont"&&!cr.contId;
    const league=cont?`${cont.emoji}${cont.name}リーグ 第${cr.node+1}/${CAREER.nodes}節`:needCont?"大陸リーグ(選択待ち)":`DIV${cr.div} 第${cr.node+1}/${CAREER.nodes}節`;
    const oppTxt=(opp&&!needCont)?`次戦: <span class="scout-name">${opp.name}${opp.derby?" ⚔宿敵":opp.boss?" 👑":""} <span class="scout-hint">🔍</span></span>(OVR約${oppOvr}・${opp.form})`:"";
    wrap.innerHTML=`<div class="cn-head">▶ 第${cr.step+1}週 ・ ${league}</div><div class="lg">${oppTxt}</div>`;
    const p=document.createElement("div");p.className="cur-actions";
    if(needCont)p.appendChild(actBtn("① 大陸リーグ選択",careerContPicker));
    else p.appendChild(actBtn(cont?`① ${cont.name}リーグ進行`:"① リーグ進行",startCareerMatch));
    p.appendChild(actBtn("② カップ挑戦",careerCupPicker,!CUPS.some(c=>cupEnterable(c,cr))));
    p.appendChild(actBtn("③ 練習",careerPractice));
    if(!needCont)p.appendChild(actBtn("🔍 偵察",()=>careerScout(cr)));
    wrap.appendChild(p);
  }
  const sn=wrap.querySelector(".scout-name"); if(sn)sn.onclick=()=>careerScout(cr); // 次戦相手名タップでも偵察
  return wrap;
}
function careerTabBar(){
  const bar=document.createElement("div");bar.className="career-tabs";
  CAREER_TABS.forEach(t=>{const b=document.createElement("button");b.className="ctab"+(_careerTab===t.id?" on":"");b.textContent=t.lb;
    b.onclick=()=>{_careerTab=t.id;renderCareer();};bar.appendChild(b);});
  return bar;
}
// 次にこのカップにエントリーできる週(period の倍数・1基点)。
function nextCupEntryWeek(cup,step){for(let w=step;w<CAREER.steps*3+CAREER.extendWeeks*2+10;w++){if(((w+1)%cup.period)===0)return w+1;}return null;}
// 進行中カップのトーナメント表: 各回戦のカード(ペア)を並べ、自チームを金・勝者を緑で表示。
function cupBracketView(cup,cr){
  const wrap=document.createElement("div");wrap.className="cup-bracket";
  const nm=id=>id==="__me"?myName():((OPP_CLUBS[id]||{}).name||id);
  for(let r=0;r<cup.bracket.length;r++){
    const teams=cup.bracket[r], next=cup.bracket[r+1];
    const round=document.createElement("div");round.className="cup-round";
    let h=`<div class="cup-rn">${roundLabel(teams.length)}${r===cup.round?" ▶":""}</div><div class="cup-matches">`;
    for(let k=0;k<teams.length;k+=2){
      const a=teams[k], b=teams[k+1], winner=next?next[k/2]:null, mine=(a==="__me"||b==="__me");
      const chip=id=>{const me=id==="__me",won=winner&&winner===id,lost=winner&&winner!==id, scout=!me&&OPP_CLUBS[id];
        return `<span class="cup-team${me?" me":""}${won?" won":""}${lost?" lost":""}${scout?" scout-td":""}"${scout?` data-club="${id}"`:""}>${nm(id)}</span>`;};
      h+=`<span class="cup-match${mine?" mine":""}${(r===cup.round&&mine)?" now":""}">${chip(a)}<span class="cup-vs">v</span>${chip(b)}</span>`;
    }
    h+=`</div>`; round.innerHTML=h; wrap.appendChild(round);
  }
  if(cup.bracket.length<cup.rounds){const t=document.createElement("div");t.className="lg";t.style.fontSize="9px";t.textContent="この先の対戦は勝ち上がりで決定";wrap.appendChild(t);}
  wrap.querySelectorAll("[data-club]").forEach(el=>{el.onclick=()=>scoutClub(careerClubById(cr,el.dataset.club));}); // 表中のチーム名タップで偵察
  return wrap;
}
// カップ一覧: 各カップの規模・条件・次エントリー週。進行中はトーナメント表(ドロー)を表示。
function careerCupsView(cr){
  const wrap=document.createElement("div");
  CUPS.forEach(cup=>{
    const active=cr.cup&&cr.cup.id===cup.id, met=cup.cond(cr), nextWk=nextCupEntryWeek(cup,cr.step);
    const card=document.createElement("div");card.className="cup-card"+(active?" active":"");
    let h=`<div class="cup-head">${cup.emoji} <b>${cup.name}</b> ・ ${cup.size}強トーナメント`;
    if(active)h+=` <span style="color:var(--gold)">▶ ${roundLabel((cr.cup.bracket[cr.cup.round]||[]).length)}</span>`;
    h+=`</div><div class="lg" style="font-size:10px">出場条件: ${cup.condText} ${met?"✅":"✕"} ・ ${cup.period}の倍数週にエントリー${nextWk?`(次: 第${nextWk}週)`:""}</div>`;
    card.innerHTML=h;
    if(active)card.appendChild(cupBracketView(cr.cup,cr));
    wrap.appendChild(card);
  });
  return wrap;
}
function renderCareer(){
  const box=document.getElementById("careerBox");if(!box)return;box.innerHTML="";
  const mk=(t,cls,html)=>{const e=document.createElement(t);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
  const cr=S.career;
  box.appendChild(mk("div","banner",'― 🎓 監督キャリア ― '+helpIcon("career")));
  if(!cr){ // 未開始
    box.appendChild(mk("div","lg","限られた任期(48週)で自分だけの<b>カスタム監督</b>を育成する最上位コンテンツ。詳しくは見出しの「?」。"));
    const b=mk("button","btn");b.textContent="🎓 監督キャリアを始める";b.onclick=()=>startCareer();box.appendChild(b);
    if((S.customMgrs||[]).length)box.appendChild(mk("div","lg",`これまで育てた監督: ${S.customMgrs.length}名(監督室で起用可)`));
    return;
  }
  // ハブ(常時): ステータス + 今週の活動
  box.appendChild(careerStatusCard(cr));
  box.appendChild(careerCurrentActivity(cr));
  // セクションタブ + 内容
  box.appendChild(careerTabBar());
  const body=mk("div","career-body");box.appendChild(body);
  if(_careerTab==="schedule"){
    const list=careerScheduleList(cr,true);body.appendChild(list); // 操作はハブ側。ここは時系列のみ
    const cur=list.querySelector(".wt-card.cur");if(cur)setTimeout(()=>{try{cur.scrollIntoView({block:"center"});}catch(e){}},0);
  }else if(_careerTab==="league"){
    if(cr.stage!=="cont"&&!cr.contId){const st=careerStandingsTable(cr);if(st){body.appendChild(mk("div","banner",`― 📊 順位表(DIV${cr.div}) ―`));body.appendChild(st);}}
    body.appendChild(mk("div","banner","― 🏆 カップ/トーナメント ―"));
    body.appendChild(careerCupsView(cr));
    if(cr.stage==="cont")body.appendChild(mk("div","lg",`🌐 大陸リーグ: 制覇済 ${(cr.contWon||[]).length}/${CONTINENTS.length}。${cr.contId?"進行中":"「今週の活動」から挑戦する大陸を選択"}`));
  }else if(_careerTab==="squad"){
    if(!cr.squad)cr.squad={}; if(!Array.isArray(cr.bench))cr.bench=[];
    const cap=careerCap(cr), base=careerBaseTotal(cr), over=base>cap, drop=Math.round((1-careerOverloadMul(cr))*100);
    body.appendChild(mk("div","lg",`スカッドOVR <b style="color:${over?"#ff8e8e":"#7dff9e"}">${base}</b> / 統制OVR ${cap}${facLv(cr,"stadium")?`(基本${cr.ovrCap}+🏟)`:""}${over?` ⚠<b style="color:#ff8e8e">統制超過</b> → 全能力 <b style="color:#ff8e8e">-${drop}%</b>(監督の指揮が追いつかない)`:" ✅統制内"}`));
    const rowb=mk("div");rowb.style.cssText="display:flex;gap:6px;margin:4px 0";
    const fmB=mk("button","btn ghost");fmB.style.flex="1";fmB.style.whiteSpace="nowrap";fmB.textContent=`陣形 ${S.form}`;fmB.onclick=()=>openFormationPicker(renderCareer);rowb.appendChild(fmB);
    const autoB=mk("button","btn ghost");autoB.style.flex="1";autoB.style.whiteSpace="nowrap";autoB.textContent="自動編成";autoB.onclick=async()=>{cr.squad={};cr.bench=[];await save();renderCareer();};rowb.appendChild(autoB);
    body.appendChild(rowb);
    // ピッチ盤(通常編成と同じ仕様・共通の pitchSlots/benchSlots を使用)
    const pitch=mk("div","pitch");
    pitch.innerHTML='<div class="zones"><div class="zone fw"><span>FW</span></div><div class="zone mf"><span>MF</span></div><div class="zone df"><span>DF</span></div><div class="zone gk"><span>GK</span></div></div><div class="circle"></div>';
    body.appendChild(pitch);
    const find=id=>careerPool(cr).find(k=>k.id===id);
    renderChemLines(pitch, cr.squad, find);
    pitchSlots(pitch, {squad:cr.squad, find, onSlot:openCareerSlotPicker, tacCond:()=>null});
    const bbox=mk("div");body.appendChild(bbox);
    benchSlots(bbox, {bench:cr.bench, find, onBench:openCareerBenchPicker});
    const sq=careerSquadView(cr); // 育成固有の詳細(年齢/調子/成長)
    if(sq){body.appendChild(mk("div","banner","― 詳細: 年齢/調子/成長 ―"));body.appendChild(sq);}
  }else if(_careerTab==="club"){
    body.appendChild(mk("div","banner",`― 🏛 クラブ施設 ・ 名声 ${cr.prestige||0} ―`));
    body.appendChild(careerFacilities(cr));
  }else if(_careerTab==="manager"){
    body.appendChild(mk("div","banner","― 🎓 監督の能力 ―"));
    body.appendChild(mk("div","lg",`🔼 バフ効果(合算): ${cr.boosts.length?boostSummary(cr.boosts):"(まだ無し)"}`));
    if(cr.boosts.length>1)body.appendChild(mk("div","lg",`<span style="font-size:10px;opacity:.6">(獲得バフ ${cr.boosts.length}件を合算表示)</span>`));
    body.appendChild(mk("div","lg",`🎓 獲得采配(${(cr.tacs||[]).length}): ${(cr.tacs||[]).length?cr.tacs.map(t=>(t.flag||"")+t.name).join(" / "):"(まだ無し・カップ優勝で獲得)"}`));
  }
}
// 相手クラブの偵察(名前付き・seed固定ロスターをXIプレビュー)。opp={name,lv,form,seed,boss}。
// 順位表/トーナメント表/次戦カードのチーム名タップから共通で呼ぶ。
function scoutClub(opp){
  if(!opp)return;
  const t=oppTeam(opp.lv,{form:opp.form,seed:opp.seed});
  const ovr=Math.round(t.players.reduce((s,p)=>s+p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta,0)/t.players.length);
  renderScout(`偵察: ${opp.name}${opp.boss?" 👑":""}`,
    `平均OVR <b style="color:var(--gold)">${ovr}</b> ／ 陣形 <b>${opp.form}</b>${FORM_DESC[opp.form]?`<br><span class="lc-desc">${FORM_DESC[opp.form]}</span>`:""}`, t);
}
function careerScout(cr){ scoutClub(careerOpponent(cr)); }
// 大陸リーグ選択(DIV1制覇後)。6節制覇で系統ステboost。
function careerContPicker(){
  const cr=S.career; if(!cr||cr.contId||cr.stage!=="cont")return;
  const ov=document.createElement("div");ov.className="tac-offer";
  const inn=document.createElement("div");inn.className="tac-offer-in";
  inn.innerHTML=`<div class="banner">🌐 大陸リーグ選択</div><div class="lg">6節制覇で<b>その大陸の系統ステに特化したバフ</b>(高倍率)を獲得。制覇済みも再挑戦可。</div>`;
  CONTINENTS.forEach(c=>{
    const won=(cr.contWon||[]).filter(x=>x===c.id).length, st=MGR_STAT_JP[c.stat]||c.stat;
    const chLv=(OPP_CLUBS[c.clubs[c.clubs.length-1]]||{}).lv||9;
    const b=document.createElement("button");b.className="btn";b.style.cssText="margin-top:6px;text-align:left";
    b.innerHTML=`<b>${c.emoji} ${c.name}リーグ</b>${won?` <span class="lv" style="color:var(--gold)">制覇${won}</span>`:""}<br><span class="lv">系統: <b>${st}</b>特化バフ ・ 相手lv〜${chLv}(王者${(OPP_CLUBS[c.clubs[c.clubs.length-1]]||{}).name||""})</span>`;
    b.onclick=()=>{ov.remove();startCont(c.id);};
    inn.appendChild(b);
  });
  const bk=document.createElement("button");bk.className="btn ghost";bk.style.marginTop="8px";bk.textContent="閉じる";bk.onclick=()=>ov.remove();
  inn.appendChild(bk);ov.appendChild(inn);document.body.appendChild(ov);
}
// カップ選択(出場条件を満たすカップに挑戦)。オーバーレイで一覧表示。
function careerCupPicker(){
  const cr=S.career; if(!cr||cr.cup)return;
  const ov=document.createElement("div");ov.className="tac-offer";
  const inn=document.createElement("div");inn.className="tac-offer-in";
  inn.innerHTML=`<div class="banner">🏆 カップ挑戦</div><div class="lg">${cr.cup?"":"ドロー抽選のトーナメント。決勝まで勝ち抜くと優勝→采配スキル。負けると敗退(週は消費・引分はPK戦)。"}</div>`;
  CUPS.forEach(cup=>{
    const condOk=cup.cond(cr), entryOk=cupEntryWeek(cup,cr.step), enter=condOk&&entryOk, won=(cr.cupsWon||[]).includes(cup.id);
    const nextWk=Math.ceil((cr.step+1)/cup.period)*cup.period; // 次のエントリー週
    const status=!condOk?`🔒 ${cup.condText}`:!entryOk?`第${nextWk}週にエントリー可(${cup.period}の倍数週)`:"✅ 今週エントリー可能!";
    const reward=cup.pool==="team"?"国際チームスキル":cup.pool==="strong"?"強化采配":"基本采配";
    const b=document.createElement("button");b.className="btn"+(enter?"":" ghost");b.style.cssText="margin-top:6px;text-align:left";
    b.innerHTML=`<b>${cup.emoji} ${cup.name}</b>(${cup.size}強・${cup.period}の倍数週)${won?' <span class="lv" style="color:var(--gold)">優勝済</span>':''}<br><span class="lv">報酬: ${reward} ・ ${status}</span>`;
    if(enter)b.onclick=()=>{ov.remove();startCup(cup.id);};
    inn.appendChild(b);
  });
  const bk=document.createElement("button");bk.className="btn ghost";bk.style.marginTop="8px";bk.textContent="閉じる";bk.onclick=()=>ov.remove();
  inn.appendChild(bk);
  ov.appendChild(inn);document.body.appendChild(ov);
}
// 監督スカウト(紹介状スカウト・スカウト画面から呼ぶ): 紹介状1枚で未所持の監督を1名カタログへ。
function scoutManager(){
  if((S.introLetters||0)<1){toast("紹介状が足りません");return null;}
  const pool=MANAGERS.filter(m=>!S.mgrOwned.includes(m.id));
  if(!pool.length){toast("すべての監督をスカウト済みです");return null;}
  S.introLetters--; const m=pool[ri(0,pool.length-1)];
  S.mgrOwned.push(m.id);save();
  toast(`✉️ 監督「${m.title} ${m.name}」をスカウト! 監督室で契約できます`);
  return m;
}
function rentManager(id){
  const m=managerById(id);if(!m)return;
  if(S.mgrActive===id){toast("すでに起用中です");return;}
  if(m.custom){ // カスタム監督=自作なのでコイン不要・即起用
    if(!confirm(`カスタム監督「${m.name}」を起用しますか?\n効果: ${mgrBoostDesc(m)}${mgrTacDesc(m)?" ・ "+mgrTacDesc(m):""}`))return;
    S.mgrActive=id;save();renderOffice();toast(`🎓 ${m.name}を起用!`);return;
  }
  if(S.coins<m.cost){toast(`コインが足りません(🪙${m.cost}必要)`);return;}
  if(!confirm(`${m.title}「${m.name}」と 🪙${m.cost} で契約し起用しますか?\n効果: ${mgrBoostDesc(m)}`))return;
  S.coins-=m.cost;S.mgrActive=id;coinUI();save();renderOffice();
  toast(`🎯 ${m.title}を起用! ${mgrBoostDesc(m)}`);
}
function renderFriendRec(){
  const box=document.getElementById("ofRec");box.innerHTML="";
  const mk=(t,cls)=>{const e=document.createElement(t);if(cls)e.className=cls;return e;};
  const h=mk("div","banner");h.style.cssText="font-size:14px";h.textContent="― フレンド対戦戦績 ―";box.appendChild(h);
  const rec=S.friendRec||{},keys=Object.keys(rec);
  if(!keys.length){const e=mk("div","lg");e.textContent="まだフレンド対戦の記録がありません。「🤝対戦」から挑戦しましょう。";box.appendChild(e);return;}
  keys.forEach(k=>{const r=rec[k],dd=mk("div","wt-card");
    dd.innerHTML=`<div class="wt-info"><div class="wt-name">${k}</div><div class="lv">${r.w||0}勝 ${r.d||0}分 ${r.l||0}敗</div></div>`;box.appendChild(dd);});
}
// 監督室の指定サブタブへ移動(フッタータブ経由でshow("office")→renderOffice)。
function gotoOffice(tab){ if(tab)_ofTab=tab; const b=document.querySelector('[data-s="office"]'); if(b)b.click(); }
// ホーム表示時に「現在アクティブなモード」を再描画(タブ戻り時に古い表示が残らないように)。
function renderHome(){
  const on=document.querySelector("#modeRow [data-m].on");
  const m=on?on.dataset.m:"stage";
  const wb=document.querySelector('#modeRow [data-m="world"]');
  if(wb)wb.style.display=(S.cleared>=CLUBS.length)?"":"none"; // 解放状態を常に反映
  if(m==="league")renderLeagueMode();
  else if(m==="world")renderWorld();
  else if(m==="daily")renderDaily();
  else renderLeague();
}
// モード切替(stage / league / daily / world)。監督育成は下部メニューの独立モード(scr-career)。
document.querySelectorAll("#modeRow [data-m]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("#modeRow [data-m]").forEach(x=>x.classList.toggle("on",x===b));
  const m=b.dataset.m;
  document.getElementById("stageMode").style.display=m==="stage"?"block":"none";
  document.getElementById("leagueMode").style.display=m==="league"?"block":"none";
  document.getElementById("dailyMode").style.display=m==="daily"?"block":"none";
  document.getElementById("worldMode").style.display=m==="world"?"block":"none";
  if(m==="league")renderLeagueMode();else if(m==="world")renderWorld();else if(m==="daily")renderDaily();else renderLeague();
});
