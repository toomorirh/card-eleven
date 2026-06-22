// 全テスト共通: モックDOM/Image/タイマーの設定 + src/js/*.js の結合読み込み。
// JS_FILES の並びは build.py の JS_FILES と同じにすること(変更したら両方更新)。
"use strict";
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "js");
const JS_FILES = [
  "data.js", "state.js", "ui-roster.js", "ui-gacha.js", "ui-competition.js",
  "match-core.js", "match-render.js", "match-flow.js",
]; // boot.js は含めない(load().then(...)の自動実行を避け、各テストがE.boot()で明示的に呼ぶ)

function mkEl() {
  const el = {
    textContent: "", innerHTML: "", className: "", style: {}, scrollTop: 0, dataset: {},
    appendChild() {}, prepend() {}, remove() {}, click() {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector: () => mkEl(), querySelectorAll: () => [mkEl(), mkEl(), mkEl()],
  };
  return el;
}
function mockCanvas() {
  const c = mkEl(); c.width = 0; c.height = 0;
  c.getContext = () => ({
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", textBaseline: "",
    lineWidth: 1, globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect(){}, strokeRect(){}, clearRect(){}, drawImage(){},
    fillText(){}, strokeText(){}, beginPath(){}, closePath(){},
    moveTo(){}, lineTo(){}, arc(){}, fill(){}, stroke(){}, save(){}, restore(){},
    translate(){}, rotate(){}, scale(){},
  });
  return c;
}

/**
 * テスト用にグローバル(document/window/Image/setTimeout)をモックし、
 * src/js/*.js を結合したモジュールをrequireして返す。
 *
 * opts:
 *   timeoutDiv   setTimeoutの待ち時間を割る倍率(相対的な長短は保つ高速化。既定は未指定)
 *   timeoutFlat  指定すると待ち時間を要求値に関わらず常にこのms固定にする(最速。
 *                scaletest/progtest2/curvetest/leaguetest/legendtestはこちらを使う)
 *   imageHang    trueならImageの読込が永久に終わらない(hangtest用)
 *   storageHang  trueならwindow.storage.get/setが永久に解決しない(hangtest用)
 *   transform    (src:string)=>string  結合後ソースへの任意の文字列変換(curvetest用)
 *   exports      module.exportsに追加するコード片(例:"makeCard,FORMS")
 *   tmpName      一時ファイル名(既定:"_tmp_run.js")
 *
 * 戻り値Eには boot/getMC/getS/start に加え、テスト側のポーリング待ちで使う
 * 実時間のsleep関数 E._wait(ms) も生やしてある(内部のsetTimeoutはtimeoutDiv/timeoutFlatで
 * 速度調整されるが、テストの外側ループは実時間で待つ必要があるため分けている)。
 */
function setup(opts = {}) {
  const realTimeout = global.setTimeout;
  if (opts.timeoutFlat != null) {
    const flat = opts.timeoutFlat;
    global.setTimeout = (f) => realTimeout(f, flat);
  } else {
    const div = opts.timeoutDiv || 1;
    global.setTimeout = (f, ms) => realTimeout(f, Math.max(1, (ms || 0) / div));
  }

  global.window = opts.storageHang
    ? { storage: { get: () => new Promise(() => {}), set: () => new Promise(() => {}) }, addEventListener(){} }
    : { addEventListener(){} };

  global.Image = opts.imageHang
    ? class { constructor(){ this.complete=false; this.naturalWidth=0; } set src(v){} decode(){ return new Promise(()=>{}); } }
    : class { constructor(){ this.complete=true; this.naturalWidth=1; } set src(v){} decode(){ return Promise.resolve(); } };

  global.document = {
    getElementById: () => mkEl(), querySelector: () => mkEl(),
    querySelectorAll: () => [mkEl(), mkEl(), mkEl()],
    createElement: t => (t === "canvas" ? mockCanvas() : mkEl()),
    body: mkEl(),
  };

  let code = JS_FILES.map(f => fs.readFileSync(path.join(SRC_DIR, f), "utf8").trim()).join("\n\n");
  if (opts.transform) code = opts.transform(code);
  const extra = opts.exports ? "," + opts.exports : "";
  code += `\nmodule.exports={boot:async()=>{await load();},getMC:()=>MC,getS:()=>S,start:i=>startMatch(i)${extra}};`;

  const tmpPath = path.join(__dirname, opts.tmpName || "_tmp_run.js");
  fs.writeFileSync(tmpPath, code);
  delete require.cache[require.resolve(tmpPath)];
  const E = require(tmpPath);
  E._wait = ms => new Promise(r => realTimeout(r, ms));
  return E;
}

module.exports = { setup, mkEl, mockCanvas };
