const _st=global.setTimeout;
global.setTimeout=(f,ms)=>_st(f,Math.max(1,(ms||0)/50));
global.window={storage:{get:()=>new Promise(()=>{}),set:()=>new Promise(()=>{})},addEventListener(){}}; // 永久ハング
global.Image=class{constructor(){this.complete=false;this.naturalWidth=0}set src(v){}decode(){return new Promise(()=>{})}};
function mkEl(){const el={textContent:"",innerHTML:"",className:"",style:{},scrollTop:0,dataset:{},
  appendChild(){},prepend(){},remove(){},classList:{add(){},remove(){},toggle(){}},
  querySelector:()=>mkEl(),querySelectorAll:()=>[mkEl(),mkEl(),mkEl()]};return el;}
function mockCanvas(){const c=mkEl();c.width=0;c.height=0;
  c.getContext=()=>({fillStyle:"",imageSmoothingEnabled:false,fillRect(){},drawImage(){}});return c;}
global.document={getElementById:()=>mkEl(),querySelector:()=>mkEl(),
  querySelectorAll:()=>[mkEl(),mkEl(),mkEl()],createElement:t=>t==="canvas"?mockCanvas():mkEl(),body:mkEl()};
let code=require('fs').readFileSync(__dirname+'/../game.src.js','utf8');
code=code.replace("load().then(()=>{coinUI();renderLeague();})\n  .catch(e=>{showErr(e);coinUI();renderLeague();});","");
code+="\nmodule.exports={boot:async()=>{await load();},start:i=>startMatch(i),getMC:()=>MC,getS:()=>S};";
require('fs').writeFileSync(__dirname+'/_tmp_hangtest.js',code);
const E=require(__dirname+'/_tmp_hangtest.js');
(async()=>{
  const t0=Date.now();
  await E.boot();   // ストレージ&画像が永久ハングしてもタイムアウトで起動するはず
  console.log("ハング環境でも起動OK(",Date.now()-t0,"ms ) 初期デッキ:",E.getS().coll.length,"枚");
  E.start(0);       // 画像なしでもフォールバック描画で試合開始
  while(E.getMC())await new Promise(r=>_st(r,5));
  console.log("画像なし環境でも試合完走OK");
  process.exit(0);
})().catch(e=>{console.error("FAIL:",e);process.exit(1)});
