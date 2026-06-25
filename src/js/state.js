// ================= 状態と保存 =================
let S={coins:300,coll:[],squad:{},form:"4-4-2",cleared:0,tactic:"bal",v:9,legendPacks:0,championPacks:0,sigPacks:0,sigSelect:0,leagueWins:0,tour:{i:0,res:[]},tourPerfect:0,coach:"",teamName:"",favId:0,friendRec:{},ms:{},league:null,mgrOwned:[],mgrActive:"",introLetters:0};
const SAVE_KEY="ci-save";
// 永続化: 旧環境の window.storage(非同期)があれば優先、無ければブラウザの localStorage(同期)。
// これにより通常のブラウザ/GitHub Pages でも進行が実際に保存される。
async function readSave(){ // 保存済みJSON文字列(無ければnull)
  if(typeof window!=="undefined"&&window.storage){
    try{const r=await withTimeout(window.storage.get(SAVE_KEY),3000);return (r&&r.value)||null;}catch(e){return null;}
  }
  try{return localStorage.getItem(SAVE_KEY);}catch(e){return null;}
}
async function save(){
  S.nextId=uid;
  const v=JSON.stringify(S);
  if(typeof window!=="undefined"&&window.storage){try{await withTimeout(window.storage.set(SAVE_KEY,v),2500);}catch(e){}}
  else{try{localStorage.setItem(SAVE_KEY,v);}catch(e){}}
}
async function hasSave(){return !!(await readSave());}
function deleteSave(){
  if(typeof window!=="undefined"&&window.storage){try{window.storage.set(SAVE_KEY,"");}catch(e){}}
  try{localStorage.removeItem(SAVE_KEY);}catch(e){}
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
// 新規データ(初期デッキ)を構築。はじめから用。固有選手は実績(マイルストーン)で入手する。
function applyDefaults(){
  S={coins:300,coll:[],squad:{},form:"4-4-2",cleared:0,tactic:"bal",v:9,legendPacks:0,championPacks:0,sigPacks:0,sigSelect:0,leagueWins:0,tour:{i:0,res:[]},tourPerfect:0,coach:"",teamName:"",favId:0,friendRec:{},ms:{},league:null,mgrOwned:[],mgrActive:"",introLetters:0};
  FORMS["4-4-2"].forEach((sl,i)=>{
    const sub=sl[0],c=makeCard(subGroup(sub),i===9?"r":"n",null,sub);
    S.coll.push(c);S.squad[i]=c.id;});
  S.coll.push(makeCard("MF","r"),makeCard("FW","n"),makeCard("DF","n"));
}
async function newGame(){ applyDefaults(); await save(); }     // はじめから(呼び出し側で上書き確認)
async function loadGame(){                                       // つづきから(セーブが無ければ新規)
  const v=await readSave();
  if(!v){applyDefaults();await save();return;}
  try{S=JSON.parse(v);uid=S.nextId||1000;}catch(e){applyDefaults();await save();return;}
  S.mgrOwned=(S.mgrOwned||[]).filter(id=>MANAGERS.some(m=>m.id===id)); // 名将(v9据え置き・欠落補完/旧id除去)
  S.mgrActive=S.mgrActive||"";S.introLetters=S.introLetters||0;
  if(!MANAGERS.some(m=>m.id===S.mgrActive))S.mgrActive="";
  if(S.v!==9){migrate();await save();}
  if(checkAchievements())await save();  // 旧セーブが既に条件を満たしていれば付与
}
// 後方互換(テスト/旧呼び出し): スプライト準備を待ってから、既存セーブを読込or新規。
async function load(){
  await withTimeout(SPR_READY,4500);
  await loadGame();
}
// 実績の報酬を付与(sigPacks=ランダムパック / sigSelect=選択券 / championPacks=チャンピオンパック)。
function grantReward(r){
  if(!r)return;
  if(r.sigPacks)S.sigPacks=(S.sigPacks||0)+r.sigPacks;
  if(r.sigSelect)S.sigSelect=(S.sigSelect||0)+r.sigSelect;
  if(r.championPacks)S.championPacks=(S.championPacks||0)+r.championPacks;
}
// 実績判定: 未達成かつ条件成立の実績に報酬を付与(達成済みは S.ms で記録=冪等)。何か付与したら true。
function checkAchievements(){
  S.ms=S.ms||{};let got=false;
  for(const a of ACHIEVEMENTS){
    if(!S.ms[a.id]&&a.test()){
      S.ms[a.id]=1;grantReward(a.reward);
      toast(`${a.icon} 実績解除「${a.title}」${a.rewardLabel}を獲得!`);
      got=true;
    }
  }
  return got;
}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.style.display="block";
  clearTimeout(toast._tm);toast._tm=setTimeout(()=>t.style.display="none",2200);}
function coinUI(){document.getElementById("coinN").textContent=S.coins;}
function myName(){return (S.teamName||"").trim()||"マイチーム";} // 自チーム表示名(プロフィール)

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
  if(s==="team")renderPitch();if(s==="coll")renderColl();if(s==="home")renderHome();
  if(s==="gacha")renderGacha();if(s==="office")renderOffice();
}

