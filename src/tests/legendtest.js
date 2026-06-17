// レジェンド機能の検証
const { setup } = require("./_setup");
const E = setup({ timeoutFlat: 1, tmpName: "_tmp_legendtest.js", exports: "makeCard,oppTeam,drawPack" });
(async () => {
  await E.boot();
  // 1) レジェンドカードの生成
  const ls = [];
  for (let i = 0; i < 200; i++) ls.push(E.makeCard(null, "l"));
  const avg = ls.reduce((s, c) => s + c.off + c.def + c.pow + c.tec + c.spd + c.sta, 0) / 200 / 6;
  const allLskill = ls.every(c => c.skill && ["奇跡の手", "絶対領域", "鉄壁の壁", "守護王", "王の視野", "マエストロ", "伝説の一撃", "覇王"].includes(c.skill.name));
  console.log("L平均ステ:", avg.toFixed(2), "(SR基準7台後半〜8台ならOK) 専用スキル100%:", allLskill);
  // 2) 最終ボスにレジェンドが混ざる
  const boss = E.oppTeam(8);
  console.log("Lv8ボスのレジェンド:", boss.players.filter(p => p.c.rar === "l").map(p => p.c.name + "【" + p.c.skill.name + "】").join(",") || "なし(NG)");
  // 3) ドロップ率の実測(300試合・勝敗内訳つき)
  E.getS().legendPacks = 0;
  let w = 0, d = 0, l = 0;
  for (let m = 0; m < 300; m++) {
    const before = E.getS().coins;
    E.start(0);
    while (E.getMC()) await E._wait(5);
    const r = E.getS().coins - before;
    if (r === 140) w++; else if (r === 50) d++; else l++;
  }
  const exp = (w * 0.18 + d * 0.08 + l * 0.04).toFixed(1);
  console.log(`300試合: 勝${w} 分${d} 負${l} → パック${E.getS().legendPacks}個(期待値${exp})`);
  // 4) パック開封
  E.getS().legendPacks = 20;
  const before = E.getS().coll.length;
  for (let i = 0; i < 20; i++) E.drawPack("legend");
  const got = E.getS().coll.slice(before);
  console.log("20連開封:", got.map(c => c.rar).join(","));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
