#!/usr/bin/env node
/*
 * tools/gen_reference.js — data.js から選手/タイプの参照表を自動生成する。
 *
 * 値の正本は常に src/js/data.js。この表は「読みやすい一覧」を提供するだけで、
 * データを二重管理しない(手書き転記による同期ズレを避ける)。
 *
 *   実行:  node tools/gen_reference.js
 *   出力:  docs/reference/signatures.md   (固有選手/エモーショナルのパラメータ表)
 *          docs/reference/playstyles.md   (プレースタイル20種の係数表)
 *
 * SIGNATURES / EMOTIONALS を追加・調整したら再実行して docs/reference を更新する。
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "src/js/data.js"), "utf8");

// data.js から「const NAME=<開き括弧> … <対応する閉じ括弧>」を括弧対応で切り出して eval する。
// 対象は純粋なリテラル(文字列/数値/絵文字/入れ子オブジェクト)のみなので eval は安全。
function extractLiteral(name, open, close) {
  const key = "const " + name + "=" + open;
  const start = src.indexOf(key);
  if (start < 0) throw new Error("not found: " + name);
  let depth = 0, i = start + key.length - 1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { i++; break; } }
  }
  const lit = src.slice(start + key.length - 1, i);
  // eslint-disable-next-line no-eval
  return eval("(" + lit + ")");
}

const SIGNATURES = extractLiteral("SIGNATURES", "[", "]");
const EMOTIONALS = extractLiteral("EMOTIONALS", "[", "]");
const TYPES = extractLiteral("TYPES", "{", "}");
const SKILLS = extractLiteral("SKILLS", "{", "}");   // 通常スキル(ポジ×レア r/sr の [name,desc,fx])
const LSKILLS = extractLiteral("LSKILLS", "{", "}"); // レジェンド専用スキル(ポジ別 [name,desc,fx])
const MANAGERS = extractLiteral("MANAGERS", "[", "]");     // 名将(boost + tac 采配)
const CAREER_TACS = extractLiteral("CAREER_TACS", "{", "}"); // 采配プール basic/strong/team
const TAC_FROM = extractLiteral("TAC_FROM", "{", "}");       // 采配の起点 from → {subs, act}

const ovr = s => s.off + s.def + s.pow + s.tec + s.spd + s.sta;
// 20到達(最大値)のステは太字で長所を強調
const cell = v => (v >= 20 ? "**" + v + "**" : "" + v);
// fx: 値1はフラグ効果(iron/miracle等)としてキーのみ、それ以外は key×倍率 で表記
const fxStr = fx => fx ? Object.entries(fx).map(([k, v]) => (v === 1 ? k : `${k}×${v}`)).join(", ") : "";
const esc = s => String(s == null ? "" : s).replace(/\|/g, "\\|");

const HEAD = "<!-- 自動生成 (tools/gen_reference.js)。手で編集しない。値の正本は src/js/data.js。-->\n";

// ---- signatures.md ------------------------------------------------------
function sigTable(list) {
  const cols = "| 名前 | 国 | Pos | Sub | タイプ | 年齢 | OVR | OF | DF | PO | TE | SP | ST | スキル | 効果 |";
  const sep = "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|";
  const rows = list.map(c => {
    const s = c.stats, t = (TYPES[c.pos] && TYPES[c.pos][c.type] && TYPES[c.pos][c.type].n) || c.type;
    return `| ${esc(c.name)} | ${c.flag} | ${c.pos} | ${c.sub} | ${esc(t)} | ${c.age || "-"} | ${ovr(s)} `
      + `| ${cell(s.off)} | ${cell(s.def)} | ${cell(s.pow)} | ${cell(s.tec)} | ${cell(s.spd)} | ${cell(s.sta)} `
      + `| ${esc(c.skill && c.skill.name)} | ${esc(fxStr(c.skill && c.skill.fx))} |`;
  });
  return [cols, sep, ...rows].join("\n");
}
let sigMd = HEAD + "# 固有選手パラメータ表(参照用・自動生成)\n\n"
  + "> 正本は [`src/js/data.js`](../../src/js/data.js) の `SIGNATURES` / `EMOTIONALS`。"
  + "追加・調整後は `node tools/gen_reference.js` で再生成。\n"
  + "> 不変条件: 6ステ合計=100 / いずれか1つ以上が20(**太字**) / `subGroup(sub)===pos`。\n\n"
  + `## シグネチャー(${SIGNATURES.length}名)\n\n` + sigTable(SIGNATURES) + "\n\n"
  + `## エモーショナル(${EMOTIONALS.length}名・最上位シークレット)\n\n` + sigTable(EMOTIONALS)
  + "\n\n各エモーショナルのモーメント: "
  + EMOTIONALS.map(c => `${esc(c.name)}「${esc(c.moment || "")}」`).join(" / ") + "\n";

// ---- playstyles.md ------------------------------------------------------
const POS_JP = { FW: "FW(フォワード)", MF: "MF(ミッドフィルダー)", DF: "DF(ディフェンダー)", GK: "GK(ゴールキーパー)" };
const PARAM_JP = {
  adv: "前線度", wide: "サイド度", roam: "遊動", chase: "追走", poss: "保持",
  atk: "攻撃選出", tgt: "ターゲット", pas: "パス選出", run: "走力", drive: "持込突破",
  defSel: "守備選出", wideSel: "大外選出"
};
let psMd = HEAD + "# プレースタイル(タイプ)係数表(参照用・自動生成)\n\n"
  + "> 正本は [`src/js/data.js`](../../src/js/data.js) の `TYPES`。意味は [プレースタイル仕様](../04-playstyle-skills.md) を参照。\n";
for (const pos of Object.keys(TYPES)) {
  const group = TYPES[pos];
  // この pos で使われるパラメータキーだけを列にする
  const keys = [];
  for (const t of Object.values(group)) for (const k of Object.keys(t)) if (k !== "n" && !keys.includes(k)) keys.push(k);
  psMd += `\n## ${POS_JP[pos] || pos}\n\n`;
  psMd += "| タイプ | " + keys.map(k => PARAM_JP[k] || k).join(" | ") + " |\n";
  psMd += "|---|" + keys.map(() => "---:").join("|") + "|\n";
  for (const key of Object.keys(group)) {
    const t = group[key];
    psMd += `| ${esc(t.n)} | ` + keys.map(k => (k in t ? t[k] : "·")).join(" | ") + " |\n";
  }
}

// ---- skills.md ----------------------------------------------------------
// SKILLS[pos]={r:[[name,desc,fx]...],sr:[...]} / LSKILLS[pos]=[[name,desc,fx]...]。
// ポジションごとに R / SR / LEGEND を1表にまとめる。固有選手のスキルは signatures.md 側。
const RAR_JP = { r: "R", sr: "SR" };
function skillRows(list, rarLabel) {
  return (list || []).map(([name, desc, fx]) =>
    `| ${rarLabel} | ${esc(name)} | ${esc(desc)} | ${esc(fxStr(fx))} |`);
}
let skMd = HEAD + "# スキル一覧(参照用・自動生成)\n\n"
  + "> 正本は [`src/js/data.js`](../../src/js/data.js) の `SKILLS`(通常 R/SR)/ `LSKILLS`(レジェンド専用)。"
  + "追加・調整後は `node tools/gen_reference.js` で再生成。\n"
  + "> 効果キー(fx)の意味は [スキル仕様](../04-playstyle-skills.md)を参照。"
  + "固有選手のユニークスキルは [固有選手パラメータ表](signatures.md) にある。\n";
let skillCount = 0;
for (const pos of Object.keys(SKILLS)) {
  skMd += `\n## ${POS_JP[pos] || pos}\n\n`;
  skMd += "| レア | スキル名 | 効果 | fx |\n|---|---|---|---|\n";
  const rows = [];
  for (const rk of Object.keys(SKILLS[pos])) rows.push(...skillRows(SKILLS[pos][rk], RAR_JP[rk] || rk.toUpperCase()));
  rows.push(...skillRows(LSKILLS[pos], "LEGEND"));
  skillCount += rows.length;
  skMd += rows.join("\n") + "\n";
}

// ---- tactics.md (采配スキル) --------------------------------------------
// MANAGERS[].tac と CAREER_TACS(basic/strong/team)。発動条件(cond/起点/chance)と効果(起点actまたはsurge)を表に。
const STAT_JP = { off: "攻", def: "守", pow: "力", tec: "技", spd: "速", sta: "持" };
const ACT_EFFECT = {
  cross: "クロス→空中戦ボーナス(決定機を創出)",
  through: "決定的スルーパス→GKと1対1",
  shot: "起点FW(ST/CF)が強引にボックスへ持ち込みフィニッシュ",
  block: "相手のシュートをCBが身体を投げ出してブロック(無効化・守備采配)",
  save: "相手のシュートをGKがスーパーセーブ(無効化・守備采配)",
};
const tacCond = t => (t.cond || []).map(([sub, st, th]) => `${sub}の${STAT_JP[st] || st}≥${th}`).join("・") || "—";
const tacFrom = t => { if (t.kind === "team") return `全体(from不問)${t.flag ? " " + t.flag : ""}`; const tf = TAC_FROM[t.from] || {}; return `${(tf.subs || [t.from]).join("/")}(${tf.act || "?"})`; };
const tacEffect = t => {
  if (t.kind === "team") { const s = t.surge || {}; return `🌐サージ: チーム全体を ×${s.mul || 1.2} で ${s.ticks || 3}ティック底上げ`; }
  let e = ACT_EFFECT[(TAC_FROM[t.from] || {}).act] || "—";
  if (t.pow) e += ` / 効果強化(pow×${t.pow})`;
  return e;
};
const tacRow = t => `| ${esc(t.name)} | ${esc(tacFrom(t))} | ${esc(tacCond(t))} | ${Math.round((t.chance || 0) * 100)}% | ${esc(tacEffect(t))} |`;
const tacHead = "| 采配 | 起点(act) | 発動条件 | 発動率 | 効果 |\n|---|---|---|---:|---|\n";
let tacCount = 0;
let tacMd = HEAD + "# 采配スキル一覧(参照用・自動生成)\n\n"
  + "> 正本は [`src/js/data.js`](../../src/js/data.js) の `MANAGERS`(名将の `tac`)/ `CAREER_TACS`(キャリアで習得)。追加・調整後は `node tools/gen_reference.js` で再生成。\n"
  + "> **発動条件(共通)**: ①ボルテージ `MC.volt ≥ 0.5`(`TUNING.volt.tacGate`=熱気が高い局面) ②発動条件(`cond`)を満たす選手が居る ③**起点(from)の選手が実際にボールの起点になった瞬間** ④`発動率`(chance)判定。**相手(CPU)監督の采配も同じ仕組みで発動**(キャリアで名将とマッチアップした際に炸裂・[ゲームモード §7.10](../06-game-modes.md))。CPU采配は cond を緩和(起点+chanceのみ)。\n"
  + "> **各采配は1試合につき最大1回まで**発動(`team._firedTacs` で管理)。カスタム監督は複数采配を持てるが各1回=単一采配の名将との格差を抑制。\n"
  + "> **効果は起点(act)で決まる**: cross=空中戦 / through=1対1 / shot=強引フィニッシュ / block・save=相手シュート無効(守備) / team=サージ(全体一時強化)。守備采配(cb/gk)は相手にシュートされた瞬間に発火。\n";
// 名将の采配
const mgrTacs = MANAGERS.filter(m => m.tac);
tacMd += `\n## 名将の采配(${mgrTacs.length}/${MANAGERS.length}名)\n\n`
  + "| 名将 | 采配 | 起点(act) | 発動条件 | 発動率 | 効果 |\n|---|---|---|---|---:|---|\n"
  + mgrTacs.map(m => `| ${esc(m.name)} | ${esc(m.tac.name)} | ${esc(tacFrom(m.tac))} | ${esc(tacCond(m.tac))} | ${Math.round((m.tac.chance || 0) * 100)}% | ${esc(tacEffect(m.tac))} |`).join("\n") + "\n";
tacCount += mgrTacs.length;
// キャリアで習得できる采配プール
const POOL_JP = { basic: "基本(basic)", strong: "強化(strong)", team: "国際チームスキル(team)" };
for (const pool of Object.keys(CAREER_TACS)) {
  const list = CAREER_TACS[pool] || [];
  if (pool === "team") { // 国際チームスキルは起点不問(from-agnostic)=国籍サージ。起点列の代わりに国を表示。
    tacMd += `\n## キャリア習得: ${POOL_JP[pool]}(${list.length})\n\n`
      + "| 采配 | 国 | 発動条件 | 発動率 | サージ効果 |\n|---|---|---|---:|---|\n"
      + list.map(t => `| ${esc(t.name)} | ${t.flag || "—"} | ${esc(tacCond(t))} | ${Math.round((t.chance || 0) * 100)}% | ${esc(tacEffect(t))} |`).join("\n") + "\n";
  } else {
    tacMd += `\n## キャリア習得: ${POOL_JP[pool] || pool}(${list.length})\n\n` + tacHead + list.map(tacRow).join("\n") + "\n";
  }
  tacCount += list.length;
}

// ---- write --------------------------------------------------------------
const outDir = path.join(ROOT, "docs/reference");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "signatures.md"), sigMd);
fs.writeFileSync(path.join(outDir, "playstyles.md"), psMd);
fs.writeFileSync(path.join(outDir, "skills.md"), skMd);
fs.writeFileSync(path.join(outDir, "tactics.md"), tacMd);
console.log(`generated docs/reference/signatures.md (${SIGNATURES.length} sig + ${EMOTIONALS.length} emo)`);
console.log(`generated docs/reference/playstyles.md (${Object.keys(TYPES).reduce((n, p) => n + Object.keys(TYPES[p]).length, 0)} types)`);
console.log(`generated docs/reference/skills.md (${skillCount} skills)`);
console.log(`generated docs/reference/tactics.md (${tacCount} tactics)`);
