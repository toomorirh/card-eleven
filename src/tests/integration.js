// フル試合の統合テスト(20倍速)
const { setup } = require("./_setup");
const E = setup({
  timeoutDiv: 20,
  tmpName: "_tmp_integration.js",
  exports: `trySub:()=>{ // 30分時点で交代を1回実行するシミュレーション
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
  }`,
});
(async () => {
  await E.boot();
  console.log("初期化OK 所持:", E.getS().coll.length, "枚");
  E.start(0);
  let subDone = false;
  while (E.getMC()) {
    const M = E.getMC();
    if (M && M.min >= 30 && !subDone) { subDone = E.trySub(); if (subDone) console.log("30分:交代実行OK"); }
    await E._wait(50);
  }
  console.log("試合完走OK コイン:", E.getS().coins, "クリア:", E.getS().cleared);
  // 各スタイルで完走確認
  for (const st of ["side", "long", "short"]) {
    E.start(0);
    const M2 = E.getMC(); M2.home.style = st;
    while (E.getMC()) await E._wait(50);
    console.log(st + "戦術で完走OK");
  }
  process.exit(0);
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
