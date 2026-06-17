const _st=global.setTimeout;global.setTimeout=(f,ms)=>_st(f,1);
global.window={addEventListener(){}};
global.Image=class{constructor(){this.complete=true;this.naturalWidth=1}set src(v){}decode(){return Promise.resolve()}};
function mkEl(){const el={textContent:"",innerHTML:"",style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},prepend(){},remove(){},querySelector:()=>mkEl(),querySelectorAll:()=>[mkEl(),mkEl(),mkEl()]};return el;}
function mockCanvas(){const c=mkEl();c.width=0;c.height=0;c.getContext=()=>({fillStyle:"",imageSmoothingEnabled:false,fillRect(){},drawImage(){}});return c;}
global.document={getElementById:()=>mkEl(),querySelector:()=>mkEl(),querySelectorAll:()=>[mkEl(),mkEl(),mkEl()],createElement:t=>t==="canvas"?mockCanvas():mkEl(),body:mkEl()};
let base=require('fs').readFileSync(__dirname+'/../game.src.js','utf8');
base=base.replace(/load\(\)\.then[\s\S]*?\}\);/,"");
// 試合結果を直接取得するフック
base+="\nmodule.exports={boot:async()=>{await load();},start:i=>startMatch(i),getMC:()=>MC,getS:()=>S,makeCard,FORMS};";
require('fs').writeFileSync(__dirname+'/_tmp_progtest2.js',base);
const E=require(__dirname+'/_tmp_progtest2.js');
(async()=>{
  await E.boot();const S=E.getS();
  function setDeck(rar){S.coll=[];S.squad={};E.FORMS["4-4-2"].forEach((sl,i)=>{const c=E.makeCard(sl[0],rar);S.coll.push(c);S.squad[i]=c.id;});}
  // 試合スコアを直接読む(MCが消える直前の値を捕捉)
  async function playOnce(idx){
    E.start(idx);let last=null;
    while(E.getMC()){const M=E.getMC();last={h:M.home.score,a:M.away.score};await new Promise(r=>_st(r,3));}
    return last;
  }
  console.log("=== 想定進行(無改変エンジン・スコア直読み) ===");
  const plan=[["n",0],["n",1],["r",2],["r",3],["sr",4],["sr",5],["sr",6],["l",7]];
  for(const [rar,idx] of plan){
    setDeck(rar);let w=0,d=0,l=0;const N=60;
    for(let g=0;g<N;g++){const r=await playOnce(idx);if(!r)continue;
      if(r.h>r.a)w++;else if(r.h<r.a)l++;else d++;}
    console.log(`${rar.toUpperCase().padEnd(2)}デッキ→Lv${idx+1}: 勝率${(w/N*100).toFixed(0)}% (W${w}/D${d}/L${l})`);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
