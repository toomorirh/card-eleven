// ================= 試合コア(純粋シミュレーション&バランス・DOM非依存) =================
// マッチアップの基本は据え置き(バランス検証済みの数値):
//  支配=中盤の技/速/持、中央=得意勝負、サイド=速技→クロス→力、ロング=技→速の駆けっこ、ショート=技の連携
// バランス調整値は data.js の TUNING に集約。ここは「式・選手選出・勝敗判定」の純粋ロジック。
const TH=TUNING.th;
let MC=null; // 進行中の試合コンテキスト(描画/進行から参照・更新)
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 疲労(0..1の能力係数。1=元気)。アクション数(関与=p.stat.inv)主体+時間わずか。活躍した選手ほど
// 大きく低下し、終盤にアクションが失敗しやすくなる。staが高いほど消耗が緩やか。iron=消耗なし。
function fatigue(p,min){
  const c=p.c, F=TUNING.fatigue;
  if(c.skill&&c.skill.fx.iron)return 1;
  const inv=(p.stat&&p.stat.inv)||0;
  const dload=(p.stat&&p.stat.dload)||0;                   // 守備負荷(被攻撃/被シュートをラインで分担)
  const played=Math.min(Math.max(min-(p.enter||0),0),90);
  const staMul=1-(c.sta-1)/19*F.staReduce;                 // sta1→1.0 / sta20→1-staReduce
  return 1-Math.min(F.max, (inv*F.perAction+dload*F.perDef+played*F.perMin)*staMul*ageDrain(p)); // 年齢: 若手ほど消費が早い
}
// 守備ライン全体の消耗で守備力が落ちる(疲れたDFラインは終盤に綻び被弾しやすい)。
// 個々のeffの疲労とは別に、ライン平均消耗ぶんだけ守備スコアを薄く減じる。rng非消費=判定順は不変。
function lineDefMul(D,min){
  const F=TUNING.fatigue; if(!D||!F.linePenalty)return 1;
  const dl=D.players.filter(p=>p.role==="DF"); if(!dl.length)return 1;
  let s=0; for(const p of dl)s+=fatigue(p,min);
  const drain=1-s/dl.length;                               // ライン平均消耗(0=元気)
  const over=Math.max(0,drain-(F.lineFree||0));            // 不感帯を超えた消耗のみ守備力に響く
  return 1-over*F.linePenalty;                             // 例: 50%消耗・不感帯30% → ×(1-0.2*0.8)=0.84
}
function recalcAuras(t){
  t.teamChance=1;t.teamDef=1;
  t.players.forEach(p=>{
    const f=p.c.skill?p.c.skill.fx:{};
    if(f.teamChance)t.teamChance*=f.teamChance;
    if(f.teamDef)t.teamDef*=f.teamDef;
  });
  // 同国籍ケミストリー: 最多同国籍人数に応じてチーム全体を微強化(両チーム共通・対称)
  const cnt={};let mx=0,nat=null;
  t.players.forEach(p=>{const f=p.c.flag||"?";cnt[f]=(cnt[f]||0)+1;if(cnt[f]>mx){mx=cnt[f];nat=f;}});
  t.chemN=mx;t.chemNat=nat;
  t.chem=1+Math.min(0.06,Math.max(0,mx-2)*0.012); // 3人で+1.2% … 7人以上で+6%(上限)
}
function buildTeam(cards,side,form){
  const t={players:cards,tactic:"bal",style:"center",score:0,side,form};
  cards.forEach(p=>{p.fside=side;p.stat={shots:0,goals:0,assists:0,duelW:0,duelL:0,tkl:0,saves:0,inv:0,dload:0};});
  if(side==="H")t.mgr=homeManager(); // 自チームの監督(キャリア中は育成中監督・通常は起用中の名将/カスタム)
  recalcAuras(t);
  return t;
}
// 上位相手の監督バフ(仮置きの難度レバー): 全能力を僅かに底上げ。「強いチームに強い監督」の第一歩。
function aiMgr(mul,title){return mul>1?{title:title||"敵将", boosts:[{pos:"all",stat:"all",mul}]}:null;}
// 試合後評価。勝敗ロジックには一切影響しない「採点レイヤー」。
//  ・関与度(inv)を主軸にして全選手に差をつける(出番が少ない=低評価)
//  ・離散イベント(ゴール/アシスト/デュエル/タックル/セーブ)をスパイクとして加減
//  ・守備陣は無失点/失点のチーム文脈を反映
//  平常は概ね 4.0〜7.5 に散り、MOMは8〜9.5、不出来は3.5前後まで落ちる設計。
function statRating(p,opp){
  const s=p.stat||{};
  // GKは構造的に関与回数が少ないため、セーブ+無失点/失点で評価する専用スケール
  if(p.role==="GK"){
    let g=5.5+(s.saves||0)*0.35;
    if(opp){ if(opp.score===0)g+=0.7; else g-=Math.min(1.2,opp.score*0.30); }
    return Math.max(3.0,Math.min(10,Math.round(g*10)/10));
  }
  const inv=s.inv||0;
  let r=4.0+2.05*Math.log10(1+inv);                      // 関与ベース: inv0→4.0 / 3→5.2 / 8→5.9 / 20→6.7 / 45→7.4
  r+=(s.goals||0)*0.9+(s.assists||0)*0.55                // 攻撃の決定的関与
    +(s.duelW||0)*0.12-(s.duelL||0)*0.12                 // 1対1の明暗
    +(s.tkl||0)*0.14+(s.saves||0)*0.30                   // 守備の貢献
    -((s.shots||0)-(s.goals||0))*0.06;                   // 決め切れない非効率は微減
  if(opp&&p.role==="DF"){                                 // DFのチーム文脈
    if(opp.score===0)r+=0.5;                             // 無失点ボーナス
    else r-=Math.min(0.8,opp.score*0.18);               // 失点ペナルティ(上限)
  }
  return Math.max(3.0,Math.min(10,Math.round(r*10)/10));
}
function myTeam(){
  const cards=[];
  const kp=KEYPOS[S.form]||{};
  FORMS[S.form].forEach((sl,i)=>{
    const c=S.coll.find(k=>k.id===S.squad[i]);
    if(c)cards.push({c,role:subGroup(sl[0]),subRole:sl[0],pen:posFit(c.sub,sl[0]),x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1});
  });
  return buildTeam(cards,"H",S.form);
}
// 監督キャリア用: 手持ち(S.coll)から「OVR合計が cap 以内」の最強XIを組む(貪欲に最良→超過なら弱い候補へ差し替え)。
const cardOvr=c=>c.off+c.def+c.pow+c.tec+c.spd+c.sta;
// 育成で選べる選手プール = 手持ち + 招へい中の助っ人(固有選手・シーズン限定)。
function careerPool(cr){return (cr&&cr.loan)?S.coll.concat([cr.loan]):S.coll;}
// ベンチ(交代枠)に指定された cardId 集合。先発の自動補完から除外(先発と控えは重複しない)。
function careerBenchSet(cr){return new Set(((cr&&cr.bench)||[]).filter(v=>v!=null));}
// 手動選択(cr.squad{slot:cardId})を尊重しつつ空き枠を自動補完した picks を返す(枠順)。手動枠は manual:true。
// exclude=先発に使わないカードid集合(=ベンチ指定選手)。
function careerPicks(cr,exclude){
  const form=FORMS[S.form]||FORMS["4-4-2"], used=new Set(), picks=[], pool=careerPool(cr);
  const ex=exclude||careerBenchSet(cr), manual=(cr&&cr.squad)||{};
  form.forEach((sl,i)=>{ // 1) 手動枠を配置(所持・重複不可・ベンチ指定は不可)
    let c=null; const mid=manual[i];
    if(mid!=null&&!ex.has(mid)){ c=pool.find(k=>k.id===mid); if(c&&used.has(c.id))c=null; }
    if(c)used.add(c.id);
    picks.push({c, sub:sl[0], manual:!!c});
  });
  picks.forEach(p=>{ if(p.c)return; // 2) 空き枠を貪欲に自動補完(ベンチ指定は除外)
    let best=null,bs=-1;
    for(const c of pool){ if(used.has(c.id)||ex.has(c.id))continue; const sc=posFit(c.sub,p.sub)*1000+cardOvr(c); if(sc>bs){bs=sc;best=c;} }
    if(best){p.c=best;used.add(best.id);}
  });
  return {picks,used};
}
function careerTeam(cap){
  const ovr=cardOvr, form=FORMS[S.form]||FORMS["4-4-2"], kp=KEYPOS[S.form]||{};
  const cr=(typeof S!=="undefined")&&S.career, pool=careerPool(cr);
  const ex=careerBenchSet(cr);
  const benchTot=[...ex].reduce((s,id)=>{const c=pool.find(k=>k.id===id);return s+(c?ovr(c):0);},0);
  const xiCap=Math.max(0,cap-benchTot); // ベンチぶんを差し引いた先発の実効上限(=XI+ベンチ≤cap)
  const {picks,used}=careerPicks(cr,ex);
  // 上限超過なら「自動枠」だけを弱い候補へ差し替えてトリム(手動枠は尊重=選んだ主力は残す)
  const tot=()=>picks.reduce((s,p)=>s+(p.c?ovr(p.c):0),0);
  let guard=0;
  while(tot()>xiCap && guard++<300){
    let pick=null,alt=null,bestSave=0;
    for(const p of picks){ if(p.manual||!p.c)continue;
      let a=null,as=-1;
      for(const c of pool){ if(used.has(c.id)||ex.has(c.id)||ovr(c)>=ovr(p.c))continue;
        const sc=posFit(c.sub,p.sub)*1000+ovr(c); if(sc>as){as=sc;a=c;} }
      if(a){const save=ovr(p.c)-ovr(a); if(save>bestSave){bestSave=save;pick=p;alt=a;}}
    }
    if(!pick)break;
    used.delete(pick.c.id);used.add(alt.id);pick.c=alt;
  }
  const cards=picks.filter(p=>p.c).map(p=>{const i=picks.indexOf(p);return {c:p.c,role:subGroup(p.sub),subRole:p.sub,pen:posFit(p.c.sub,p.sub),
    x:form[i][1],y:form[i][2],enter:0,keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};});
  const team=buildTeam(cards,"H",S.form);
  if(cr)team.players.forEach(p=>{p.grow=(cr.growth&&cr.growth[p.c.id])||null; p.ageBonus=cr.season||0;}); // 成長値+加齢(実効年齢)を付与
  return team;
}
// 現在の育成編成の素OVR合計(先発+ベンチ・上限判定/表示用・成長は非加算)。
// 先発は careerTeam の「トリム後(=実際に出場する)」合計を使う(最良XIではなく上限に収めた編成)。
function careerBaseTotal(cr){
  const pool=careerPool(cr);
  const team=careerTeam((typeof careerCap==="function")?careerCap(cr):(cr?cr.ovrCap:0));
  let t=team.players.reduce((s,p)=>s+cardOvr(p.c),0);
  ((cr&&cr.bench)||[]).forEach(id=>{if(id==null)return;const c=pool.find(k=>k.id===id);if(c)t+=cardOvr(c);}); // ベンチも上限内
  return t;
}
// 統制ペナルティ倍率: 編成OVR(素・XI+ベンチ)が統制可能OVR(careerCap)を超えた超過率ぶん全能力を低下。
// 例) 編成OVR/統制OVR=1.30 → 1-(1.30-1)*overloadK = -30%(overloadFloor でクランプ)。統制内は 1.0。
// 統制超過のソフト減衰(汎用): 編成OVR total が 統制可能OVR cap を超えた超過率ぶん全能力を低下(floorでクランプ)。
// キャリア/通常モードで共通に使う。統制内(r<=1)は 1.0。
function ovrOverloadMul(total, cap){
  if(!cap||cap<=0)return 1;
  const r=total/cap; if(r<=1)return 1;
  return Math.max(CAREER.overloadFloor, 1-(r-1)*CAREER.overloadK);
}
function careerOverloadMul(cr){ return ovrOverloadMul(careerBaseTotal(cr), careerCap(cr)); }
// 通常モードの編成OVR合計(実出場XI + 事前設定ベンチ)。監督の統制OVRとの比較に使う。
function homeBaseTotal(home){
  let t=(home&&home.players?home.players:[]).reduce((s,p)=>s+cardOvr(p.c),0);
  if(typeof S!=="undefined")(S.bench||[]).forEach(id=>{if(id==null)return;const c=S.coll.find(k=>k.id===id);if(c)t+=cardOvr(c);});
  return t;
}
// 通常モードの自チーム統制ペナルティ倍率(起用中監督=無ければ見習い のctrlOVR基準)。
function homeCtrlMul(home){return ovrOverloadMul(homeBaseTotal(home), (typeof mgrCtrlOVR==="function")?mgrCtrlOVR(effectiveManager()):9999);}
// 現在のベンチ(交代枠)の実カード配列(所持・先発と重複しない)。試合開始時の MC.bench 供給に使う。
function careerBenchCards(cr){
  const pool=careerPool(cr), xi=new Set(careerPicks(cr).picks.filter(p=>p.c).map(p=>p.c.id));
  return ((cr&&cr.bench)||[]).map(id=>pool.find(k=>k.id===id)).filter(c=>c&&!xi.has(c.id));
}
// ===== 選手のシーズン内成長・コンディション(キャリア限定・ローグライク) =====
// 成長する主ステ(役割ベース)。出場・高評価でこれらが少しずつ伸びる。
function growthStatsFor(p){
  return p.role==="GK"?["def","tec"]:p.role==="DF"?["def","pow","spd"]:p.role==="MF"?["tec","sta","off"]:["off","spd","tec"];
}
// 調子(コンディション): 前節評価(好調継続)+フェーズの波×乱数。±約12〜15%。{mul,key,label,icon}。
function careerCondition(cr,c,phase){
  const f=(cr.form&&cr.form[c.id])||{}, lastR=(f.lastR!=null)?f.lastR:6.0, vol=(phase&&phase.condVol)||1;
  let v=(lastR-6.0)*0.06+(Math.random()*2-1)*0.09*vol+facCondShift(cr); // メディカル施設で底上げ
  v=Math.max(-0.12,Math.min(0.18,v));
  let key,label,icon;
  if(v>=0.10){key="peak";label="絶好調";icon="⤴";}
  else if(v>=0.04){key="good";label="好調";icon="↗";}
  else if(v>-0.04){key="ok";label="普通";icon="→";}
  else if(v>-0.09){key="bad";label="不調";icon="↘";}
  else {key="poor";label="絶不調";icon="⤵";}
  return {mul:1+v,key,label,icon};
}
// 試合後の成長処理(キャリア限定): 出場記録＋高評価で微成長(フェーズのgrowth倍率)、老雄の酷使で微衰退。
function careerApplyGrowth(cr,homeTeam,awayTeam){
  if(!cr)return; cr.growth=cr.growth||{}; cr.form=cr.form||{};
  homeTeam.players.forEach(p=>{
    const id=p.c.id, r=statRating(p,awayTeam), phase=agePhase(effAge(p));
    const f=cr.form[id]||(cr.form[id]={apps:0,lastR:6}); f.apps++; f.lastR=r;
    const g=cr.growth[id]||(cr.growth[id]={off:0,def:0,pow:0,tec:0,spd:0,sta:0});
    if(r>=CAREER.growthThresh){ // 高評価→主ステが伸びる(若手ほど大きい・アカデミーで加速)
      const amt=(r>=8.5?0.5:r>=7.5?0.32:0.2)*(phase.growth||0.8)*facGrowthMul(cr), ks=growthStatsFor(p);
      ks.forEach(k=>{ g[k]=Math.min(CAREER.growthCap,(g[k]||0)+amt/ks.length); });
    }
    if((phase.decline||0)>0 && r<5.0){ // 老雄/ベテランの低調な酷使→spd/staが微減
      const dec=0.12*phase.decline;
      ["spd","sta"].forEach(k=>{ g[k]=Math.max(-CAREER.growthFloor,(g[k]||0)-dec); });
    }
  });
}
// ===== リーグ順位表(WCCF風): 自チーム+同DIVの6クラブ(1枠は宿敵)で勝点を蓄積し、順位で昇降格 =====
// クラブ同士の1試合をlv差で簡易シミュ(演出なし・純粋)。{ra,rb,ga,gb}。
function simClubResult(lvA,lvB){
  const diff=lvA-lvB, pW=Math.max(0.12,Math.min(0.82,0.4+diff*0.07)), pD=0.24, x=Math.random();
  if(x<pW){const ga=ri(1,3);return {ra:"W",rb:"L",ga,gb:ri(0,Math.max(0,ga-1))};}
  if(x<pW+pD){const g=ri(0,2);return {ra:"D",rb:"D",ga:g,gb:g};}
  const gb=ri(1,3);return {ra:"L",rb:"W",gb,ga:ri(0,Math.max(0,gb-1))};
}
// 現在のDIVシーズン用に順位表を用意(div変更/未作成なら再構築)。大陸リーグ中は対象外。
function careerTableEnsure(cr){
  if(cr.contId)return null;
  if(cr.table&&cr.tableDiv===cr.div)return cr.table;
  const T={__me:{pts:0,gd:0,pl:0,w:0,d:0,l:0,name:(typeof myName==="function"?myName():"自チーム"),lv:0}};
  careerLeaguePool(cr).forEach(id=>{const b=OPP_CLUBS[id]||{};
    T[id]={pts:0,gd:0,pl:0,w:0,d:0,l:0,name:b.name||id,lv:id==="nemesis"?nemesisLv(cr):(b.lv||5),rival:id==="nemesis"};});
  cr.table=T; cr.tableDiv=cr.div; return T;
}
// 1節ぶんの順位表更新: 自分の結果を反映+対戦相手にミラー反映+残りクラブをペアでシミュ。
function careerSimRound(cr,oppId,res,sh,sa){
  const T=careerTableEnsure(cr); if(!T)return;
  const apply=(k,r,gf,ga)=>{const e=T[k];if(!e)return;e.pl++;e.gd+=(gf-ga);if(r==="W"){e.w++;e.pts+=3;}else if(r==="D"){e.d++;e.pts+=1;}else e.l++;};
  apply("__me",res,sh,sa);
  if(oppId&&T[oppId])apply(oppId,res==="W"?"L":res==="D"?"D":"W",sa,sh);
  const others=Object.keys(T).filter(k=>k!=="__me"&&k!==oppId);
  for(let i=others.length-1;i>0;i--){const j=ri(0,i);[others[i],others[j]]=[others[j],others[i]];}
  for(let i=0;i+1<others.length;i+=2){const a=others[i],b=others[i+1],r=simClubResult(T[a].lv,T[b].lv);
    apply(a,r.ra,r.ga,r.gb);apply(b,r.rb,r.gb,r.ga);}
}
// 順位表を勝点→得失点→自分優先でソートした配列を返す。
function careerStandings(cr){
  const T=careerTableEnsure(cr); if(!T)return [];
  return Object.keys(T).map(k=>Object.assign({id:k,me:k==="__me"},T[k]))
    .sort((a,b)=>b.pts-a.pts||b.gd-a.gd||(a.me?-1:b.me?1:0));
}
// キャリアの戦績処理(純粋・DOM非依存)。cr を更新し {res,pts,promoted,boost,seasonEnd,msg} を返す。
function careerRecordResult(cr,sh,sa){
  const res=sh>sa?"W":sh===sa?"D":"L", pts=sh>sa?3:sh===sa?1:0, divBefore=cr.div;
  const cont=cr.contId?continentById(cr.contId):null; // 大陸リーグ中か
  if(!cont)careerSimRound(cr,(careerOpponent(cr)||{}).id,res,sh,sa); // DIVリーグ: 順位表を更新(他クラブもシミュ)
  cr.pts=(cr.pts||0)+pts; cr.gf=(cr.gf||0)+sh; cr.ga=(cr.ga||0)+sa;
  const hi=cr.step; (cr.history=cr.history||[])[hi]={act:"L",res,sc:sh+"-"+sa,nd:(cr.node||0)+1,opp:cr.oppName||"",
    div:cont?undefined:divBefore, cont:cont?cont.name:undefined}; // スケジュール表示用の記録
  cr.node++; cr.step++;
  const out={res,pts,seasonEnd:false,promoted:false,boost:null};
  if(cr.node>=CAREER.nodes){ // シーズン終了
    cr.season=(cr.season||0)+1;                            // 加齢: 実効年齢+1(若手→全盛期→老雄へ・カード本体は不変)
    cr.loan=null;                                          // 助っ人はシーズン限りで契約満了(期限付き)
    const perf=0.4+0.6*(cr.pts/(CAREER.nodes*3));          // 0.4(不振)〜1.0(完全優勝)
    if(cont){ // 大陸リーグ制覇 → その大陸の系統ステに特化したboost(高倍率)
      const mul=Math.round((1+cont.base*perf)*1000)/1000;
      const boost={pos:"all",stat:cont.stat,mul};
      cr.boosts.push(boost); cr.contWon=cr.contWon||[]; cr.contWon.push(cont.id);
      out.seasonEnd=true; out.boost=boost; out.contName=cont.name; out.contStat=cont.stat; out.seasonPts=cr.pts;
      cr.history[hi].season=true; cr.history[hi].pct=Math.round((mul-1)*1000)/10;
      cr.contId=null;                                     // 次の大陸を選べる
    }else{ // DIVシーズン終了 → 全能力boost + 順位で昇格/残留/降格(WCCF風)
      const mul=Math.round((1+(CAREER.boostBase[cr.div]||0.01)*perf)*1000)/1000;
      const boost={pos:"all",stat:"all",mul};
      cr.boosts.push(boost);
      const table=careerStandings(cr), rank=Math.max(1,table.findIndex(r=>r.me)+1), size=table.length;
      const promoteRank=CAREER.promote[cr.div]||1;
      out.seasonEnd=true; out.boost=boost; out.seasonPts=cr.pts; out.seasonDiv=cr.div;
      out.rank=rank; out.size=size; out.champion=(rank===1);
      cr.history[hi].season=true; cr.history[hi].pct=Math.round((mul-1)*1000)/10; cr.history[hi].rank=rank;
      if(rank<=promoteRank){
        if(cr.div>1){cr.div--;out.promoted=true;} else {cr.stage="cont";out.toCont=true;} // DIV1優勝→大陸リーグへ
      }else if(cr.div<3&&rank>=size){ cr.div++; out.relegated=true; } // 最下位→降格
      else out.stayed=true;                                          // 昇格圏外→残留(来季再挑戦)
      cr.tableDiv=null; // 次シーズンで順位表を作り直す
    }
    cr.node=0;cr.pts=0;cr.gf=0;cr.ga=0;
  }
  return out;
}
// クラブ同士のノックアウト1試合をlv差で決着(引分なし・勝者idを返す)。
function simKnockout(a,b){
  const la=(OPP_CLUBS[a]||{}).lv||5, lb=(OPP_CLUBS[b]||{}).lv||5;
  const pA=Math.max(0.15,Math.min(0.85,0.5+(la-lb)*0.06));
  return Math.random()<pA?a:b;
}
// カップ1試合の結果処理(純粋・トーナメント)。当該回戦のあなたの試合を結果で、他カードは simKnockout で
// 同時進行して次の回戦(bracket[r+1])を生成。決勝を勝てば優勝、負け(引分PK負け含む)は敗退。
// pk={win,sa,sd}=引分をPKで決着した場合(win=自チーム勝ち)。無ければ引分=敗退。
function careerCupResult(cr,sh,sa,pk){
  const cup=cr.cup, r=cup.round, cur=(cup.bracket[r]||[]).slice();
  const res = sh>sa?"W" : sh<sa?"L" : (pk ? (pk.win?"W":"L") : "D");
  const next=[];
  for(let k=0;k<cur.length;k+=2){ const a=cur[k], b=cur[k+1];
    next.push((a==="__me"||b==="__me") ? (res==="W"?"__me":(a==="__me"?b:a)) : simKnockout(a,b)); }
  cup.bracket[r+1]=next; cup.round++;
  const roundName=roundLabel(cur.length), scLabel=sh+"-"+sa+(pk?` (PK ${pk.sa}-${pk.sd})`:"");
  (cr.history=cr.history||[])[cr.step]={act:"C",cup:cup.id,name:cup.name,res,sc:scLabel,round:roundName,opp:cr.oppName||"",pk:pk?(pk.win?"W":"L"):undefined};
  cr.step++;
  const out={res,cup,pk:!!pk,roundName};
  if(res==="W"){
    if(cup.round>=cup.rounds){ cr.cupsWon=cr.cupsWon||[]; cr.cupsWon.push(cup.id); out.champion=true; out.cup=cup; cr.cup=null; }
    else out.advance=true;
  }else{ // 敗退: 残りのブラケットをシミュして優勝クラブを決定(演出=誰が勝ち上がったか)
    let cont=next; while(cont.length>1){const nx=[];for(let k=0;k<cont.length;k+=2)nx.push(simKnockout(cont[k],cont[k+1]));cont=nx;}
    out.champId=cont[0]; out.eliminated=true; out.cup=cup; cr.cup=null;
  }
  return out;
}
function oppTeam(lv,club){
  if(typeof club==="string")club={form:club}; // 後方互換(form文字列)
  club=club||{};
  const form=club.form||"4-4-2"; // 省略時は従来通り4-4-2(テスト互換)
  const restore=(club.seed!=null)?seedRandom(club.seed):null; // seed指定でロスター固定(生成ロジックは不変=強さ不変)
  const avg=6.6+lv*1.0; // 1選手あたり平均ステ(クラブLv1≈7.6 → Lv8≈14.6)
  const kp=KEYPOS[form]||{};
  const cards=FORMS[form].map((sl,i)=>{
    const a=avg+ri(-1,1);
    const rar=a>=13?"sr":a>=10?"r":"n";
    const c=makeCard(subGroup(sl[0]),rar,null,sl[0]);
    if(club.flags)c.flag=rnd(club.flags); // テーマ国籍(任意・ワールドツアー用)
    scaleTo(c,a*6); // チームLvに応じて合計を微調整
    return {c,role:subGroup(sl[0]),subRole:sl[0],pen:1,x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  });
  const fwIdx=FORMS[form].map((sl,i)=>subGroup(sl[0])==="FW"?i:-1).filter(i=>i>=0);
  if(club.ace&&typeof makeSignature==="function"){ // エース固有選手(任意・意図的な難度UP。現行クラブ未使用)
    const i=fwIdx.length?rnd(fwIdx):FORMS[form].length-1;
    const sig=makeSignature(club.ace);
    if(sig)cards[i]={c:sig,role:subGroup(cards[i].subRole),subRole:cards[i].subRole,pen:1,x:cards[i].x,y:cards[i].y,enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  }else if(lv>=8){ // 最終ボスのエースはレジェンド(陣形のFW枠からランダムに1名)
    const i=fwIdx.length?rnd(fwIdx):FORMS[form].length-1;
    const sb=cards[i].subRole;
    cards[i]={c:makeCard(subGroup(sb),"l",null,sb),role:subGroup(sb),subRole:sb,pen:1,x:cards[i].x,y:cards[i].y,enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  }
  const t=buildTeam(cards,"A",form);
  if(lv>=8)t.mgr=aiMgr(1+Math.min(0.05,(lv-5)*0.01), lv>=10?"大陸の名将":lv>=9?"百戦の指揮官":"堅実な戦術家"); // 上位クラブ(ボス級)に監督バフ(仮)
  if(restore)restore();
  return t;
}
// ワールドツアーの相手国代表。全選手が同一国籍(=ケミ満タン)・高OVR(idxで上昇)。
// その国のシグネチャーを位置の合う枠へ注入。seedでロスター固定(偵察=本番一致)。
function worldTeam(nation,idx){
  const form=nation.form||"4-3-3";
  const restore=seedRandom(nation.seed||1);
  const avg=15.3+(idx||0)*0.10;                 // 1選手平均ステ(合計 idx0≈92 → idx15≈101、OVR約90→100)
  const kp=KEYPOS[form]||{};
  const cards=FORMS[form].map((sl,i)=>{
    const a=avg+ri(-1,1)*0.5;
    const c=makeCard(subGroup(sl[0]),"sr",null,sl[0]);
    c.flag=nation.flag;
    scaleTo(c,Math.round(a*6));
    return {c,role:subGroup(sl[0]),subRole:sl[0],pen:1,x:sl[1],y:sl[2],enter:0,
      keyStat:kp[i]||null,keyMul:kp[i]?KEY_MUL:1};
  });
  // シグネチャー注入: 同じ細分sub優先 → 同pos → 任意の未注入枠へ
  if(typeof SIGNATURES!=="undefined"&&typeof makeSignature==="function"){
    SIGNATURES.filter(s=>s.flag===nation.flag).forEach(sig=>{
      let i=cards.findIndex(p=>!p._sig&&p.subRole===sig.sub);
      if(i<0)i=cards.findIndex(p=>!p._sig&&subGroup(p.subRole)===sig.pos);
      if(i<0)i=cards.findIndex(p=>!p._sig);
      if(i>=0){const sc=makeSignature(sig.id);
        cards[i]={c:sc,role:sc.pos,subRole:sc.sub,pen:1,x:cards[i].x,y:cards[i].y,enter:0,
          keyStat:cards[i].keyStat,keyMul:cards[i].keyMul,_sig:1};}
    });
  }
  const t=buildTeam(cards,"A",form);
  t.mgr=aiMgr(1+Math.min(0.04,Math.max(0,((idx||0)-8))*0.008),"代表監督"); // ツアー上位代表に監督バフ(仮)
  if(restore)restore();
  return t;
}
function oppPickStyle(t){
  const wide=t.players.filter(p=>p.role!=="GK"&&(p.x<=30||p.x>=70));
  const fws=t.players.filter(p=>p.role==="FW"),mfs=t.players.filter(p=>p.role==="MF");
  const avg=(l,k)=>l.length?l.reduce((s,p)=>s+p.c[k],0)/l.length:0;
  const sc={center:avg(fws,"off")+avg(fws,"pow")*0.5,
    side:avg(wide,"spd")+avg(wide,"tec"),
    long:avg(fws,"spd")*1.4+avg(t.players.filter(p=>p.role!=="FW"),"tec")*0.4,
    short:avg(mfs,"tec")*1.6};
  let best="center",bv=-1;
  for(const k in sc){const v=sc[k]*(0.85+Math.random()*0.3);if(v>bv){bv=v;best=k;}}
  return best;
}
function situ(p,T,opT,min){
  const f=p.c.skill?p.c.skill.fx:{};
  let m=1;
  if(f.clutch&&min>=70)m*=f.clutch;
  if(f.losing&&T.score<opT.score)m*=f.losing;
  // エモーション(heat): 試合が"熱い"局面でのみ爆発(平時は等倍)。volt>gate で立ち上がり、volt=1で heat 倍。
  // 終盤(clutch)/ビハインド(losing)と相乗し、大舞台ほど手がつけられなくなる。
  if(f.heat&&MC){const g=0.35; if(MC.volt>g)m*=1+(f.heat-1)*((MC.volt-g)/(1-g));}
  return m;
}
// 有効値: 全マッチアップ・シュート・GK守備の単一集約点(pen×疲労×状況×ケミ×キーポジ)
// 名将ブースト: 自チーム(T.mgr)のみ、対象ポジ×ステを乗算(勝敗式に少し有利)。
function mgrMul(p,k,T){
  const m=T&&T.mgr; if(!m)return 1;
  let mul=1;
  for(const b of mgrBoosts(m)){ // カスタム監督は複数boostを全乗算(名将は単数=従来通り)
    const posOk=b.pos==="all"||p.role===b.pos, statOk=b.stat==="all"||b.stat===k;
    if(posOk&&statOk)mul*=(b.mul||1);
  }
  return mul;
}
function eff(p,k,min,T,opT){
  const km=p.keyStat===k?(p.keyMul||1):1;
  const surge=(T&&T._surgeUntil&&min<T._surgeUntil)?(T._surgeMul||1):1; // 国際チームスキル(kind:team)発動中の一時バフ
  const base=p.c[k]+(p.grow?(p.grow[k]||0):0); // 育成の成長値(キャリア限定・上限別枠。非キャリアはnull=不変)
  return base*p.pen*fatigue(p,min)*situ(p,T,opT,min)*(T&&T.chem||1)*km*mgrMul(p,k,T)*surge*(p.cond||1)*(T&&T.ctrl||1); // p.cond=調子 / T.ctrl=統制超過ペナルティ
}
// 名将/カスタム監督の采配シグネ(条件付き戦略アクション・演出のみのトリガー判定)。
// 自チーム(H)が持つ tac 群から条件を満たす守備采配(cb=密集ブロック)を1つ返す(発動抽選は呼び出し側)。
function mgrCbTac(team){
  if(!team||team.side!=="H"||!team.mgr)return null;
  for(const t of mgrTacs(team.mgr)){ if(t.from==="cb"&&tacCondMet(t,team))return t; }
  return null;
}
function tacCondMet(tac,team){return tac.cond.every(([sub,st,th])=>team.players.some(p=>p.subRole===sub&&p.c[st]>=th));}
function tacFromMatch(tac,carrier){const f=tac.from,sr=carrier&&carrier.subRole;
  return f==="sb"?(sr==="LSB"||sr==="RSB"):f==="cb"?sr==="CB":f==="omf"?sr==="OMF":f==="wg"?(sr==="LWG"||sr==="RWG"):false;}
function fx(p){return p.c.skill?p.c.skill.fx:{};}
function midPower(T,opT,min){
  let m=0;
  T.players.forEach(p=>{
    const w=(p.role==="MF"?TUNING.mid.mf:TUNING.mid.other)*(fx(p).mid||1)*typeOf(p.c).poss;
    m+=(eff(p,"tec",min,T,opT)*TUNING.mid.tec+eff(p,"spd",min,T,opT)*TUNING.mid.spd+eff(p,"sta",min,T,opT)*TUNING.mid.sta)*w;
  });
  const tf=T.tactic==="atk"?TUNING.midTactic.atk:T.tactic==="def"?TUNING.midTactic.def:1;
  const sf=(STYLES[T.style]||{}).mid||1;
  return m*tf*sf;
}
// 支配力(control): mid スキル保有と支配型(type.poss)の超過分を合算した「試合を落ち着かせ押し上げる力」。1+ を返す。
// モメンタムの獲得倍率・相手モメンタムへの耐性・テリトリー基準ラインに効く(=mid支配率スキルの有効化)。
function flowControl(T){
  let c=0;
  T.players.forEach(p=>{ if(p.role==="GK")return;
    c += Math.max(0,(fx(p).mid||1)-1) + Math.max(0,(typeOf(p.c).poss||1)-1)*0.5; });
  return 1+c;
}
function pickW(list,wfn){
  if(!list.length)return null;
  const tot=list.reduce((s,x)=>s+wfn(x),0);let r=Math.random()*tot;
  for(const x of list){r-=wfn(x);if(r<=0)return x;}
  return list[list.length-1];
}
const isWide=p=>p.role!=="GK"&&(p.x<=30||p.x>=70);
function pickAttacker(T){return pickW(T.players.filter(p=>p.role!=="GK"),p=>(p.role==="FW"?3:p.role==="MF"?1.5:0.3)*(typeOf(p.c).atk||1)*ageInv(p));}
function pickDefender(T){return pickW(T.players.filter(p=>p.role!=="GK"),p=>(p.role==="DF"?3:p.role==="MF"?1:0.2)*(typeOf(p.c).defSel||1));}
function pickWide(T){const ws=T.players.filter(p=>isWide(p)||(p.role!=="GK"&&typeOf(p.c).wideSel));return ws.length?pickW(ws,p=>(p.c.spd+p.c.tec)*(typeOf(p.c).wideSel?1.25:1)*ageInv(p)):pickAttacker(T);}
function pickWideDef(T){const ws=T.players.filter(p=>p.role==="DF"&&(p.x<=35||p.x>=65));return ws.length?rnd(ws):pickDefender(T);}
function pickTarget(T){return pickW(T.players.filter(p=>p.role==="FW"||p.role==="MF"),p=>(p.role==="FW"?3:0.4)*(typeOf(p.c).tgt||1)*ageInv(p));}
function pickPasser(T){return pickW(T.players.filter(p=>p.role!=="FW"),p=>(p.role==="MF"?2:1)*p.c.tec*(typeOf(p.c).pas||1)*ageInv(p));}
function pickPress(T){return pickW(T.players.filter(p=>p.role==="MF"||p.role==="DF"),p=>p.c.spd+p.c.def);}
function pickGK(T){return T.players.find(p=>p.role==="GK")||T.players[0];}
const rr=()=>TUNING.rng.min+Math.random()*TUNING.rng.span;

// ===== 起点(オリジン)選択: 開放playの4チャンネル(純粋ロジック) =====
// プレス強度(奪取力): 守備で動く選手の def+spd をポジション/型で重み付け
function pressPower(T,opp,min){
  let s=0;
  T.players.forEach(p=>{
    if(p.role==="GK")return;
    const ty=typeOf(p.c);
    const w=(p.role==="DF"?1:p.role==="MF"?0.9:0.5)*(ty.defSel||1);
    s+=(eff(p,"def",min,T,opp)*0.6+eff(p,"spd",min,T,opp)*0.4)*w;
  });
  return s;
}
// ビルドの安全度(奪われにくさ): tec×支配
function buildSecurity(T,opp,min){
  let s=0;
  T.players.forEach(p=>{ if(p.role!=="GK") s+=eff(p,"tec",min,T,opp)*typeOf(p.c).poss; });
  return s;
}
// 奪取(カウンター)判定: 守備側Dが攻撃側Tからボールを奪うか。専用ロングカウンター抽選の置換。
function rollTurnover(T,D,min){
  const press=pressPower(D,T,min)*(D.tactic==="atk"?TUNING.origin.pressAtk:1);
  const sec=buildSecurity(T,D,min)/(T.tactic==="atk"?TUNING.origin.riskAtk:1);
  return Math.random()<TUNING.origin.turnoverBase*press/(press+sec||1);
}
// 奪取者: 高(def+spd)の選手(FW/MF/DF可。"高DFのFW"が前で奪う等)
function pickWinner(D,opp,min){
  return pickW(D.players.filter(p=>p.role!=="GK"),p=>{
    const ty=typeOf(p.c);
    return (eff(p,"def",min,D,opp)*0.5+eff(p,"spd",min,D,opp)*0.5)*(ty.defSel||0.8)*(p.role==="FW"?1.1:1)*ageInv(p);
  });
}
// 深い位置の選手(feedチャンネルの担い手): DF全員 + 低い位置取りのMF(アンカー等)
function isDeep(p){return p.role==="DF"||(p.role==="MF"&&typeOf(p.c).adv<0);}
// チャンネルの代表強度(count正規化＝平均)。選手数の多寡で偏らないようにする。
function chanAvg(T,filter,statfn){
  const ps=T.players.filter(filter);
  return ps.length?ps.reduce((s,p)=>s+statfn(p),0)/ps.length:0;
}
// 攻撃チャンネル レジストリ(開放play)。weight=選好の強度 / pickOrigin=起点選手の抽選 /
// base=混合比 / buildup=攻撃成立率 / maxLink=最大つなぎ数。win(カウンター)は奪取専用で weight/pickOrigin 無し。
// 追加=1エントリで pickChannel/pickOriginPlayer/buildupSuccess/runChain が自動対応。
const CHANNELS={
  build:  { base:3.2, buildup:0.34, maxLink:4,
    weight:(T,opp,min)=>chanAvg(T,p=>p.role==="MF", p=>eff(p,"tec",min,T,opp)*typeOf(p.c).poss),
    pickOrigin:(T,opp,min)=>pickW(T.players.filter(p=>p.role!=="GK"),p=>(p.role==="MF"?2.2:p.role==="DF"?0.5:1.2)*eff(p,"tec",min,T,opp)*typeOf(p.c).poss*ageInv(p)) },
  overlap:{ base:1.3, buildup:0.36, maxLink:3,
    weight:(T,opp,min)=>chanAvg(T,p=>isWide(p)&&p.role!=="GK", p=>(eff(p,"spd",min,T,opp)+eff(p,"tec",min,T,opp))/2*(typeOf(p.c).wideSel?1.2:1)),
    pickOrigin:(T,opp,min)=>{const ws=T.players.filter(p=>isWide(p)&&p.role!=="GK");return ws.length?pickW(ws,p=>(eff(p,"spd",min,T,opp)+eff(p,"tec",min,T,opp))*(typeOf(p.c).wideSel?1.3:1)*ageInv(p)):pickAttacker(T);} },
  feed:   { base:1.1, buildup:0.31, maxLink:2,
    weight:(T,opp,min)=>chanAvg(T,isDeep, p=>eff(p,"tec",min,T,opp)),
    pickOrigin:(T,opp,min)=>{const ds=T.players.filter(isDeep);return ds.length?pickW(ds,p=>eff(p,"tec",min,T,opp)*typeOf(p.c).poss*ageInv(p)):pickPasser(T);} },
  win:    { buildup:0.60, maxLink:2 }, // 奪取(カウンター)専用。起点は pickWinner、weight無し=pickChannelの抽選外。
};
function chanMaxLink(channel){return (CHANNELS[channel]||{}).maxLink??3;}
// 通常起点のチャンネル選択。weightを持つチャンネルのみ対象に、基準重み×スタイルバイアスで抽選。
// terr(-1..1)=攻撃側のテリトリー傾向。押し込むほど高い起点(build/overlap)、押されるほど深い起点(feed)を好む。
function pickChannel(T,opp,min,terr){
  const bias=(STYLES[T.style]||{}).channelBias||{}, w={};
  const tb=TUNING.flow.chanBias*(terr||0), terrMul={build:1+tb*0.6, overlap:1+tb, feed:1-tb};
  for(const id in CHANNELS){ const ch=CHANNELS[id]; if(!ch.weight)continue;
    w[id]=ch.weight(T,opp,min)*ch.base*(bias[id]||1)*Math.max(0.15,terrMul[id]||1); }
  return pickW(Object.keys(w),k=>w[k]);
}
// チャンネル内の起点選手を抽選
function pickOriginPlayer(T,opp,channel,min){
  return (CHANNELS[channel]||CHANNELS.build).pickOrigin(T,opp,min);
}
// ビルドアップ成功(攻撃が形になるか)。失敗=保持崩れ(攻撃イベントなし)。edge=Tの支配率シェア(0..1)。
function buildupSuccess(channel,edge){
  const b=(CHANNELS[channel]||{}).buildup??0.55;
  return Math.random()<b*(0.8+edge*0.4);
}

// ===== 連鎖チェーンのマッチアップ&リンク(純粋ロジック) =====
const stamOf=(p,min)=>fatigue(p,min); // 現在のスタミナ係数(疲れると低下)
const laneOf=p=>p.x;                                   // 静的レーン(左右0-100)。マッチアップの主基準
// ポジションマッチアップ: 受け手のレーンに対応する守備者(左右ミラー=100-lane)。静的レーン主体。
function matchupDefender(recv,D){
  const target=100-laneOf(recv);
  return pickW(D.players.filter(p=>p.role!=="GK"),p=>{
    const dist=Math.abs(laneOf(p)-target);
    const roleW=p.role==="DF"?1:p.role==="MF"?0.5:0.15;
    return roleW*Math.max(0.06,1-dist/55);            // レーンが近いほど対応しやすい
  })||pickDefender(D);
}
// リンク種別の選択重み(=個性)。dribble/cutin は off/spd/tec×スタミナ×type.drive でエゴが出る。
function linkWeight(type,p,min,A,D){
  const ty=typeOf(p.c), b=TUNING.link.base[type]||1, es=TUNING.link.egoStat;
  const ego=(eff(p,"off",min,A,D)*es.off+eff(p,"spd",min,A,D)*es.spd+eff(p,"tec",min,A,D)*es.tec)*stamOf(p,min)*(ty.drive||1);
  switch(type){
    case "combination":
    case "through":  return b*eff(p,"tec",min,A,D)*(ty.pas||1);
    case "cross":    return b*eff(p,"tec",min,A,D)*(ty.wideSel?1.3:1);
    case "dribble":
    case "cutin":    return b*ego;
  }
  return b;
}
// リンクの競り合い判定(種別ごとのステ配合)。true=成功。resolveDuelと同形。
function resolveLink(type,atk,df,A,D,min,tfA,tfD,bonus){
  let aSc,dSc,thr;
  switch(type){
    case "combination":
      aSc=eff(atk,"tec",min,A,D)*(fx(atk).duelTec||fx(atk).mid||1); thr=TH.chain;
      dSc=(eff(df,"def",min,D,A)*0.5+eff(df,"spd",min,D,A)*0.5)*(fx(df).duelD||1); break;
    case "through":
      aSc=eff(atk,"spd",min,A,D)*(fx(atk).duelSpd||1); thr=TH.longRace;
      dSc=(eff(df,"spd",min,D,A)*0.55+eff(df,"def",min,D,A)*0.45)*(fx(df).duelD||1); break;
    case "cross":
      aSc=(eff(atk,"pow",min,A,D)*0.55+eff(atk,"off",min,A,D)*0.25+eff(atk,"spd",min,A,D)*0.2)*(fx(atk).duelPow||1); thr=TH.cross;
      dSc=(eff(df,"pow",min,D,A)*0.5+eff(df,"def",min,D,A)*0.5)*(fx(df).duelD||1); break;
    default: // dribble / cutin
      aSc=(eff(atk,"off",min,A,D)*0.4+eff(atk,"spd",min,A,D)*0.3+eff(atk,"tec",min,A,D)*0.3)*(fx(atk).duelSpd||fx(atk).duelTec||1); thr=TH.duel;
      dSc=(eff(df,"def",min,D,A)*0.6+eff(df,"spd",min,D,A)*0.4)*(fx(df).duelD||1); break;
  }
  aSc*=A.teamChance*tfA*(bonus||1)*rr();
  dSc*=D.teamDef*lineDefMul(D,min)*tfD*rr();
  return aSc>dSc*thr;
}

// セットプレー: フィニッシュ系リンクでの守備側ファウル判定 → "pk"(エリア内) / "fk" / null。
function rollFoul(df,linkType,atk){
  const sp=TUNING.setpiece;
  const draw=(atk&&fx(atk).drawFoul)||1;   // 仕掛けの名手はファウルを誘発(エモーショナル等)=看板FK/PKの登場を増やす
  if(Math.random()>=sp.foulBase*(typeOf(df.c).defSel?1.15:1)*draw)return null; // 守備的な型ほど僅かにファウル増
  return Math.random()<(sp.boxChance[linkType]||0.25)?"pk":"fk";
}
// セットプレーのキッカー: FK専門家(fx.freekick=エモーショナル等)が居れば最優先、無ければ最良シューター(攻×技)。
function pickShooter(A){
  const fks=A.players.filter(p=>p.role!=="GK"&&fx(p).freekick);
  if(fks.length)return pickW(fks,p=>p.c.tec+p.c.off);
  return pickW(A.players.filter(p=>p.role!=="GK"),p=>p.c.off*1.2+p.c.tec)||A.players[0];
}

// ===== 勝敗判定(純粋関数・DOM/演出/stat更新を持たない) =====
// 中央1対1の勝敗。攻撃側スコア > 守備側スコア×TH.duel で突破。rr()消費順は aSc→dSc(乱数列を保持)。
function resolveDuel(atk,df,type,A,D,min,tfA,tfD,bonus){
  const duelKey="duel"+type[0].toUpperCase()+type.slice(1);
  const aSc=eff(atk,type,min,A,D)*(fx(atk)[duelKey]||1)*A.teamChance*tfA*bonus*ageCompose(atk)*rr(); // 年齢: ベテランほど勝負強い
  const dSc=(eff(df,"def",min,D,A)*0.62+eff(df,type,min,D,A)*0.38)*(fx(df).duelD||1)*D.teamDef*lineDefMul(D,min)*tfD*ageCompose(df)*rr();
  return aSc>dSc*TH.duel;
}
// シュート vs GK。得点なら true。rr()消費順は sSc→gSc。
function resolveShot(atk,gk,header,A,D,min){
  const sBase=header
    ?eff(atk,"off",min,A,D)*0.45+eff(atk,"pow",min,A,D)*0.55
    :eff(atk,"off",min,A,D)*0.7+eff(atk,"pow",min,A,D)*0.3;
  const sSc=sBase*(fx(atk).shoot||1)*ageCompose(atk)*rr(); // 年齢: ベテランほど決め切る
  const gSc=eff(gk,"def",min,D,A)*(fx(gk).save||1)*D.teamDef*lineDefMul(D,min)*ageCompose(gk)*rr();
  return sSc>gSc*TH.gk;
}
