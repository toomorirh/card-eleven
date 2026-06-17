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
code+="\nmodule.exports={boot:async()=>{await load();},makeCard,oppTeam,getS:()=>S,start:i=>startMatch(i),getMC:()=>MC};";
require('fs').writeFileSync(__dirname+'/_tmp_scaletest.js',code);
const E=require(__dirname+'/_tmp_scaletest.js');
(async()=>{
  await E.boot();
  for(const rar of ["l","sr","r","n"]){
    let sums=[],mins=20,maxs=1;
    for(let i=0;i<500;i++){
      const c=E.makeCard(null,rar);
      const t=c.off+c.def+c.pow+c.tec+c.spd+c.sta;
      sums.push(t);
      [c.off,c.def,c.pow,c.tec,c.spd,c.sta].forEach(v=>{mins=Math.min(mins,v);maxs=Math.max(maxs,v);});
    }
    const avg=sums.reduce((a,b)=>a+b,0)/sums.length;
    console.log(`${rar.toUpperCase().padEnd(3)} 合計平均:${avg.toFixed(1)} (目標${({l:100,sr:90,r:70,n:55})[rar]}) 値域:${mins}-${maxs}`);
  }
  // 対戦相手の強さ(平均ステ)がLvで上がるか
  for(const lv of [1,4,8]){
    const t=E.oppTeam(lv);
    const avg=t.players.reduce((s,p)=>s+(p.c.off+p.c.def+p.c.pow+p.c.tec+p.c.spd+p.c.sta),0)/t.players.length/6;
    console.log(`Lv${lv} 相手の平均ステ/項目:${avg.toFixed(1)}`);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
