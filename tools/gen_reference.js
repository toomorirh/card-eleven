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

const ovr = s => s.off + s.def + s.pow + s.tec + s.spd + s.sta;
// 20到達(最大値)のステは太字で長所を強調
const cell = v => (v >= 20 ? "**" + v + "**" : "" + v);
const fxStr = fx => fx ? Object.entries(fx).map(([k, v]) => `${k}×${v}`).join(", ") : "";
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

// ---- write --------------------------------------------------------------
const outDir = path.join(ROOT, "docs/reference");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "signatures.md"), sigMd);
fs.writeFileSync(path.join(outDir, "playstyles.md"), psMd);
console.log(`generated docs/reference/signatures.md (${SIGNATURES.length} sig + ${EMOTIONALS.length} emo)`);
console.log(`generated docs/reference/playstyles.md (${Object.keys(TYPES).reduce((n, p) => n + Object.keys(TYPES[p]).length, 0)} types)`);
