const { setup } = require("./_setup");
const E = setup({ timeoutFlat: 1, tmpName: "_tmp_scaletest.js", exports: "makeCard,oppTeam" });
(async () => {
  await E.boot();
  for (const rar of ["l", "sr", "r", "n"]) {
    let sums = [], mins = 20, maxs = 1;
    for (let i = 0; i < 500; i++) {
      const c = E.makeCard(null, rar);
      const t = c.off + c.def + c.pow + c.tec + c.spd + c.sta;
      sums.push(t);
      [c.off, c.def, c.pow, c.tec, c.spd, c.sta].forEach(v => { mins = Math.min(mins, v); maxs = Math.max(maxs, v); });
    }
    const avg = sums.reduce((a, b) => a + b, 0) / sums.length;
    console.log(`${rar.toUpperCase().padEnd(3)} 合計平均:${avg.toFixed(1)} (目標${({ l: 100, sr: 90, r: 70, n: 55 })[rar]}) 値域:${mins}-${maxs}`);
  }
  // 対戦相手の強さ(平均ステ)がLvで上がるか
  for (const lv of [1, 4, 8]) {
    const t = E.oppTeam(lv);
    const avg = t.players.reduce((s, p) => s + (p.c.off + p.c.def + p.c.pow + p.c.tec + p.c.spd + p.c.sta), 0) / t.players.length / 6;
    console.log(`Lv${lv} 相手の平均ステ/項目:${avg.toFixed(1)}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
