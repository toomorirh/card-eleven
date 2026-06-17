const { setup } = require("./_setup");
const E = setup({
  timeoutDiv: 50,
  imageHang: true,
  storageHang: true,
  tmpName: "_tmp_hangtest.js",
});
(async () => {
  const t0 = Date.now();
  await E.boot();   // ストレージ&画像が永久ハングしてもタイムアウトで起動するはず
  console.log("ハング環境でも起動OK(", Date.now() - t0, "ms ) 初期デッキ:", E.getS().coll.length, "枚");
  E.start(0);       // 画像なしでもフォールバック描画で試合開始
  while (E.getMC()) await E._wait(5);
  console.log("画像なし環境でも試合完走OK");
  process.exit(0);
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
