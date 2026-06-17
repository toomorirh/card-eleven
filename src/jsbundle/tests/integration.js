// フル試合の統合テスト(20倍速)
const _st=global.setTimeout;
global.setTimeout=(f,ms)=>_st(f,Math.max(1,(ms||0)/20));
global.window={addEventListener(){}};
global.Image=class{constructor(){this.complete=true;this.naturalWidth=1}set src(v){}decode(){return Promise.resolve()}};
function mkEl(){
  const el={textContent:"",innerHTML:"",className:"",style:{},scrollTop:0,dataset:{},
    appendChild(){},prepend(){},remove(){},
    classList:{add(){},remove(){},toggle(){}},
    querySelector:()=>mkEl(),
    querySelectorAll:()=>[mkEl(),mkEl(),mkEl()]};
  return el;
}
function mockCanvas(){const c=mkEl();c.width=0;c.height=0;
  c.getContext=()=>({fillStyle:"",imageSmoothingEnabled:false,fillRect(){},drawImage(){}});return c;}
global.document={
  getElementById:()=>mkEl(),
  querySelector:()=>mkEl(),
  querySelectorAll:()=>[mkEl(),mkEl(),mkEl()],
  createElement:t=>t==="canvas"?mockCanvas():mkEl(),
  body:mkEl()};
let code=require('fs').readFileSync(__dirname+'/../game.src.js','utf8');
code=code.replace("load().then(()=>{coinUI();renderLeague();});","");
code+=`
module.exports={
  boot:async()=>{await load();},
  start:(i)=>startMatch(i),
  getMC:()=>MC,getS:()=>S,
  trySub:()=>{ // 30分時点で交代を1回実行するシミュレーション
    if(!MC||MC.subs<=0)return false;
    MC.halt=true;
    const out=MC.home.players[9];
    const onField=MC.home.players.map(p=>p.c.id);
    const bench=S.coll.filter(c=>!onField.includes(c.id));
    if(!bench.length){MC.halt=false;runLoop();return false;}
    const c=bench[0];
    MC.home.players[9]={c,role:out.role,pen:c.pos===out.role?1:0.72,x:out.x,y:out.y,enter:MC.min,fside:"H",el:out.el,
      stat:{shots:0,goals:0,assists:0,duelW:0,duelL:0,tkl:0,saves:0}};
    recalcAuras(MC.home);MC.subs--;
    MC.halt=false;runLoop();
    return true;
  }};`;
require('fs').writeFileSync(__dirname+'/_tmp_integration.js',code);
const E=require(__dirname+'/_tmp_integration.js');
(async()=>{
  await E.boot();
  console.log("初期化OK 所持:",E.getS().coll.length,"枚");
  E.start(0);
  let subDone=false;
  while(E.getMC()){
    const M=E.getMC();
    if(M&&M.min>=30&&!subDone){subDone=E.trySub();if(subDone)console.log("30分:交代実行OK");}
    await new Promise(r=>_st(r,50));
  }
  console.log("試合完走OK コイン:",E.getS().coins,"クリア:",E.getS().cleared);
  // 各スタイルで完走確認
  for(const st of ["side","long","short"]){
    E.start(0);
    const M2=E.getMC();M2.home.style=st;
    while(E.getMC())await new Promise(r=>_st(r,50));
    console.log(st+"戦術で完走OK");
  }
  process.exit(0);
})().catch(e=>{console.error("FAIL:",e);process.exit(1);});
