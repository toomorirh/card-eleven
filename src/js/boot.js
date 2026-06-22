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
// タイトルの「つづきから/はじめから」を配線。セーブの有無でボタン表示を切り替える。
function setupTitleButtons(exists){
  const cont=document.getElementById("btnContinue"), nw=document.getElementById("btnNew");
  cont.style.display=exists?"":"none";
  nw.className=exists?"btn ghost":"btn tstart"; // セーブが無ければ「はじめから」を主ボタン(金・パルス)に
  cont.onclick=async()=>{ await loadGame(); coinUI(); show("home"); };
  nw.onclick=async()=>{
    if(await hasSave()&&!confirm("はじめからプレイすると、現在のセーブデータは消えます。よろしいですか?"))return;
    await newGame(); coinUI(); show("home");
  };
}
document.body.classList.add("on-title"); // 起動時はタイトル表示=下部メニュー非表示
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
