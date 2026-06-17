const { setup } = require("./_setup");
const E = setup({ timeoutFlat: 1, tmpName: "_tmp_progtest2.js", exports: "makeCard,FORMS" });
(async () => {
  await E.boot(); const S = E.getS();
  function setDeck(rar) { S.coll = []; S.squad = {}; E.FORMS["4-4-2"].forEach((sl, i) => { const c = E.makeCard(sl[0], rar); S.coll.push(c); S.squad[i] = c.id; }); }
  // 試合スコアを直接読む(MCが消える直前の値を捕捉)
  async function playOnce(idx) {
    E.start(idx); let last = null;
    while (E.getMC()) { const M = E.getMC(); last = { h: M.home.score, a: M.away.score }; await E._wait(3); }
    return last;
  }
  console.log("=== 想定進行(無改変エンジン・スコア直読み) ===");
  const plan = [["n", 0], ["n", 1], ["r", 2], ["r", 3], ["sr", 4], ["sr", 5], ["sr", 6], ["l", 7]];
  for (const [rar, idx] of plan) {
    setDeck(rar); let w = 0, d = 0, l = 0; const N = 60;
    for (let g = 0; g < N; g++) {
      const r = await playOnce(idx); if (!r) continue;
      if (r.h > r.a) w++; else if (r.h < r.a) l++; else d++;
    }
    console.log(`${rar.toUpperCase().padEnd(2)}デッキ→Lv${idx + 1}: 勝率${(w / N * 100).toFixed(0)}% (W${w}/D${d}/L${l})`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
