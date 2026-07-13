// ================= 状態と保存 =================
let S={coins:300,coll:[],squad:{},bench:[],form:"4-4-2",cleared:0,tactic:"bal",v:9,legendPacks:0,championPacks:0,sigPacks:0,sigSelect:0,leagueWins:0,tour:{i:0,res:[]},tourPerfect:0,coach:"",teamName:"",favId:0,friendRec:{},ms:{},league:null,mgrOwned:[],mgrActive:"",introLetters:0,customMgrs:[]};
const SAVE_KEY="ci-save";
const COLL_CAP=500; // クラブに保存できる選手の最大数(超過しないよう入手時にガード)
// 永続化: 旧環境の window.storage(非同期)があれば優先、無ければブラウザの localStorage(同期)。
// これにより通常のブラウザ/GitHub Pages でも進行が実際に保存される。
async function readSave(){ // 保存済みJSON文字列(無ければnull)
  if(typeof window!=="undefined"&&window.storage){
    try{const r=await withTimeout(window.storage.get(SAVE_KEY),3000);return (r&&r.value)||null;}catch(e){return null;}
  }
  try{return localStorage.getItem(SAVE_KEY);}catch(e){return null;}
}
// 実書き込み(コレクション全体をstringify)。直接は呼ばず save()/flushSave() 経由。
async function _writeSave(){
  _saveDirty=false; S.nextId=uid;
  const v=JSON.stringify(S);
  if(typeof window!=="undefined"&&window.storage){try{await withTimeout(window.storage.set(SAVE_KEY,v),2500);}catch(e){}}
  else{try{localStorage.setItem(SAVE_KEY,v);}catch(e){}}
}
let _saveTimer=null, _saveDirty=false;
// 保存はデバウンス: 連続save()を1回の書き込みにまとめ、大量所持時のstringify負荷/ジャンクを軽減。
// 取りこぼし防止に、画面非表示/離脱時は必ずフラッシュする。即時resolveなのでawait save()はそのまま使える。
function save(){
  _saveDirty=true;
  if(!_saveTimer){_saveTimer=setTimeout(()=>{_saveTimer=null;if(_saveDirty)_writeSave();},600);
    if(_saveTimer&&_saveTimer.unref)_saveTimer.unref();} // node(テスト)でプロセスを引き止めない
  return Promise.resolve();
}
function flushSave(){ if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;} if(_saveDirty)return _writeSave(); }
if(typeof window!=="undefined"&&window.addEventListener){
  if(typeof document!=="undefined"&&document.addEventListener)
    document.addEventListener("visibilitychange",()=>{if(document.hidden)flushSave();});
  window.addEventListener("pagehide",flushSave);
  window.addEventListener("beforeunload",flushSave);
}
async function hasSave(){return !!(await readSave());}
function deleteSave(){
  _saveDirty=false; if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;} // 保留中のデバウンス保存を破棄(削除後に復活させない)
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
  // v10: 名声/施設をアカウント恒久化(キャリアの現行値を引き継ぎ + 進捗に応じた開設ボーナスを実績風に一度だけ付与)
  if(S.v<10){
    if(S.prestige==null)S.prestige=(S.career&&S.career.prestige)||0;
    S.fac=S.fac||((S.career&&S.career.fac)||{});
    ["stadium","academy","medical","coaching","scouting"].forEach(k=>{if(S.fac[k]==null)S.fac[k]=0;});
    if(!S._facGranted){ const g=facilityWelcomeGrant(); S.prestige+=g.p; S.fac.coaching=Math.max(S.fac.coaching,g.coach); S._facWelcome=g; S._facGranted=1; }
  }
  S.v=10;
}
// 新規データ(初期デッキ)を構築。はじめから用。固有選手は実績(マイルストーン)で入手する。
function applyDefaults(){
  S={coins:300,coll:[],squad:{},form:"4-4-2",cleared:0,tactic:"bal",v:10,legendPacks:0,championPacks:0,sigPacks:0,sigSelect:0,leagueWins:0,tour:{i:0,res:[]},tourPerfect:0,coach:"",teamName:"",favId:0,friendRec:{},ms:{},league:null,mgrOwned:[],mgrActive:"",introLetters:0,customMgrs:[],prestige:0,fac:{stadium:0,academy:0,medical:0,coaching:0,scouting:0},_facGranted:1,rookieViz:ri(0,7)};
  applyRookieViz();
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
  S.customMgrs=S.customMgrs||[]; // カスタム監督(監督キャリアモードで生成)
  S.customMgrs.forEach(m=>{if(m&&m.ctrlOVR==null)m.ctrlOVR=900;}); // 旧カスタム監督に統制OVRを後付け(既定900)
  // 起用中監督が名将にもカスタムにも無ければ解任(旧データ整合)
  if(S.mgrActive&&!managerById(S.mgrActive))S.mgrActive="";
  if(S.v<10){migrate();await save();}
  // 施設/名声の後方互換(版に依らず欠落補完)
  if(S.prestige==null)S.prestige=0;
  S.fac=S.fac||{}; ["stadium","academy","medical","coaching","scouting"].forEach(k=>{if(S.fac[k]==null)S.fac[k]=0;});
  // 監督ビジュアル: 見習いのviz・既存カスタム監督/キャリアの見た目を補完
  if(S.rookieViz==null)S.rookieViz=ri(0,7);
  applyRookieViz();
  (S.customMgrs||[]).forEach(m=>{if(m&&m.col==null){const v=vizColRow(ri(0,7));m.col=v.col;m.row=v.row;}});
  if(S.career&&S.career.viz==null)S.career.viz=ri(0,7);
  let _aged=false; (S.coll||[]).forEach(c=>{if(c.age==null){c.age=defaultAge(c);_aged=true;}}); // 年齢の後方互換補完(版に依らず)
  if(_aged)await save();
  if(!Array.isArray(S.bench))S.bench=[];                       // ベンチ(交代枠)の後方互換
  if(S.career&&!Array.isArray(S.career.bench))S.career.bench=[];
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
function coinUI(){const e=document.getElementById("coinN");if(e)e.textContent=S.coins;}
function myName(){return (S.teamName||"").trim()||"マイチーム";} // 自チーム表示名(プロフィール)
// 共通ヘッダー(オーナー名・チーム名)を更新。コインは coinUI()。
function renderHeader(){
  const o=document.getElementById("ahOwner"), t=document.getElementById("ahTeam");
  if(o)o.textContent="👤 "+(((typeof S.coach==="string"&&S.coach.trim())||"オーナー"));
  if(t)t.textContent=myName();
}
// ===== ヘルプ(?)機構: 説明文を「?」に収納し、タップでポップアップ表示してUIをクリーンに =====
// helpIcon(key) を見出し等に埋め込み、タップで HELP[key] をポップアップ。data-help属性を委譲処理。
function helpIcon(key){return '<span class="help" data-help="'+key+'" role="button" aria-label="説明">?</span>';}
function showHelp(html){
  const ov=document.createElement("div");ov.className="help-pop";
  ov.innerHTML='<div class="help-pop-in">'+(html||"")+'<div class="help-close">タップで閉じる</div></div>';
  ov.onclick=()=>ov.remove();
  document.body.appendChild(ov);
}
if(typeof document!=="undefined"&&document.addEventListener){
  document.addEventListener("click",e=>{const h=e.target.closest&&e.target.closest(".help");
    if(h){e.stopPropagation();showHelp((typeof HELP!=="undefined"&&HELP[h.dataset.help])||h.dataset.help||"");}});
}
// ===== デイリークエスト: 毎日ランダムに2チーム(現状ワールドツアー)を挑戦。全勝でシグネチャーチケット1枚/日。 =====
const DAILY_COUNT=2; // 1日の挑戦チーム数
function todayStr(){const d=new Date();return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();}
function _hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
// その日付でランダムに DAILY_COUNT チームを固定選出(seedで日毎に一定・リロードで変わらない)。
function pickDailyTeams(dateStr){
  const restore=seedRandom(_hashStr(dateStr));
  const idxs=[...Array(WORLD_NATIONS.length).keys()], picks=[];
  for(let i=0;i<DAILY_COUNT&&idxs.length;i++){picks.push({mode:"world",idx:idxs.splice(Math.floor(Math.random()*idxs.length),1)[0]});}
  restore();
  return picks;
}
// 当日分のデイリーを保証(日付が変わっていれば作り直し)。
function ensureDaily(){
  const t=todayStr();
  if(!S.daily||S.daily.date!==t){
    const teams=pickDailyTeams(t);
    S.daily={date:t, teams, done:teams.map(()=>false), claimed:false};
    save();
  }
  return S.daily;
}

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
  document.body.classList.remove("in-match"); // 画面遷移=試合外
  renderHeader();
  if(s==="title")renderTitleHero();
  if(s==="team")renderPitch();if(s==="coll")renderColl();if(s==="home")renderHome();
  if(s==="gacha")renderGacha();if(s==="office")renderOffice();if(s==="career")renderCareer();
  updateSubnav(s);
}
// フッター直上のサブメニュー切替: アクティブ画面に対応する1行だけ表示し、フッターの真上へ配置。
function updateSubnav(s){
  const sn=document.getElementById("subnav"); if(!sn)return;
  const map={home:"modeRow", career:"careerSub", office:"ofTabs"};
  const active=map[s]||null; let shown=false;
  ["modeRow","careerSub","ofTabs"].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    const use=(id===active)&&(id!=="careerSub"||el.childElementCount>0); // キャリア未開始はタブ無し→非表示
    el.style.display=use?"":"none"; if(use)shown=true;
  });
  sn.classList.toggle("on",shown);
  document.body.classList.toggle("has-subnav",shown);
  const tabs=document.querySelector(".tabs"); if(tabs)sn.style.bottom=tabs.offsetHeight+"px"; // フッター実高の真上
}

