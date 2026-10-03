/* ============================================================
   Backup notification — প্রতি ৭ দিনে একবার ব্যাকআপের নোটিফিকেশন
   শুধু APK (Capacitor) এ কাজ করে; ব্রাউজারে আগের ব্যানারই থাকে।
   ============================================================ */
const BN_ID = 7001;
const BN_KEY_ON = 'hisab_backup_notify';        // '0' = বন্ধ, নাহলে চালু
const BN_KEY_BASE = 'hisab_backup_notify_base'; // ব্যাকআপ না নিলে গণনার শুরু
const BN_PERIOD_MS = 7 * 86400000;

function bnPlugin(){
  try{
    const C = window.Capacitor;
    if(C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LocalNotifications) return C.Plugins.LocalNotifications;
  }catch(e){}
  return null;
}
function bnEnabled(){ try{ return localStorage.getItem(BN_KEY_ON) !== '0'; }catch(e){ return true; } }
function bnBase(){
  try{
    let b = Number(localStorage.getItem(BN_KEY_BASE));
    if(!b){ b = Date.now(); localStorage.setItem(BN_KEY_BASE, String(b)); }
    return b;
  }catch(e){ return Date.now(); }
}

async function bnEnsurePermission(ask){
  const LN = bnPlugin(); if(!LN) return false;
  try{
    let p = await LN.checkPermissions();
    if(p.display === 'granted') return true;
    if(ask && (p.display === 'prompt' || p.display === 'prompt-with-rationale')){
      p = await LN.requestPermissions();
      return p.display === 'granted';
    }
  }catch(e){}
  return false;
}

async function scheduleBackupNotification(){
  const LN = bnPlugin(); if(!LN) return;
  try{
    await LN.cancel({ notifications: [{ id: BN_ID }] });
    if(!bnEnabled()) return;
    if(!(await bnEnsurePermission(false))) return;
    const now = Date.now();
    const last = (typeof getLastBackupTime === 'function') ? getLastBackupTime() : null;
    const base = last || bnBase();
    // base + ৭ দিনের গুণিতকের মধ্যে প্রথম যেটা অন্তত ১ ঘণ্টা পরে
    const minAt = now + 3600000;
    let at = base + BN_PERIOD_MS;
    if(at < minAt) at = base + Math.ceil((minAt - base) / BN_PERIOD_MS) * BN_PERIOD_MS;
    await LN.schedule({ notifications: [{
      id: BN_ID,
      title: L('backupNotifyTitle'),
      body: L('backupNotifyBody'),
      schedule: { at: new Date(at), every: 'week', allowWhileIdle: true },
      extra: { action: 'backup' }
    }]});
  }catch(e){ console.warn('backup notify schedule failed', e); }
}

function renderBackupNotifyBtn(){
  const btn = document.getElementById('backupNotifyBtn');
  if(!btn) return;
  if(!bnPlugin()){ btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.textContent = bnEnabled() ? L('backupNotifyOnBtn') : L('backupNotifyOffBtn');
}

async function toggleBackupNotify(){
  const turnOn = !bnEnabled();
  if(turnOn){
    const ok = await bnEnsurePermission(true);
    if(!ok){ if(typeof toast === 'function') toast(L('backupNotifyDeniedToast')); return; }
  }
  try{ localStorage.setItem(BN_KEY_ON, turnOn ? '1' : '0'); }catch(e){}
  await scheduleBackupNotification();
  renderBackupNotifyBtn();
}

(function initBackupNotify(){
  const btn = document.getElementById('backupNotifyBtn');
  if(btn) btn.addEventListener('click', toggleBackupNotify);
  renderBackupNotifyBtn();
  const LN = bnPlugin(); if(!LN) return;
  try{
    LN.addListener('localNotificationActionPerformed', (ev)=>{
      const a = ev && ev.notification && ev.notification.extra && ev.notification.extra.action;
      if(a === 'backup' && typeof openBackupSection === 'function') openBackupSection();
    });
  }catch(e){}
  // প্রথমবার পারমিশন চাও, তারপর শিডিউল করো
  setTimeout(async ()=>{
    await bnEnsurePermission(true);
    scheduleBackupNotification();
    if(typeof dueNativeInit === 'function') dueNativeInit();   // রিমাইন্ডার নোটিফিকেশনও চালু করো
  }, 1500);
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && typeof refreshDueNativePerm === 'function') refreshDueNativePerm();
  });
})();
