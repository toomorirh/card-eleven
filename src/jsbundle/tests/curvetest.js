const _st=global.setTimeout;global.setTimeout=(f,ms)=>_st(f,1);
global.window={addEventListener(){}};
global.Image=class{constructor(){this.complete=true;this.naturalWidth=1}set src(v){}decode(){return Promise.resolve()}};
function mkEl(){const el={textContent:"",innerHTML:"",style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},prepend(){},remove(){},querySelector:()=>mkEl(),querySelectorAll:()=>[mkEl(),mkEl(),mkEl()]};return el;}
function mockCanvas(){const c=mkEl();c.getContext=()=>({fillStyle:"",imageSmoothingEnabled:false,fillRect(){},drawImage(){}});return c;}
global.document={getElementById:()=>mkEl(),querySelector:()=>mkEl(),querySelectorAll:()=>[mkEl(),mkEl(),mkEl()],createElement:t=>t==="canvas"?mockCanvas():mkEl(),body:mkEl()};
const RR=process.env.RR; // rr幅の上書き(任意)
let base=require('fs').readFileSync(__dirname+'/../game.src.js','utf8');
if(RR){base=base.replace(/const rr=\(\)=>[^;]+;/,`const rr=()=>(1-${RR}/2)+Math.random()*${RR};`);}
base=base.replace(/load\(\)\.then[\s\S]*?\}\);/,"");
base+="\nmodule.exports={boot:async()=>{await load();},makeCard,FORMS,buildTeam:(c,s)=>buildTeam(c,s),_startWith:(h,a)=>{MC={home:h,away:a,min:0,ball:50,bx:50,by:50,idx:0,name:'T',lv:0,subs:3,halt:false,loop:false};return MC;},getMC:()=>MC,runLoop:()=>runLoop()};";
require('fs').writeFileSync(__dirname+'/_tmp_curvetest.js',base);
const E=require(__dirname+'/_tmp_curvetest.js');
(async()=>{
  await E.boot();
  // 基準デッキ(R)を1つ作り、相手はそれを係数fでスケールしたコピー
  const tmpl=E.FORMS["4-4-2"].map(sl=>({role:sl[0],x:sl[1],y:sl[2],c:E.makeCard(sl[0],"r")}));
  const clone=(s,f)=>E.buildTeam(tmpl.map(p=>{
    const c=JSON.parse(JSON.stringify(p.c));
    if(f!==1)["off","def","pow","tec","spd","sta"].forEach(k=>c[k]=Math.min(20,Math.max(1,Math.round(c[k]*f))));
    return {c,role:p.role,pen:1,x:p.x,y:p.y,enter:0};
  }),s);
  console.log("=== rr幅="+(RR||"0.8(既定)")+" : home固定 vs away×f の勝率 ===");
  for(const f of [0.80,0.90,0.95,1.00,1.05,1.10,1.20]){
    let w=0,d=0,l=0;const N=120;
    for(let g=0;g<N;g++){E._startWith(clone("H",1),clone("A",f));const M=E.getMC();await E.runLoop();
      if(M.home.score>M.away.score)w++;else if(M.home.score<M.away.score)l++;else d++;}
    const ratio=(1/f).toFixed(2);
    console.log(`away×${f.toFixed(2)} (自/相手比${ratio}): home勝率${(w/N*100).toFixed(0)}% (W${w}/D${d}/L${l})`);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
