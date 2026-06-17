// レジェンド機能の検証
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
code=code.replace("load().then(()=>{coinUI();renderLeague();});","");
code+="\nmodule.exports={boot:async()=>{await load();},start:i=>startMatch(i),getMC:()=>MC,getS:()=>S,makeCard,oppTeam,drawPack};";
require('fs').writeFileSync(__dirname+'/_tmp_legendtest.js',code);
const E=require(__dirname+'/_tmp_legendtest.js');
(async()=>{
  await E.boot();
  // 1) レジェンドカードの生成
  const ls=[];
  for(let i=0;i<200;i++)ls.push(E.makeCard(null,"l"));
  const avg=ls.reduce((s,c)=>s+c.off+c.def+c.pow+c.tec+c.spd+c.sta,0)/200/6;
  const allLskill=ls.every(c=>c.skill&&["奇跡の手","絶対領域","鉄壁の壁","守護王","王の視野","マエストロ","伝説の一撃","覇王"].includes(c.skill.name));
  console.log("L平均ステ:",avg.toFixed(2),"(SR基準7台後半〜8台ならOK) 専用スキル100%:",allLskill);
  // 2) 最終ボスにレジェンドが混ざる
  const boss=E.oppTeam(8);
  console.log("Lv8ボスのレジェンド:",boss.players.filter(p=>p.c.rar==="l").map(p=>p.c.name+"【"+p.c.skill.name+"】").join(",")||"なし(NG)");
  // 3) ドロップ率の実測(300試合・勝敗内訳つき)
  E.getS().legendPacks=0;
  let w=0,d=0,l=0;
  for(let m=0;m<300;m++){
    const before=E.getS().coins;
    E.start(0);
    while(E.getMC())await new Promise(r=>_st(r,5));
    const r=E.getS().coins-before;
    if(r===140)w++;else if(r===50)d++;else l++;
  }
  const exp=(w*0.18+d*0.08+l*0.04).toFixed(1);
  console.log(`300試合: 勝${w} 分${d} 負${l} → パック${E.getS().legendPacks}個(期待値${exp})`);
  // 4) パック開封
  E.getS().legendPacks=20;
  const before=E.getS().coll.length;
  for(let i=0;i<20;i++)E.drawPack("legend");
  const got=E.getS().coll.slice(before);
  console.log("20連開封:",got.map(c=>c.rar).join(","));
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
