// ================= 中検証(Tier 1): 試合インパクト・シム =================
// シナリオ3(EVEN/GAP/TACT)×陣形3(4-4-2/4-3-3/3-5-2)を seed 付きで多数試合回し、
// 「試合フィンガープリント」(得点/勝率/シュート/関与の散り/採点 等)を平均±95%CIで算出する。
//
// 使い方:
//   node src/tests/matchsim.js            … 全セルを回して表を表示
//   node src/tests/matchsim.js --n=200    … 1セルあたりの試合数を変更(既定300)
//   node src/tests/matchsim.js --save     … 現状を baseline_metrics.json に保存(ベースライン採取)
//   node src/tests/matchsim.js --check    … baseline_metrics.json と比較し、各指標Δの有意/誤差内を判定
//
// 高速化: transform で sleep を即解決にし、描画(DOM)はモックのまま no-op。試合は tickAsync を直接回す。
// 比較の考え方:
//   ・挙動不変の保証 → 別途ペア・シード(同seedで結果一致)で確認する想定(本ファイルは分布比較)。
//   ・意図的変更の影響 → ここで多数シードの分布を平均±CIで比較し、|Δ| が合成CIを超えたら「有意」。
"use strict";
const fs = require("fs");
const path = require("path");
const { setup } = require("./_setup");

const BASELINE = path.join(__dirname, "baseline_metrics.json");
const FORMS3 = ["4-4-2", "4-3-3", "3-5-2"];
const STYLES4 = ["center", "side", "long", "short"];

const argv = process.argv.slice(2);
const getArg = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const N = parseInt(getArg("n", "300"), 10);
const SAVE = argv.includes("--save");
const CHECK = argv.includes("--check");

const E = setup({
  timeoutFlat: 1,
  tmpName: "_tmp_matchsim.js",
  exports: "oppTeam,buildTeam,tickAsync,oppPickStyle,statRating,FORMS,__setMC",
  // sleep を即解決(アニメ/待ち時間ゼロ) + MC セッターを注入
  transform: src => src
    .replace("const sleep=ms=>new Promise(r=>setTimeout(r,ms));", "const sleep=ms=>Promise.resolve();")
    .replace("let MC=null;", "let MC=null;\nfunction __setMC(v){MC=v;}"),
});

// ---- 統計ユーティリティ ----
function stats(arr) {
  const n = arr.length;
  if (!n) return { mean: 0, ci: 0, n: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const v = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const ci = 1.96 * Math.sqrt(v) / Math.sqrt(n);
  return { mean, ci, n };
}

// ---- 1試合シム ----
function makeSide(form, lv, side) {
  const t = E.oppTeam(lv, { form });   // oppTeam は side "A" で生成
  t.side = side;
  t.players.forEach(p => p.fside = side);
  return t;
}
async function simMatch(opt) {
  const S = E.getS();
  S.tactic = opt.tacticH || "bal";
  const home = makeSide(opt.form, opt.lvH, "H");
  const away = makeSide(opt.form, opt.lvA, "A");
  // styleH "auto" = AIと同じ方策(oppPickStyle)で自陣も最適選択 → EVEN/GAPを左右対称に。
  S.style = opt.styleH === "auto" ? E.oppPickStyle(home) : (opt.styleH || "center");
  away.style = opt.styleA || E.oppPickStyle(away);
  E.__setMC({ home, away, min: 0, ball: 50, bx: 50, by: 50, idx: 0, name: "SIM", lv: opt.lvA, subs: 3, halt: false, loop: false });
  let guard = 0;
  let MC;
  while ((MC = E.getMC()) && MC.min < 90 && guard++ < 120) await E.tickAsync();
  MC = E.getMC();
  const res = collect(MC);
  E.__setMC(null);
  return res;
}
function collect(M) {
  const all = [...M.home.players, ...M.away.players];
  const invs = all.map(p => p.stat.inv || 0);
  const roleInv = { GK: 0, DF: 0, MF: 0, FW: 0 };
  all.forEach(p => roleInv[p.role] += (p.stat.inv || 0));
  const totalInv = invs.reduce((a, b) => a + b, 0) || 1;
  let shots = 0;
  all.forEach(p => shots += p.stat.shots || 0);
  const goals = M.home.score + M.away.score;
  const ratings = [
    ...M.home.players.map(p => E.statRating(p, M.away)),
    ...M.away.players.map(p => E.statRating(p, M.home)),
  ];
  const rs = stats(ratings);
  // 関与の集中度(変動係数 CV = sd/mean)。低いほど全選手に散っている。
  const im = invs.reduce((a, b) => a + b, 0) / invs.length;
  const isd = Math.sqrt(invs.reduce((a, b) => a + (b - im) ** 2, 0) / invs.length);
  const out = {
    hs: M.home.score, as: M.away.score, goals, shots,
    homeWin: M.home.score > M.away.score ? 1 : 0,
    draw: M.home.score === M.away.score ? 1 : 0,
    conv: shots ? goals / shots : null,
    shareFW: roleInv.FW / totalInv, shareMF: roleInv.MF / totalInv,
    shareDF: roleInv.DF / totalInv, shareGK: roleInv.GK / totalInv,
    invCV: im ? isd / im : 0,
    ratingMean: rs.mean, ratingSD: Math.sqrt(ratings.reduce((a, b) => a + (b - rs.mean) ** 2, 0) / ratings.length),
  };
  // 起点テレメトリ(新エンジン): MC.telemetry に両チーム合算で記録される
  const t = M.telemetry;
  if (t && t.atks) {
    out.chBuild = t.ch.build / t.atks; out.chOverlap = t.ch.overlap / t.atks; out.chFeed = t.ch.feed / t.atks; out.chWin = t.ch.win / t.atks;
    out.orMF = t.role.MF / t.atks; out.orDF = t.role.DF / t.atks; out.orFW = t.role.FW / t.atks; out.orGK = t.role.GK / t.atks;
    out.atks = t.atks;
  }
  return out;
}

// ---- セルを N 試合回して指標化 ----
async function runCell(label, baseSeed, opt) {
  const cols = {};
  const push = (k, v) => { if (v != null) (cols[k] = cols[k] || []).push(v); };
  for (let i = 0; i < N; i++) {
    const r = await seeded(baseSeed + i, () => simMatch(opt));
    push("gpm", r.goals); push("shots", r.shots); push("homeWin", r.homeWin);
    push("draw", r.draw); push("conv", r.conv); push("invCV", r.invCV);
    push("shareFW", r.shareFW); push("shareMF", r.shareMF); push("shareDF", r.shareDF); push("shareGK", r.shareGK);
    push("ratingMean", r.ratingMean); push("ratingSD", r.ratingSD);
    // 起点テレメトリ(新エンジンのみ存在)
    push("atks", r.atks); push("chBuild", r.chBuild); push("chOverlap", r.chOverlap); push("chFeed", r.chFeed); push("chWin", r.chWin);
    push("orMF", r.orMF); push("orDF", r.orDF); push("orFW", r.orFW); push("orGK", r.orGK);
  }
  const out = {};
  for (const k in cols) out[k] = stats(cols[k]);
  return { label, metrics: out };
}
// seed を Math.random に適用して fn を実行(seedRandom はエンジン側に存在)
async function seeded(seed, fn) {
  const orig = Math.random;
  let s = seed >>> 0;
  Math.random = function () {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try { return await fn(); } finally { Math.random = orig; }
}

async function runAll() {
  const cells = [];
  let seed = 1000;
  for (const form of FORMS3) {
    cells.push(await runCell(`EVEN|${form}`, seed += 100000, { form, lvH: 5, lvA: 5, styleH: "auto" }));
    cells.push(await runCell(`GAP|${form}`, seed += 100000, { form, lvH: 6, lvA: 4, styleH: "auto" }));
    for (const st of STYLES4)
      cells.push(await runCell(`TACT|${form}|${st}`, seed += 100000, { form, lvH: 5, lvA: 5, styleH: st, styleA: "center" }));
  }
  return cells;
}

// ---- 出力/保存/比較 ----
const KEYS = ["gpm", "shots", "conv", "homeWin", "draw", "invCV", "shareFW", "shareMF", "shareDF", "ratingMean", "ratingSD"];
function fmt(m) { return m ? `${m.mean.toFixed(3)}±${m.ci.toFixed(3)}` : "—"; }
const KEYS_ORIGIN = ["atks", "chBuild", "chOverlap", "chFeed", "chWin", "orMF", "orDF", "orFW", "orGK"];
function printTable(cells) {
  console.log(`\n中検証(Tier1)  N=${N}/セル  指標=平均±95%CI\n`);
  console.log(["cell".padEnd(20), ...KEYS.map(k => k.padStart(13))].join(""));
  for (const c of cells)
    console.log([c.label.padEnd(20), ...KEYS.map(k => fmt(c.metrics[k]).padStart(13))].join(""));
  // 起点テレメトリ(新エンジンで値が入る。旧エンジンでは空)
  if (cells.some(c => c.metrics.atks)) {
    console.log(`\n起点テレメトリ(チャンネル比/起点役職比)\n`);
    console.log(["cell".padEnd(20), ...KEYS_ORIGIN.map(k => k.padStart(13))].join(""));
    for (const c of cells)
      console.log([c.label.padEnd(20), ...KEYS_ORIGIN.map(k => fmt(c.metrics[k]).padStart(13))].join(""));
  }
}
function toJSON(cells) {
  const o = {};
  for (const c of cells) { o[c.label] = {}; for (const k in c.metrics) o[c.label][k] = { mean: c.metrics[k].mean, ci: c.metrics[k].ci }; }
  return o;
}
function compare(cells, base) {
  let sig = 0, tot = 0;
  console.log(`\nベースライン比較(|Δ| > 合成95%CI を「有意 ▲▼」と判定)  N=${N}\n`);
  console.log(["cell".padEnd(20), ...KEYS.map(k => k.padStart(15))].join(""));
  for (const c of cells) {
    const b = base[c.label];
    const row = [c.label.padEnd(20)];
    for (const k of KEYS) {
      const now = c.metrics[k], was = b && b[k];
      if (!now || !was) { row.push("—".padStart(15)); continue; }
      const d = now.mean - was.mean, cc = Math.sqrt(now.ci ** 2 + was.ci ** 2);
      tot++;
      const significant = Math.abs(d) > cc;
      if (significant) sig++;
      const mark = significant ? (d > 0 ? "▲" : "▼") : "—";
      row.push(`${mark}${d >= 0 ? "+" : ""}${d.toFixed(3)}`.padStart(15));
    }
    console.log(row.join(""));
  }
  console.log(`\n有意に動いた指標: ${sig}/${tot}`);
  return sig;
}

(async () => {
  await E.boot();
  const t0 = Date.now();
  const cells = await runAll();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  printTable(cells);
  console.log(`\n総試合数: ${cells.length * N}  所要: ${secs}s`);
  if (SAVE) {
    fs.writeFileSync(BASELINE, JSON.stringify(toJSON(cells), null, 2));
    console.log(`\nベースライン保存 -> ${path.relative(process.cwd(), BASELINE)}`);
  } else if (CHECK) {
    if (!fs.existsSync(BASELINE)) { console.error("baseline_metrics.json がありません(--save で作成)"); process.exit(2); }
    compare(cells, JSON.parse(fs.readFileSync(BASELINE, "utf8")));
  }
  process.exit(0);
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
