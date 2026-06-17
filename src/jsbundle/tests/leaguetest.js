const _st=global.setTimeout;
global.setTimeout=(f,ms)=>_st(f,1);
global.window={addEventListener(){}};
global.Image=class{constructor(){this.complete=true;this.naturalWidth=1}set src(v){}decode(){return Promise.resolve()}};
function mkEl(){const el={textContent:"",innerHTML:"",className:"",style:{},scrollTop:0,dataset:{},
  appendChild(){},prepend(){},remove(){},classList:{add(){},remove(){},toggle(){}},
  querySelector:()=>mkEl(),querySelectorAll:()=>[mkEl(),mkEl(),mkEl()]};return el;}
function mockCanvas(){const c=mkEl();c.width=0;c.height=0;
  c.getContext=()=>({fillStyle:"",imageSmoothingEnabled:false,fillRect(){},drawImage(){}});return c;}
global.document={getElementById:()=>mkEl(),querySelector:()=>mkEl(),
  querySelectorAll:()=>[mkEl(),mkEl(),mkEl()],createElement:t=>t==="canvas"?mockCanvas():mkEl(),body:mkEl()};
let code=require('fs').readFileSync(__dirname+'/../game.src.js','utf8');
code=code.replace(/load\(\)\.then[\s\S]*?\}\);/,"");
code+="\nmodule.exports={boot:async()=>{await load();},getS:()=>S,getMC:()=>MC,start:i=>startMatch(i),"
   +"makeFixtures,startSeason,playLeagueRound,rankList,simCpu,LG_CLUBS,renderLeagueMode,startLeagueMatch};";
require('fs').writeFileSync(__dirname+'/_tmp_leaguetest.js',code);
const E=require(__dirname+'/_tmp_leaguetest.js');
(async()=>{
  await E.boot();
  // 対戦表の妥当性:9チーム→各チーム8試合、全カード重複なし
  const fx=E.makeFixtures();
  const cnt={},pairs=new Set();let games=0;
  fx.forEach(round=>round.forEach(([a,b])=>{cnt[a]=(cnt[a]||0)+1;cnt[b]=(cnt[b]||0)+1;
    const key=[a,b].sort((x,y)=>x-y).join("-");pairs.add(key);games++;}));
  console.log("節数:",fx.length,"総試合:",games,"ユニーク対戦:",pairs.size,
    "各チーム試合数:",[...new Set(Object.values(cnt))]);
  // フルシーズンをCPU処理で回す(自分の試合もCPU扱いで素通し)
  E.startSeason();
  const S=E.getS();
  let guard=0;
  while(S.league.round<S.league.fixtures.length && guard++<20){
    const games=S.league.fixtures[S.league.round];
    const myGame=games.find(g=>g[0]===0||g[1]===0);
    if(myGame){ // 自分の試合をCPU結果で代用してテスト
      const opp=myGame[0]===0?myGame[1]:myGame[0];
      const [hs,as]=E.simCpu(0, 4);
      S.league._myHome=(myGame[0]===0);S.league._pending=games.filter(g=>g!==myGame);
      // finishは内部関数なのでplayを使わず直接適用ロジック相当を呼ぶ
      const lg=S.league;
      if(lg._myHome)lg.table[myGame[0]].p,0;
    }
    E.playLeagueRound(); // myGameがあるとstartLeagueMatch→試合になるので、その場合はMCを消化
    if(E.getMC()){while(E.getMC())await new Promise(r=>_st(r,3));}
  }
  const rk=E.rankList(S.league.table);
  console.log("シーズン消化 round=",S.league.round,"/",S.league.fixtures.length);
  console.log("最終順位表(上位3):",rk.slice(0,3).map(r=>`${E.LG_CLUBS[r.i]} 勝点${r.pt}(${r.p}試)`).join(" / "));
  console.log("全チーム8試合消化:",rk.every(r=>r.p===8));
  process.exit(0);
})().catch(e=>{console.error("FAIL:",e);process.exit(1)});
