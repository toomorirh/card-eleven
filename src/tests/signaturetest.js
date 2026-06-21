// 固有選手(シグネチャー)の不変条件を機械チェックする検証ハーネス。
// 新しい SIGNATURES エントリを追加したらこれを実行(誤った合計値・ポジション不整合・
// 無効タイプ・id重複などを早期に検出する)。
const { setup } = require("./_setup");
const E = setup({ tmpName: "_tmp_signaturetest.js",
  exports: "SIGNATURES,makeSignature,TYPES,subGroup:(s)=>subGroup(s)" });
(async () => {
  await E.boot();
  const STATS = ["off", "def", "pow", "tec", "spd", "sta"];
  let fail = 0;
  const seen = new Set();
  for (const s of E.SIGNATURES) {
    const errs = [];
    // id 一意
    if (seen.has(s.id)) errs.push("id重複"); seen.add(s.id);
    // ポジション整合
    if (E.subGroup(s.sub) !== s.pos) errs.push(`sub(${s.sub})の大分類≠pos(${s.pos})`);
    // タイプ妥当
    if (!E.TYPES[s.pos] || !E.TYPES[s.pos][s.type]) errs.push(`無効なtype:${s.type}`);
    // ステータス: 6項目・整数1..20・合計100・いずれか20
    const st = s.stats || {};
    let sum = 0, max = 0, hasAll = true;
    for (const k of STATS) {
      const v = st[k];
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 20) { hasAll = false; }
      else { sum += v; max = Math.max(max, v); }
    }
    if (!hasAll) errs.push("6ステが整数1..20で揃っていない");
    else {
      if (sum !== 100) errs.push(`6ステ合計=${sum}(100であること)`);
      if (max !== 20) errs.push(`最大値=${max}(いずれか20であること)`);
    }
    // スキル構造
    const sk = s.skill;
    if (!sk || !sk.name || !sk.desc || typeof sk.fx !== "object") errs.push("skill(name/desc/fx)が不正");
    // makeSignature の整合
    const c = E.makeSignature(s.id);
    if (!c) errs.push("makeSignatureがnull");
    else {
      if (c.rar !== "l") errs.push(`rar=${c.rar}(lであること)`);
      if (c.sig !== s.id) errs.push("sig識別子が一致しない");
      const csum = STATS.reduce((a, k) => a + c[k], 0);
      if (csum !== sum) errs.push("生成カードのステ合計がdefと不一致");
    }
    if (errs.length) { fail++; console.log(`✗ ${s.id} (${s.name}): ${errs.join(" / ")}`); }
    else console.log(`✓ ${s.id} (${s.name}) ${s.flag} ${s.pos}/${s.sub} 合計${sum} 最大${max}`);
  }
  console.log(fail === 0 ? `=== 全${E.SIGNATURES.length}件OK ===` : `=== ${fail}件 NG ===`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
