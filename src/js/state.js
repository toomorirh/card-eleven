// ================= 状態と保存 =================
let S={coins:300,coll:[],squad:{},form:"4-4-2",cleared:0,tactic:"bal",v:9,legendPacks:0,championPacks:0,sigPacks:0,league:null};
async function save(){
  S.nextId=uid;
  try{if(window.storage)await withTimeout(window.storage.set("ci-save",JSON.stringify(S)),2500);}catch(e){}
}
function migrate(){ // 旧カード → 6パラメータ+スキル+ドット絵パーツ
  S.coll=S.coll.map(o=>{
    let c=o;
    if(c.off==null){
      const sv=genStats(c.rar);
      c={...c,off:c.atk!=null?c.atk:sv[0],def:c.def!=null?c.def:sv[1],pow:sv[2],tec:sv[3],spd:sv[4],sta:sv[5],skill:rollSkill(c.pos,c.rar)};
    }
    if(!c.look)c.look=makeLook(c.pos,c.rar);
    if(!c.look.pose)c.look.pose=rnd(POSES_BY[c.pos]);
    if(c.look.jaw==null){c.look.jaw=ri(0,2);c.look.brow=ri(0,2);c.look.nose=ri(0,2);c.look.mouth=ri(0,3);c.look.beard=ri(0,3);}
    if(c.look.headIdx==null){c.look.headIdx=ri(0,31);c.look.bodyVar=ri(0,3);}
    if(!c.type)c.type=rollType(c.pos);
    if(!c.sub)c.sub=rnd(SUBS_BY[c.pos]||["CMF"]); // v9: 細分ポジション付与
    return c;
  });
  // v8: 1-9 → 1-20 リスケール(レア度別の目標合計へ)
  if(S.v<8){
    S.coll.forEach(c=>{
      if(c.off!=null && (c.off+c.def+c.pow+c.tec+c.spd+c.sta)<=54){ // 旧スケール(合計54以下)のみ
        scaleTo(c,RAR_TOTAL[c.rar]||55);
      }
    });
  }
  S.v=9;
}
async function load(){
  await withTimeout(SPR_READY,4500);
  try{
    if(window.storage){
      const r=await withTimeout(window.storage.get("ci-save"),3000);
      if(r&&r.value){S=JSON.parse(r.value);uid=S.nextId||1000;
        if(S.v!==9){migrate();await save();}
        if(grantSignatureTest())await save();
        return;}
    }
  }catch(e){/* 初回は未保存 */}
  FORMS["4-4-2"].forEach((sl,i)=>{
    const sub=sl[0],c=makeCard(subGroup(sub),i===9?"r":"n",null,sub);
    S.coll.push(c);S.squad[i]=c.id;});
  S.coll.push(makeCard("MF","r"),makeCard("FW","n"),makeCard("DF","n"));
  grantSignatureTest();
  await save();
}
// テスト用: スタート時にシグネチャーパックを1枚だけ付与(1回限り)。
// 本来の入手条件は後でゲーム内に実装予定。それまではこのチケットでガチャを試せる。
function grantSignatureTest(){
  if(S.sigTicketTest)return false;
  S.sigPacks=(S.sigPacks||0)+1;
  S.sigTicketTest=1;
  return true;
}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.style.display="block";
  clearTimeout(toast._tm);toast._tm=setTimeout(()=>t.style.display="none",2200);}
function coinUI(){document.getElementById("coinN").textContent=S.coins;}

// ================= 画面切替 =================
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{
  if(MC){toast("試合中です!");return;}
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x===b));
  show(b.dataset.s);
});
function show(s){
  document.querySelectorAll(".screen").forEach(x=>x.classList.remove("on"));
  document.getElementById("scr-"+s).classList.add("on");
  const wrap=document.querySelector(".wrap");
  if(s==="title"){wrap.classList.remove("no-title");}
  else{wrap.classList.add("no-title");}
  document.body.classList.toggle("on-title",s==="title"); // タイトル中は下部メニュー/コインを隠す
  if(s==="title")renderTitleHero();
  if(s==="team")renderPitch();if(s==="coll")renderColl();if(s==="home")renderLeague();
  if(s==="gacha")renderGacha();
}

