/* ============================================================
   Google Drive auto-backup (APK / Capacitor only)
   - Drive-এর লুকানো "appDataFolder"-এ একটাই ফাইল রাখে (arcus-backup.json)
   - scope: drive.appdata (ইউজারের বাকি Drive ফাইল অ্যাপ দেখতে পায় না)
   - ডাটা বদলালে ~8 সেকেন্ড পর অটো আপলোড; অ্যাপ ব্যাকগ্রাউন্ডে গেলে সঙ্গে সঙ্গে
   ============================================================ */
(function(){
  'use strict';

  // >>> Google Cloud Console থেকে পাওয়া "Web application" Client ID এখানে বসাও <<<
  var GD_WEB_CLIENT_ID = '742909845874-lick60srks603ivah5mldg06vjimmho4.apps.googleusercontent.com';

  var GD_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var GD_FILE  = 'arcus-backup.json';
  var K_ON = 'hisab_gd_on', K_EMAIL = 'hisab_gd_email', K_LAST = 'hisab_gd_last', K_ASKED = 'hisab_gd_asked';
  var DEBOUNCE_MS = 8000;

  var tok = null;            // { v, exp }
  var inited = false;
  var busy = false, dirty = false, timer = null;
  var fileId = null;

  /* ---------- ছোট হেল্পার ---------- */
  function en(){ return (typeof lang !== 'undefined') && lang === 'en'; }
  function T(bn, e){ return en() ? e : bn; }
  function ls(k, v){
    try{
      if(v === undefined) return localStorage.getItem(k);
      if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }catch(e){}
    return null;
  }
  function say(msg, ms){ try{ toast(msg, ms); }catch(e){ console.log(msg); } }
  function plugin(){
    try{
      var C = window.Capacitor;
      if(C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.SocialLogin) return C.Plugins.SocialLogin;
    }catch(e){}
    return null;
  }
  function configured(){ return GD_WEB_CLIENT_ID.indexOf('PASTE_') !== 0; }
  function isOn(){ return ls(K_ON) === '1'; }
  function tokStr(x){ return typeof x === 'string' ? x : (x && x.token) || null; }
  function setTok(raw, expiresHint){
    var v = tokStr(raw); if(!v) return false;
    var exp = Date.now() + 45 * 60000;
    if(raw && raw.expires){ var t = Date.parse(raw.expires); if(t && t > Date.now()) exp = t; }
    else if(expiresHint) exp = expiresHint;
    tok = { v: v, exp: exp };
    return true;
  }

  /* ---------- সাইন-ইন / টোকেন ---------- */
  async function init(){
    if(inited) return;
    var P = plugin(); if(!P) throw new Error('no-plugin');
    await P.initialize({ google: { webClientId: GD_WEB_CLIENT_ID, mode: 'online' } });
    inited = true;
  }
  async function loginInteractive(){
    await init();
    var r = await plugin().login({ provider: 'google', options: { scopes: ['email', 'profile', GD_SCOPE] } });
    var res = r && r.result;
    if(!res || !setTok(res.accessToken)) throw new Error('no-access-token');
    var email = res.profile && res.profile.email;
    if(email) ls(K_EMAIL, email);
    return email || '';
  }
  async function getToken(force){
    if(!force && tok && tok.exp > Date.now() + 120000) return tok.v;
    await init();
    var P = plugin();
    if(!force){
      try{ var a = await P.getAuthorizationCode({ provider: 'google' }); if(a && setTok(a.accessToken)) return tok.v; }catch(e){}
    }
    try{
      await P.refresh({ provider: 'google', options: { scopes: [GD_SCOPE] } });
      var b = await P.getAuthorizationCode({ provider: 'google' });
      if(b && setTok(b.accessToken)) return tok.v;
    }catch(e){}
    try{
      var c = await P.login({ provider: 'google', options: { scopes: ['email', 'profile', GD_SCOPE], filterByAuthorizedAccounts: true, autoSelectEnabled: true } });
      if(c && c.result && setTok(c.result.accessToken)) return tok.v;
    }catch(e){}
    throw new Error('no-token');
  }

  /* ---------- Drive REST ---------- */
  async function api(url, opts, retried){
    var t = await getToken(!!retried);
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + t });
    var res = await fetch(url, opts);
    if(res.status === 401 && !retried){ tok = null; return api(url, opts, true); }
    if(!res.ok){ var er = new Error('drive-' + res.status); er.status = res.status; throw er; }
    return res;
  }
  async function findFile(){
    var q = encodeURIComponent("name='" + GD_FILE + "'");
    var url = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q + '&fields=files(id,modifiedTime)&pageSize=1';
    var j = await (await api(url)).json();
    var f = j.files && j.files[0];
    fileId = f ? f.id : null;
    return f || null;
  }
  async function upload(jsonStr){
    if(!fileId){ var f = await findFile(); if(f) fileId = f.id; }
    if(fileId){
      await api('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: jsonStr
      });
    } else {
      var b = 'arcusbnd' + Date.now();
      var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify({ name: GD_FILE, parents: ['appDataFolder'] }) + '\r\n--' + b +
        '\r\nContent-Type: application/json\r\n\r\n' + jsonStr + '\r\n--' + b + '--';
      var r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body
      });
      fileId = (await r.json()).id;
    }
  }
  async function download(id){
    var r = await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media');
    return r.json();
  }

  /* ---------- ব্যাকআপ / রিস্টোর ---------- */
  async function backupNow(silent){
    if(busy){ dirty = true; return false; }
    if(typeof hasAnyData === 'function' && !hasAnyData()){
      if(!silent) say(T('ব্যাকআপ করার মতো ডাটা নেই', 'Nothing to back up'));
      return false;
    }
    busy = true; dirty = false;
    try{
      await upload(JSON.stringify(collectBackupData()));
      ls(K_LAST, String(Date.now()));
      if(!silent) say(T('Google Drive-এ ব্যাকআপ হয়েছে ✓', 'Backed up to Google Drive ✓'));
      return true;
    }catch(e){
      console.warn('gdrive backup failed', e);
      if(!silent) say(T('Drive ব্যাকআপ হয়নি। ইন্টারনেট/লগইন দেখো', 'Drive backup failed. Check internet/sign-in'), 3500);
      return false;
    }finally{
      busy = false; render();
      if(dirty) schedule();
    }
  }
  function schedule(){
    if(!isOn() || !plugin()) return;
    clearTimeout(timer);
    timer = setTimeout(function(){ timer = null; backupNow(true); }, DEBOUNCE_MS);
  }
  function flushNow(){
    if(timer){ clearTimeout(timer); timer = null; backupNow(true); }
  }
  async function restoreFromDrive(){
    try{
      var f = await findFile();
      if(!f){ say(T('Drive-এ কোনো ব্যাকআপ পাওয়া যায়নি', 'No backup found on Drive')); return; }
      var parsed = await download(f.id);
      if(!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)){
        say(T('Drive-এর ব্যাকআপ ফাইল ঠিক নেই', 'Drive backup file is invalid')); return;
      }
      ls(K_ON, '1');                 // রিস্টোরের পর রিলোড হলেও অটো-ব্যাকআপ চালু থাকবে
      startImportFlow(parsed);       // আগের সেফটি-কপি + যাচাই-ছাঁকনি একই থাকে
    }catch(e){
      console.warn('gdrive restore failed', e);
      say(T('Drive থেকে ফেরানো যায়নি', 'Could not restore from Drive'), 3500);
    }
  }

  /* ---------- সংযোগ ---------- */
  async function connect(){
    if(!configured()){ say(T('Client ID বসানো হয়নি (gdrive-backup.js)', 'Client ID not set (gdrive-backup.js)'), 4000); return; }
    try{
      await loginInteractive();
    }catch(e){
      console.warn('gdrive login failed', e);
      var _d=''; try{ _d=' [' + ((e&&(e.code||e.errorCode))||'') + ' ' + ((e&&e.message)||String(e)) + ']'; }catch(_e){}
      say(T('Google লগইন হয়নি', 'Google sign-in failed') + _d, 15000); return;
    }
    try{
      var f = await findFile();
      var localHas = (typeof hasAnyData === 'function') && hasAnyData();
      if(!f){
        ls(K_ON, '1');
        if(localHas) await backupNow(false);
        say(T('Google Drive যুক্ত হয়েছে', 'Google Drive connected'));
      } else if(!localHas){
        await restoreFromDrive();
      } else {
        openSimpleConfirm(
          T('Drive-এ আগের ব্যাকআপ আছে। সেটা ফিরিয়ে আনবে? (এই ফোনের ডাটা বদলে যাবে)\n\n"না" বললে এই ফোনের ডাটাই Drive-এ রাখা হবে।',
            'A backup already exists on Drive. Restore it? (This phone\'s data will be replaced)\n\nChoosing "No" will overwrite Drive with this phone\'s data.'),
          function(){ restoreFromDrive(); },
          async function(){ ls(K_ON, '1'); await backupNow(false); }
        );
      }
    }catch(e){
      console.warn('gdrive connect failed', e);
      say(T('Drive-এ যুক্ত হওয়া যায়নি', 'Could not connect to Drive'), 3500);
    }
    render();
  }
  async function disconnect(){
    try{ await init(); await plugin().logout({ provider: 'google' }); }catch(e){}
    tok = null; fileId = null; clearTimeout(timer); timer = null;
    ls(K_ON, null); ls(K_EMAIL, null); ls(K_LAST, null);
    say(T('Drive সংযোগ বিচ্ছিন্ন (Drive-এর ব্যাকআপ ফাইল থেকে গেছে)', 'Disconnected (backup file stays on Drive)'), 3500);
    render();
  }

  /* ---------- সেটিংস UI ---------- */
  var box = null;
  function mk(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt) e.textContent = txt; return e; }
  function render(){
    if(!box) return;
    box.innerHTML = '';
    if(!isOn()){
      box.appendChild(mk('div', 'settings-desc', T('ডাটা বদলালেই নিজে নিজে তোমার Drive-এ ব্যাকআপ হবে। নতুন ফোনে লগইন করলেই ফিরে পাবে।', 'Data is backed up to your Drive automatically. Sign in on a new phone to get it back.')));
      var c = mk('button', 'btn gold', T('Google Drive যুক্ত করো', 'Connect Google Drive'));
      c.style.cssText = 'margin-top:8px;width:100%;'; c.onclick = connect; box.appendChild(c);
      return;
    }
    var last = Number(ls(K_LAST)) || 0;
    var when = last ? new Date(last).toLocaleString(en() ? 'en-GB' : 'bn-BD') : T('এখনও হয়নি', 'not yet');
    box.appendChild(mk('div', 'settings-desc ok', (ls(K_EMAIL) || T('যুক্ত আছে', 'Connected')) + ' • ' + T('শেষ ব্যাকআপ: ', 'Last: ') + when));
    var b1 = mk('button', 'btn gold', busy ? T('ব্যাকআপ হচ্ছে…', 'Backing up…') : T('এখনই Drive-এ ব্যাকআপ নাও', 'Back up to Drive now'));
    b1.style.cssText = 'margin-top:8px;width:100%;'; b1.disabled = busy; b1.onclick = function(){ backupNow(false); };
    var b2 = mk('button', 'btn outline', T('Drive থেকে ফিরিয়ে আনো', 'Restore from Drive'));
    b2.style.cssText = 'margin-top:8px;width:100%;'; b2.onclick = restoreFromDrive;
    var b3 = mk('button', 'btn outline', T('সংযোগ বিচ্ছিন্ন করো', 'Disconnect'));
    b3.style.cssText = 'margin-top:8px;width:100%;'; b3.onclick = disconnect;
    box.appendChild(b1); box.appendChild(b2); box.appendChild(b3);
  }

  function boot(){
    // শুধু APK-তে (নেটিভ প্লাগিন থাকলে) দেখাবে
    var slot = document.getElementById('gdriveBackupSlot');
    var blk = document.getElementById('gdriveBackupBlock');
    var anchor = document.getElementById('importDataBtn');
    if(!plugin()){
      if(slot){
        slot.appendChild(mk('div', 'settings-desc', T('Google Drive অটো-ব্যাকআপ শুধু Arcus APK অ্যাপে চলে। ব্রাউজারে নিচের ফাইল ব্যাকআপ ব্যবহার করো।', 'Google Drive auto-backup works only in the Arcus APK app. In the browser, use file backup below.')));
        if(blk) blk.style.display = '';
      }
      return;
    }
    if(!slot && !anchor) return;
    box = mk('div', '');
    if(slot){ slot.appendChild(box); if(blk) blk.style.display = ''; }
    else { box.style.marginTop = '14px'; anchor.insertAdjacentElement('afterend', box); }
    render();

    // সব save*() ফাংশনে অটো-ব্যাকআপ হুক
    ['saveEntries','saveNotes','savePlans','saveLoans','saveDues','saveSettings','saveRecurring'].forEach(function(n){
      var orig = window[n]; if(typeof orig !== 'function') return;
      window[n] = function(){ var r = orig.apply(this, arguments); schedule(); return r; };
    });
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') flushNow(); });
    window.addEventListener('pagehide', flushNow);

    // প্রথমবার APK খুললে একবার জিজ্ঞেস করবে — যুক্ত করলে এরপর সব অটো
    if(!isOn() && configured() && ls(K_ASKED) !== '1'){
      setTimeout(function(){
        if(isOn() || ls(K_ASKED) === '1' || typeof openSimpleConfirm !== 'function') return;
        ls(K_ASKED, '1');
        openSimpleConfirm(
          T('Google Drive-এ অটো-ব্যাকআপ চালু করবে? একবার লগইন করলেই এরপর ডাটা বদলালে নিজে নিজে ব্যাকআপ হবে।',
            'Turn on automatic Google Drive backup? Sign in once and your data will be backed up automatically after every change.'),
          function(){ connect(); },
          function(){}
        );
      }, 3000);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.gdriveBackup = { backupNow: backupNow, restore: restoreFromDrive, connect: connect, disconnect: disconnect };
})();
