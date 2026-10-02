/* ============================================================
   Init
   ============================================================ */
document.getElementById('budgetTypeRow').style.display = curType==='expense' ? 'block' : 'none';

loadData();
requestPersistentStorage();
applyDarkMode();
applyLanguage();
syncTransferToOptions();

/* T7 — অ্যাপ suspend থেকে ফিরলে/ট্যাব ফোকাস পেলে তারিখ আপডেট */
lastKnownToday = new Date();
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible'){ refreshTodayDefaults(); if(typeof maybeNotifyDueReminders === 'function') maybeNotifyDueReminders(); }
});
window.addEventListener('focus', ()=>{ refreshTodayDefaults(); if(typeof maybeNotifyDueReminders === 'function') maybeNotifyDueReminders(); });
if(typeof maybeNotifyDueReminders === 'function') maybeNotifyDueReminders();

/* লোগো চেপে ধরলে "Copy/Download image" মেনু আসা বন্ধ */
document.addEventListener('contextmenu', e=>{
  if(e.target && e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('dragstart', e=>{
  if(e.target && e.target.tagName === 'IMG') e.preventDefault();
});
