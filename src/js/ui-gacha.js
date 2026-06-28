// ================= ガチャ =================
// パック定義(データ駆動)。新パックはここに追加するだけで一覧・開封演出に乗る。
const PACKS=[
  {id:"player",name:"選手パック",emoji:"🃏",color:"#7c6bd9",cost:100,n:3,
   desc:"3枚入り / SR5% R25% N70%",
   can:()=>S.coins>=100, pay:()=>{S.coins-=100;}, owned:null,
   get:()=>[makeCard(),makeCard(),makeCard()]},
  {id:"highclass",name:"ハイクラスパック",emoji:"💎",color:"#5ec8ff",cost:5000,n:1,
   desc:"1枚入り / シグネチャー or LEGEND 確定",
   can:()=>S.coins>=5000, pay:()=>{S.coins-=5000;}, owned:null,
   get:()=>[Math.random()<0.40?drawSignatureCard():makeCard(null,"l")]}, // 40%でシグネチャー(内ごく稀にエモーショナル)、他はLEGEND確定
  {id:"legend",name:"レジェンドパック",emoji:"🏆",color:"#e8c25a",cost:null,n:1,
   desc:"1枚入り / LEGEND25% SR55% R20%・試合後ドロップ",
   can:()=>(S.legendPacks||0)>0, pay:()=>{S.legendPacks=(S.legendPacks||0)-1;}, owned:()=>S.legendPacks||0,
   get:()=>{const x=Math.random(),rar=x<0.25?"l":x<0.8?"sr":"r";return [makeCard(null,rar)];}},
  {id:"champion",name:"チャンピオンパック",emoji:"🏅",color:"#46d3a0",cost:null,n:5,
   desc:"5枚入り / SR以上1枚確定+高排出・リーグ優勝報酬",
   can:()=>(S.championPacks||0)>0, pay:()=>{S.championPacks=(S.championPacks||0)-1;}, owned:()=>S.championPacks||0,
   get:()=>championDraw()},
  {id:"signature",name:"シグネチャーパック",emoji:"🌟",color:"#ff5ea0",cost:null,n:1,
   desc:"1枚入り / 未所持の固有選手を優先確定・実績報酬",
   can:()=>(S.sigPacks||0)>0, pay:()=>{S.sigPacks=(S.sigPacks||0)-1;}, owned:()=>S.sigPacks||0,
   get:()=>[drawSignatureCard()]},
];
// まだ持っていないエモーショナルの一覧(所持判定は sig idで共有)。
function unownedEmotionals(){const own=ownedSigSet();return EMOTIONALS.filter(s=>!own.has(s.id));}
// シグネチャー1枚を抽選(未所持優先)。シークレット: ごく低確率(1%)で最上位「エモーショナル」が出現。
// シグネチャーパック/ハイクラスパックで共用(=コインからもエモーショナルに到達できる)。
function drawSignatureCard(){
  if(typeof EMOTIONALS!=="undefined"&&EMOTIONALS.length&&Math.random()<0.01){
    const ep=unownedEmotionals();return makeEmotional(rnd(ep.length?ep:EMOTIONALS).id);
  }
  const pool=unownedSignatures();return makeSignature(rnd(pool.length?pool:SIGNATURES).id);
}
// 既に所持している固有選手のid集合(コレクション内に同じ sig を持つカードがあるか)。
function ownedSigSet(){return new Set(S.coll.filter(c=>c.sig).map(c=>c.sig));}
// まだ持っていない固有選手の一覧。全員所持済みなら空配列(呼び出し側で全プールにフォールバック)。
function unownedSignatures(){const own=ownedSigSet();return SIGNATURES.filter(s=>!own.has(s.id));}
// チャンピオンパック: 5枚。高排出4枚 + SR以上1枚確定(うち18%でLEGEND)
function championDraw(){
  const out=[];
  for(let i=0;i<4;i++){const x=Math.random();out.push(makeCard(null,x<0.10?"l":x<0.45?"sr":x<0.85?"r":"n"));}
  out.push(makeCard(null,Math.random()<0.18?"l":"sr"));
  return out;
}
function packById(id){return PACKS.find(p=>p.id===id);}
function renderGacha(){
  const list=document.getElementById("packList");if(!list)return;list.innerHTML="";
  PACKS.forEach(p=>{
    const owned=p.owned?p.owned():null, avail=p.can();
    const t=document.createElement("div");
    t.className="packtile"+(avail?"":" off");t.style.setProperty("--pc",p.color);
    const meta=p.cost!=null?`🪙${p.cost}`:(owned!=null?`所持 ${owned}`:"");
    t.innerHTML=`<div class="pemoji">${p.emoji}</div><div class="pname">${p.name}</div>`
      +`<div class="pmeta">${meta}</div><div class="pdesc">${p.desc}</div>`
      +`<div class="popen">${avail?"開封する":(p.cost!=null?"コイン不足":"未所持")}</div>`;
    t.onclick=()=>openPackById(p.id);
    list.appendChild(t);
  });
  // シグネチャー選択券: 所持している時だけ表示(好きな固有選手を1人選べる・特別な実績報酬)
  const sel=S.sigSelect||0;
  if(sel>0){
    const t=document.createElement("div");
    t.className="packtile";t.style.setProperty("--pc","#ffd24a");
    t.innerHTML=`<div class="pemoji">🎟️</div><div class="pname">シグネチャー選択券</div>`
      +`<div class="pmeta">所持 ${sel}</div><div class="pdesc">好きな固有選手を1人選んで獲得!</div>`
      +`<div class="popen">選んで獲得</div>`;
    t.onclick=openSignaturePicker;
    list.appendChild(t);
  }
  // 監督スカウト: 紹介状(リーグ周回報酬)で監督を1名獲得 → 監督室で契約(✉️所持時のみ表示)
  const lets=S.introLetters||0;
  if(lets>0){
    const all=(S.mgrOwned||[]).length>=MANAGERS.length;
    const t=document.createElement("div");
    t.className="packtile"+(all?" off":"");t.style.setProperty("--pc","#54d6c8");
    t.innerHTML=`<div class="pemoji">🎯</div><div class="pname">監督スカウト</div>`
      +`<div class="pmeta">✉️ ${lets}</div><div class="pdesc">${all?"全監督スカウト済み":"紹介状で監督を1名獲得!監督室で契約"}</div>`
      +`<div class="popen">${all?"コンプ":"スカウト"}</div>`;
    if(!all)t.onclick=()=>{if(_revealing)return;const m=scoutManager();renderGacha();if(m)mgrScoutReveal(m);};
    list.appendChild(t);
  }
}
// 監督スカウトの結果演出(全身絵+名前を中央に・タップ/数秒で閉じる)
function mgrScoutReveal(m){
  const o=document.createElement("div");o.className="mgr-reveal";
  const inn=document.createElement("div");inn.className="mgr-reveal-in";
  const b=document.createElement("div");b.className="banner";b.textContent="🎯 監督をスカウト!";inn.appendChild(b);
  inn.appendChild(mgrPortrait(m,190));
  const nm=document.createElement("div");nm.className="banner";nm.style.fontSize="16px";
  nm.innerHTML=`${m.title}<div class="lg">${m.name} ・ 🔼 ${mgrBoostDesc(m)}${m.tac?` ・ 采配「${m.tac.name}」`:""}</div>`;inn.appendChild(nm);
  o.appendChild(inn);o.onclick=()=>o.remove();document.body.appendChild(o);
  setTimeout(()=>{if(o.parentNode)o.remove();},3800);
}
// 選択券: 固有選手の一覧から1人を選び、その場で獲得(演出付き)。
function openSignaturePicker(){
  if(_revealing)return;
  if((S.sigSelect||0)<=0){toast("選択券を持っていません");return;}
  const modal=document.getElementById("sigPickModal");
  const grid=document.getElementById("sigPickGrid");grid.innerHTML="";
  const own=ownedSigSet();
  const allOwned=own.size>=SIGNATURES.length; // 全員所持済みのみ、券を無駄にしないため重複選択を許可
  SIGNATURES.forEach(sg=>{
    const c=makeSignature(sg.id);          // プレビュー用カード(獲得時に作り直す)
    const el=cardEl(c);
    if(own.has(sg.id)&&!allOwned){          // 所持済みは選べない(無駄引き防止)。一覧には残してコンプ感を見せる
      el.classList.add("sig-owned");
      el.title="所持済み";
    }else{
      el.classList.add("pickable");
      el.onclick=()=>pickSignature(sg.id);
    }
    grid.appendChild(el);
  });
  modal.classList.add("on");
}
async function pickSignature(id){
  if((S.sigSelect||0)<=0)return;
  if(S.coll.length>=COLL_CAP){toast(`クラブが満員です(最大${COLL_CAP}名)。図鑑で不要なカードを売却してください`);return;}
  if(ownedSigSet().has(id)&&ownedSigSet().size<SIGNATURES.length){toast("その選手は既に所持しています");return;} // 念のための二重ガード(全員所持時は重複可)
  document.getElementById("sigPickModal").classList.remove("on");
  S.sigSelect=(S.sigSelect||0)-1;
  const card=makeSignature(id);
  S.coll.push(card);
  coinUI();await save();renderGacha();
  _revealing=true;
  await runReveal({name:"シグネチャー選択券",emoji:"🎟️",color:"#ffd24a",can:()=>false},[card]);
  _revealing=false;
}
document.getElementById("sigPickClose").onclick=()=>document.getElementById("sigPickModal").classList.remove("on");
let _revealing=false;
function drawPack(id){ // 純ロジック(演出なし):引けたらカード配列、不可なら null。テスト/将来の自動化から再利用可。
  const p=packById(id);if(!p||!p.can())return null;
  if(S.coll.length+(p.n||1)>COLL_CAP)return null; // クラブ満員(最大500)では引けない
  p.pay();const cards=p.get();cards.forEach(c=>S.coll.push(c));return cards;
}
async function openPackById(id){
  if(_revealing)return;
  const p=packById(id);if(!p)return;
  if(!p.can()){toast(p.cost!=null?"コインが足りません!リーグ戦で稼ごう":"このパックは未所持(試合後にドロップ)");return;}
  if(S.coll.length+(p.n||1)>COLL_CAP){toast(`クラブが満員です(最大${COLL_CAP}名)。図鑑で不要なカードを売却してください`);return;}
  if((p.cost||0)>=1000&&!confirm(`${p.name}を🪙${p.cost}で開封しますか?`))return; // 高額パックは誤タップ防止の確認
  _revealing=true;
  let again=true;
  while(again){
    const cards=drawPack(id);
    if(!cards){toast(`クラブが満員です(最大${COLL_CAP}名)。図鑑で不要なカードを売却してください`);break;} // 連続開封中に満員へ到達
    coinUI();await save();renderGacha();
    again=await runReveal(p,cards);
  }
  _revealing=false;
}
function runReveal(p,cards){
  return new Promise(resolve=>{
    const ord={emo:-1,l:0,sr:1,r:2,n:3};
    const best=cards.reduce((a,c)=>ord[c.rar]<ord[a.rar]?c:a,cards[0]);
    const ov=document.getElementById("packOverlay"),stage=document.getElementById("packStage");
    ov.className="packov show";
    stage.innerHTML=`<div class="bigpack floatup" id="bigpack" style="--pc:${p.color}"><div class="bp-shine"></div><div class="bp-emoji">${p.emoji}</div><div class="bp-name">${p.name}</div></div>`
      +`<div class="taphint" id="tapHint">タップで開封!</div><div class="burstcards" id="burstCards"></div><div class="revresult" id="revResult"></div>`;
    const bigpack=document.getElementById("bigpack");
    let opened=false;
    const finish=again=>{ov.className="packov";stage.innerHTML="";resolve(again);};
    const doOpen=async()=>{
      if(opened)return;opened=true;
      const hint=document.getElementById("tapHint");if(hint)hint.style.display="none";
      bigpack.classList.add("burst");
      const fl=document.createElement("div");fl.className="packflash";stage.appendChild(fl);
      await sleep(380);bigpack.style.display="none";fl.remove();
      const bc=document.getElementById("burstCards");
      cards.forEach((c,i)=>{const el=cardEl(c);el.classList.add("flyin");el.style.animationDelay=(i*0.14)+"s";bc.appendChild(el);});
      await sleep(360+cards.length*140);
      const rr=document.getElementById("revResult");
      const emo=cards.find(c=>c.emo), sig=cards.find(c=>c.sig&&!c.emo);
      if(emo){rr.className="revresult emo";rr.innerHTML=`🌌 EMOTIONAL 出現!! 記憶が蘇る——<br>${emo.flag} ${emo.name}・${emo.moment||""}`;}
      else if(sig){rr.className="revresult leg";rr.innerHTML=`🌟 シグネチャー選手 登場!! ${sig.flag} ${sig.name}!!`;}
      else if(best.rar==="l"){rr.className="revresult leg";rr.innerHTML="🌈 LEGEND 出現!! 伝説の選手だ!!";}
      else if(best.rar==="sr"){rr.className="revresult sr";rr.innerHTML="✨ ★★★ SR ゲット!";}
      else{rr.className="revresult";rr.innerHTML="";}
      const canAgain=p.can();
      const row=document.createElement("div");row.className="row";
      if(canAgain){
        const ab=document.createElement("button");ab.className="btn";ab.textContent="もう1回引く";
        ab.onclick=()=>finish(true);row.appendChild(ab);
      }
      const cb=document.createElement("button");cb.className=canAgain?"btn ghost":"btn";cb.textContent="とじる";
      cb.onclick=()=>finish(false);row.appendChild(cb);
      rr.appendChild(row);
    };
    bigpack.addEventListener("click",doOpen);
    document.getElementById("tapHint").addEventListener("click",doOpen);
    setTimeout(()=>{if(!opened)doOpen();},1700); // 一定時間で自動開封
  });
}

