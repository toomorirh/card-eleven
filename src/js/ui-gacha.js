// ================= ガチャ =================
// パック定義(データ駆動)。新パックはここに追加するだけで一覧・開封演出に乗る。
const PACKS=[
  {id:"player",name:"選手パック",emoji:"🃏",color:"#7c6bd9",cost:100,
   desc:"3枚入り / SR5% R25% N70%",
   can:()=>S.coins>=100, pay:()=>{S.coins-=100;}, owned:null,
   get:()=>[makeCard(),makeCard(),makeCard()]},
  {id:"legend",name:"レジェンドパック",emoji:"🏆",color:"#e8c25a",cost:null,
   desc:"1枚入り / LEGEND25% SR55% R20%・試合後ドロップ",
   can:()=>(S.legendPacks||0)>0, pay:()=>{S.legendPacks=(S.legendPacks||0)-1;}, owned:()=>S.legendPacks||0,
   get:()=>{const x=Math.random(),rar=x<0.25?"l":x<0.8?"sr":"r";return [makeCard(null,rar)];}},
  {id:"champion",name:"チャンピオンパック",emoji:"🏅",color:"#46d3a0",cost:null,
   desc:"5枚入り / SR以上1枚確定+高排出・リーグ優勝報酬",
   can:()=>(S.championPacks||0)>0, pay:()=>{S.championPacks=(S.championPacks||0)-1;}, owned:()=>S.championPacks||0,
   get:()=>championDraw()},
  {id:"signature",name:"シグネチャーパック",emoji:"🌟",color:"#ff5ea0",cost:null,
   desc:"1枚入り / 固有選手(★★★★)確定",
   can:()=>(S.sigPacks||0)>0, pay:()=>{S.sigPacks=(S.sigPacks||0)-1;}, owned:()=>S.sigPacks||0,
   get:()=>[makeSignature(rnd(SIGNATURES).id)]},
];
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
}
let _revealing=false;
function drawPack(id){ // 純ロジック(演出なし):引けたらカード配列、不可なら null。テスト/将来の自動化から再利用可。
  const p=packById(id);if(!p||!p.can())return null;
  p.pay();const cards=p.get();cards.forEach(c=>S.coll.push(c));return cards;
}
async function openPackById(id){
  if(_revealing)return;
  const p=packById(id);if(!p)return;
  if(!p.can()){toast(p.cost!=null?"コインが足りません!リーグ戦で稼ごう":"このパックは未所持(試合後にドロップ)");return;}
  _revealing=true;
  let again=true;
  while(again){
    const cards=drawPack(id);
    coinUI();await save();renderGacha();
    again=await runReveal(p,cards);
  }
  _revealing=false;
}
function runReveal(p,cards){
  return new Promise(resolve=>{
    const ord={l:0,sr:1,r:2,n:3};
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
      const sig=cards.find(c=>c.sig);
      if(sig){rr.className="revresult leg";rr.innerHTML=`🌟 シグネチャー選手 登場!! ${sig.flag} ${sig.name}!!`;}
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

