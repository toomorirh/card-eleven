// ================= 起動 =================
function showErr(m){
  try{
    const t=document.getElementById("toast");
    t.textContent="⚠ "+((m&&m.message)||m||"不明なエラー");
    t.style.display="block";
    setTimeout(()=>t.style.display="none",5000);
  }catch(e){}
}
window.addEventListener("error",ev=>showErr(ev.message));
window.addEventListener("unhandledrejection",ev=>showErr(ev.reason));
// チャレンジURL(#team=...)で来た場合、フレンド対戦モードへ誘導する。
function _gotoChallenge(){
  if(typeof _pendingChallenge==="undefined"||!_pendingChallenge)return;
  const wb=document.querySelector('#modeRow [data-m="friend"]'); if(wb)wb.click();
  toast("⚔️ 挑戦状が届いています!監督名を確認して対戦!");
}
// タイトルの「つづきから/はじめから」を配線。セーブの有無でボタン表示を切り替える。
function setupTitleButtons(exists){
  const cont=document.getElementById("btnContinue"), nw=document.getElementById("btnNew");
  cont.style.display=exists?"":"none";
  nw.className=exists?"btn ghost":"btn tstart"; // セーブが無ければ「はじめから」を主ボタン(金・パルス)に
  cont.onclick=async()=>{ await loadGame(); coinUI(); show("home"); _gotoChallenge(); };
  nw.onclick=async()=>{
    if(await hasSave()&&!confirm("はじめからプレイすると、現在のセーブデータは消えます。よろしいですか?"))return;
    openProfile(true); // 監督名/チーム名を設定 →「はじめる」でデッキ生成しホームへ
  };
}
document.body.classList.add("on-title"); // 起動時はタイトル表示=下部メニュー非表示
// チャレンジURL(#team=コード)を検出して保持(続き/新規開始後にフレンド対戦へ誘導)。
try{const hm=(location.hash||"").match(/team=([A-Za-z0-9_\-]+)/);if(hm)_pendingChallenge=hm[1];}catch(e){}
(async()=>{
  try{
    await withTimeout(SPR_READY,4500);   // タイトルのヒーロー描画にスプライトが要る
    coinUI();
    renderTitleHero();
    setupTitleButtons(await hasSave());
    window.__boot&&window.__boot("3/3: 起動完了!",true);
  }catch(e){
    showErr(e);
    try{coinUI();renderTitleHero();setupTitleButtons(false);}catch(_){}
    window.__boot&&window.__boot("3/3: 起動完了(初期化に一部失敗)",true);
  }
})();
