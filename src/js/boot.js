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
document.body.classList.add("on-title"); // 起動時はタイトル表示=下部メニュー非表示
load().then(()=>{
  coinUI();
  renderTitleHero();
  document.getElementById("titleStart").onclick=()=>show("home");
  window.__boot&&window.__boot("3/3: 起動完了!",true);
}).catch(e=>{
  showErr(e);coinUI();
  renderTitleHero();
  document.getElementById("titleStart").onclick=()=>show("home");
  window.__boot&&window.__boot("3/3: 起動完了(セーブ読込は失敗→初期データ)",true);
});
