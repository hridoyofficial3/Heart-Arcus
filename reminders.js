/* ============================================================
   R1 — ডিউ-ডেট রিমাইন্ডার লজিক (UI ছাড়া; ROADMAP-2 §২ D1–D3)
   ------------------------------------------------------------
   getDueReminders(todayStr, windowDays) → { overdue:[], today:[], soon:[] }
   প্রতিটা আইটেম: { kind:'loan'|'due', type, id, person, amount(বাকি), dueDate, daysDiff }
     • kind  : 'loan' = loans[], 'due' = dues[]
     • type  : মূল টাইপ (loan: given/taken/self, due: receivable/payable) — UI লেবেল/রঙের জন্য
     • person: সংরক্ষিত মান হুবহু (self-লোনে ফাঁকা থাকতে পারে; UI-তে loanSelfPersonLabel ও escapeHtml লাগবে)
     • amount: বাকি টাকা (l.amount / d.amount — আংশিক পরিশোধের পরের মান)
     • daysDiff = dueDate − আজ (দিন): নেগেটিভ = মেয়াদ পেরিয়েছে, ০ = আজ, ১..N = শিগগিরই
   বাদ: settled, dueDate ফাঁকা/অবৈধ (কড়া YYYY-MM-DD + বাস্তব ক্যালেন্ডার তারিখ, যেমন ২০২৬-০২-৩০ অবৈধ),
        বাকি টাকা ০/অসংখ্যা, এবং windowDays-এর বাইরের ভবিষ্যৎ তারিখ।
   ক্রম: প্রতি তালিকায় daysDiff ছোট → বড় (সবচেয়ে পুরনো মেয়াদোত্তীর্ণ আগে); সমান হলে লোন আগে, তারপর বকেয়া (আসল ক্রম বজায়)।
   তারিখের হিসাব UTC দিন-সংখ্যায় — লোকাল টাইমজোন/DST বদলে ফল বদলায় না।
   এই ফাইলে কোনো DOM/localStorage/রেন্ডার নেই; শুধু বিদ্যমান গ্লোবাল loans/dues ও todayStr() পড়ে।
   ============================================================ */
const DUE_REMINDER_DEFAULT_DAYS = 3;   // D3

function reminderDayNumber(s){
  if(typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(0);            // ১৯৭০-০১-০১T00:00:00Z — setUTCFullYear সময়ের অংশ ছোঁয় না
  t.setUTCFullYear(y, mo - 1, d);   // ০–৯৯ বছরেও ১৯০০-যোগের ফাঁদ নেই (Date.UTC-এ আছে)
  if(t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;   // ৩০ ফেব্রুয়ারি ইত্যাদি
  return Math.round(t.getTime() / 86400000);
}

function reminderWindow(windowDays){
  if(windowDays === undefined || windowDays === null || windowDays === '') return DUE_REMINDER_DEFAULT_DAYS;
  const n = Number(windowDays);
  if(!isFinite(n) || n < 0) return DUE_REMINDER_DEFAULT_DAYS;
  return Math.floor(n);
}

/* দিতে হবে (pay) নাকি পাব (receive)? */
function isPayItem(kind, type){ return kind === 'loan' ? (type === 'taken' || type === 'self') : type === 'payable'; }

/* খাঁটি ফাংশন: অ্যারে ও আজকের তারিখ আর্গুমেন্টে — টেস্টযোগ্য (windowDays এখন আর ব্যবহার হয় না; নিয়ম স্থির) */
function computeDueReminders(loanList, dueList, today, windowDays){
  const out = { overdue: [], today: [], soon: [] };
  const t = reminderDayNumber(today);
  if(t === null) return out;
  const win = reminderWindow(windowDays);
  const push = (kind, x) => {
    if(!x || x.settled) return;
    const dn = reminderDayNumber(x.dueDate);
    if(dn === null) return;
    const amount = Number(x.amount);
    if(!isFinite(amount) || amount <= 0) return;
    const daysDiff = dn - t;
    const pay = isPayItem(kind, x.type);
    const item = { kind, type: x.type, id: x.id, person: x.person, amount, dueDate: x.dueDate, daysDiff, pay };
    /* নিয়ম: যে টাকা আমি পাব (given/receivable) → শুধু মেয়াদের দিনে;
       যে টাকা আমি দেব (taken/self/payable) → মেয়াদের ১ দিন আগে + মেয়াদের দিনে।
       পরিশোধ/আদায় (settled) হয়ে গেলে কিছুই নয়। মেয়াদ পেরিয়ে গেলে (এখনো বাকি) অ্যাপের বেলে দেখা যায়। */
    if(daysDiff < 0) out.overdue.push(item);
    else if(daysDiff === 0) out.today.push(item);
    else if(pay && daysDiff === 1) out.soon.push(item);
  };
  (Array.isArray(loanList) ? loanList : []).forEach(l => push('loan', l));
  (Array.isArray(dueList) ? dueList : []).forEach(d => push('due', d));
  const byDiff = (a, b) => a.daysDiff - b.daysDiff;   // Array.sort স্থিতিশীল → সমান হলে আসল ক্রম
  out.overdue.sort(byDiff); out.soon.sort(byDiff);
  return out;
}

function getDueReminders(todayStrArg, windowDays){
  return computeDueReminders(loans, dues, todayStrArg === undefined ? todayStr() : todayStrArg, windowDays);
}

/* ============================================================
   R2 — ইন-অ্যাপ ব্যানার + তালিকা মডাল + ট্যাব-ব্যাজ (ROADMAP-2 §২ D1–D4)
   ------------------------------------------------------------
   • "দেনাপাওনা" ট্যাবের ওপরে সারাংশ-কার্ড #dueReminderCard (শূন্য হলে লুকানো; শুধু অশূন্য অংশ দেখায়)
   • কার্ডে ট্যাপ/Enter/Space → #dueReminderModal (মেয়াদ পেরিয়েছে / আজ / শিগগিরই)
   • ট্যাব-আইকনে #loansTabBadge = মেয়াদ পেরিয়েছে + আজ + শিগগিরই মোট (মেয়াদ পেরিয়ে থাকলে লাল)
   • renderAll() থেকে কল হয় → ডেটা বদল, ভাষা বদল, দিন বদল (refreshTodayDefaults) সবকিছুতে নিজে থেকে আপডেট
   • ডিফল্ট চালু (D4); চালু/বন্ধ সুইচ ও N দিন R4-এ আসবে — তখন শুধু dueReminderWindowDays() বদলাবে
   ============================================================ */
const dueReminderCardEl = document.getElementById('dueReminderCard');
const dueReminderModalEl = document.getElementById('dueReminderModal');
const loansTabBadgeEl = document.getElementById('loansTabBadge');

function dueReminderEnabled(){ return !(settings && settings.dueReminderOn === false); }
function dueReminderWindowDays(){ return 1; }   // নিয়ম স্থির: দিতে হলে ১ দিন আগে
const DUE_REMINDER_EMPTY = { overdue:[], today:[], soon:[] };
/* ---- R5: সিস্টেম নোটিফিকেশন (ঐচ্ছিক, ডিফল্ট বন্ধ) ---- */
const DUE_NOTIFY_LOG_KEY = 'hisab_due_notified';   // ডিভাইস-লোকাল (ব্যাকআপে যায় না): { date, keys:{ 'loan:id':1 } }
const DUE_NOTIFY_MAX_PER_CHECK = 5;
let dueNotifyBusy = false;
/* ---- APK (Capacitor) এ নেটিভ নোটিফিকেশন; ব্রাউজারে আগের পদ্ধতি ---- */
let dueNativePerm = 'default';
function dueNativeLN(){ return (typeof bnPlugin === 'function') ? bnPlugin() : null; }
function dueNotifySupported(){ return !!dueNativeLN() || (typeof Notification !== 'undefined' && 'serviceWorker' in navigator); }
function dueNotifyPermission(){
  if(dueNativeLN()) return dueNativePerm;
  return dueNotifySupported() ? Notification.permission : 'unsupported';
}
async function refreshDueNativePerm(){
  const LN = dueNativeLN(); if(!LN) return;
  try{
    const p = await LN.checkPermissions();
    dueNativePerm = p.display === 'granted' ? 'granted' : (p.display === 'denied' ? 'denied' : 'default');
  }catch(e){}
  renderDueReminderSettings();
  queueNativeDueSchedule();
}
async function dueNativeInit(){
  if(!dueNativeLN()) return;
  await refreshDueNativePerm();
  try{
    if(dueNativePerm === 'granted' && !localStorage.getItem('hisab_due_native_init')){
      localStorage.setItem('hisab_due_native_init', '1');
      if(!settings.dueNotifyOn){ settings.dueNotifyOn = true; saveSettings(); renderDueReminderSettings(); queueNativeDueSchedule(); }
    }
  }catch(e){}
}
function dueNotifyActive(){ return dueReminderEnabled() && !!(settings && settings.dueNotifyOn) && dueNotifyPermission() === 'granted'; }
function readDueNotifyLog(today){
  try{
    const o = JSON.parse(localStorage.getItem(DUE_NOTIFY_LOG_KEY) || 'null');
    if(o && o.date === today && o.keys && typeof o.keys === 'object') return o;
  }catch(e){}
  return { date: today, keys: {} };
}
function saveDueNotifyLog(log){ try{ localStorage.setItem(DUE_NOTIFY_LOG_KEY, JSON.stringify(log)); }catch(e){} }
async function showDueNotification(title, body, tag){
  const LN0 = dueNativeLN();
  if(LN0){
    try{
      let h = 0; for(let i = 0; i < tag.length; i++){ h = (h * 31 + tag.charCodeAt(i)) % 800000; }
      await LN0.schedule({ notifications: [{ id: 100000 + h, title: title, body: body, schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true }, extra: { action: 'due' } }] });
      return true;
    }catch(e){ return false; }
  }
  const opts = { body: body, tag: tag, icon: './icon-192.png', badge: './icon-192.png', data: { url: './' } };
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg){ await reg.showNotification(title, opts); return true; }
  }catch(e){}
  try{ new Notification(title, opts); return true; }catch(e){ return false; }
}
function dueNotifyTitle(it, state){
  const pay = isPayItem(it.kind, it.type);
  if(state === 'overdue') return L('dueNotifTitleOverdue');
  if(state === 'soon') return L('dueNotifTitlePaySoon');
  return L(pay ? 'dueNotifTitlePayToday' : 'dueNotifTitleRecvToday');
}
function dueNotifyContent(it, state){
  const title = dueNotifyTitle(it, state);
  let lockOn = false;
  try{ lockOn = (typeof isLockEnabled === 'function') && isLockEnabled(); }catch(e){}
  if(lockOn) return { title: title, body: L('dueNotifBodyPrivate') };   // পাসওয়ার্ড-লক থাকলে নাম/টাকা লক-স্ক্রিনে নয়
  const name = it.type === 'self' ? L('loanSelfPersonLabel') : (it.person == null ? '' : String(it.person));
  const rel = dueReminderRelText(it.daysDiff);
  return { title: title, body: [name, moneyFmt(it.amount), rel].filter(Boolean).join(' · ') };
}
async function maybeNotifyDueReminders(){
  if(dueNativeLN()) return;   // APK-তে আগে থেকে শিডিউল করা নোটিফিকেশনই কাজ করে
  if(dueNotifyBusy || !dueNotifyActive()) return;
  dueNotifyBusy = true;
  try{
    const today = todayStr();
    const log = readDueNotifyLog(today);
    const r = getDueReminders(today, dueReminderWindowDays());
    const all = [];
    [['today', r.today], ['soon', r.soon]].forEach(p => p[1].forEach(it => all.push({ it: it, state: p[0] })));   // মেয়াদ-পেরোনোর জন্য রোজ নোটিফিকেশন নয়
    const fresh = all.filter(x => !log.keys[x.it.kind + ':' + x.it.id]).slice(0, DUE_NOTIFY_MAX_PER_CHECK);
    for(const x of fresh){
      const c = dueNotifyContent(x.it, x.state);
      if(await showDueNotification(c.title, c.body, 'due-' + x.it.kind + '-' + x.it.id)) log.keys[x.it.kind + ':' + x.it.id] = 1;
    }
    saveDueNotifyLog(log);
  }finally{ dueNotifyBusy = false; }
}
async function onDueNotifyToggle(checked){
  if(!checked){ settings.dueNotifyOn = false; saveSettings(); renderDueReminderSettings(); queueNativeDueSchedule(); return; }
  if(dueNativeLN()){
    const ok = (typeof bnEnsurePermission === 'function') ? await bnEnsurePermission(true) : false;
    await refreshDueNativePerm();
    if(!ok){ settings.dueNotifyOn = false; saveSettings(); renderDueReminderSettings(); toast(L('dueNotifDeniedMsg')); return; }
    settings.dueNotifyOn = true; saveSettings(); renderDueReminderSettings(); queueNativeDueSchedule();
    return;
  }
  let perm = dueNotifyPermission();
  if(perm === 'default'){ try{ perm = await Notification.requestPermission(); }catch(e){ perm = 'denied'; } }
  if(perm !== 'granted'){
    settings.dueNotifyOn = false; saveSettings(); renderDueReminderSettings();
    toast(L(perm === 'unsupported' ? 'dueNotifUnsupportedMsg' : 'dueNotifDeniedMsg'));
    return;
  }
  settings.dueNotifyOn = true; saveSettings(); renderDueReminderSettings();
  maybeNotifyDueReminders();
}
/* ---- APK: মেয়াদের দিন সকাল ৯টায় শিডিউল (অ্যাপ বন্ধ থাকলেও আসে) ----
   প্রতিটা (আইটেম+অবস্থা) একবারই; সময় 'hisab_due_native_slots'-এ স্থির রাখা হয় যাতে বারবার রিশিডিউলে দেরি না হয় বা ডাবল না আসে */
const DUE_NATIVE_SLOTS_KEY = 'hisab_due_native_slots';
let dueSchedTimer = null, dueSchedBusy = false;
function queueNativeDueSchedule(){
  if(!dueNativeLN()) return;
  clearTimeout(dueSchedTimer);
  dueSchedTimer = setTimeout(scheduleNativeDueNotifications, 1500);
}
async function scheduleNativeDueNotifications(){
  const LN = dueNativeLN(); if(!LN || dueSchedBusy) return;
  dueSchedBusy = true;
  try{
    const pend = await LN.getPending();
    const mine = ((pend && pend.notifications) || []).filter(n => n.id >= 8000 && n.id < 9000).map(n => ({ id: n.id }));
    if(mine.length) await LN.cancel({ notifications: mine });
    if(!dueNotifyActive()){ try{ localStorage.removeItem(DUE_NATIVE_SLOTS_KEY); }catch(e){} return; }
    const now = Date.now();
    let slots = {};
    try{ slots = JSON.parse(localStorage.getItem(DUE_NATIVE_SLOTS_KEY) || '{}') || {}; }catch(e){ slots = {}; }
    const keep = {}, list = [];
    const add = (kind, x) => {
      if(!x || x.settled) return;
      const dn = reminderDayNumber(x.dueDate); if(dn === null) return;
      const amount = Number(x.amount); if(!isFinite(amount) || amount <= 0) return;
      const p = x.dueDate.split('-').map(Number);
      const at = off => new Date(p[0], p[1] - 1, p[2] + off, 9, 0, 0).getTime();
      const it = { kind: kind, type: x.type, id: x.id, person: x.person, amount: amount, dueDate: x.dueDate };
      const states = [];
      if(isPayItem(kind, x.type)) states.push(['soon', at(-1), 1, 'soon1']);   // দিতে হলে ১ দিন আগে সকাল ৯টায়
      states.push(['today', at(0), 0, 'today']);                               // মেয়াদের দিন সকাল ৯টায় (পাওয়া/দেওয়া দুটোতেই)
      states.forEach(st => {
        const key = kind + ':' + x.id + ':' + x.dueDate + ':' + st[3];
        let t = slots[key];
        if(!t){
          t = st[1];
          if(t <= now) t = 0;   // সময় পেরিয়ে গেছে → আর শিডিউল নয় (বেলে দেখা যাবে)
        }
        if(t) keep[key] = t;
        if(t && t > now) list.push({ t: t, state: st[0], it: Object.assign({ daysDiff: st[2] }, it) });
      });
    };
    (Array.isArray(loans) ? loans : []).forEach(l => add('loan', l));
    (Array.isArray(dues) ? dues : []).forEach(d => add('due', d));
    list.sort((a, b) => a.t - b.t);
    const batch = list.slice(0, 60).map((e, i) => {
      const c = dueNotifyContent(e.it, e.state);
      return { id: 8000 + i, title: c.title, body: c.body, schedule: { at: new Date(e.t), allowWhileIdle: true }, extra: { action: 'due' } };
    });
    if(batch.length) await LN.schedule({ notifications: batch });
    try{ localStorage.setItem(DUE_NATIVE_SLOTS_KEY, JSON.stringify(keep)); }catch(e){}
  }catch(e){ console.warn('due native schedule failed', e); }
  finally{ dueSchedBusy = false; }
}

function renderDueReminderSettings(){   // সেটিংস-সেকশন: সুইচ + ১/৩/৭ বাটন (ভাষা বদলালেও নতুন লেবেল)
  const sw = document.getElementById('dueReminderToggle');
  if(!sw) return;
  const on = dueReminderEnabled();
  sw.checked = on;
  const seg = document.getElementById('dueReminderDaysSeg');
  seg.classList.toggle('disabled', !on);
  const nsw = document.getElementById('dueNotifyToggle'), nst = document.getElementById('dueNotifyStatus');
  if(nsw){
    const perm = dueNotifyPermission();
    nsw.checked = !!settings.dueNotifyOn && perm === 'granted';
    nsw.disabled = !on || perm === 'unsupported';
    nst.textContent = perm === 'unsupported' ? L('dueNotifUnsupportedMsg') : (perm === 'denied' ? L('dueNotifDeniedMsg') : '');
    nst.className = 'settings-desc' + (nst.textContent ? ' warn' : '');
  }
  seg.querySelectorAll('button').forEach(b => {
    const d = Number(b.dataset.days);
    b.textContent = tfmt('dueRemDaysBtnFmt', { n: numFmt(d) });
    b.disabled = !on;
    b.classList.toggle('on', d === dueReminderWindowDays());
    b.classList.toggle('income', d === dueReminderWindowDays());
    b.setAttribute('aria-pressed', d === dueReminderWindowDays() ? 'true' : 'false');
  });
}

function dueReminderRelText(diff){
  if(diff === 0) return '';
  if(diff === -1) return L('dueRemYesterday');
  if(diff < 0) return tfmt('dueRemDaysAgoFmt', { n: numFmt(-diff) });
  if(diff === 1) return L('dueRemTomorrow');
  return tfmt('dueRemInDaysFmt', { n: numFmt(diff) });
}

function dueReminderRowHtml(it){
  const typeLabel = it.kind === 'loan'
    ? (it.type === 'taken' ? L('loanTakenLabel') : it.type === 'self' ? L('loanSelfLabel') : L('loanGivenLabel'))
    : (it.type === 'receivable' ? L('dueReceivableLabel') : L('duePayableLabel'));
  const positive = (it.type === 'given' || it.type === 'receivable');   // টাকা আসবে = সবুজ, দিতে হবে = লাল
  const name = it.type === 'self' ? L('loanSelfPersonLabel') : (it.person == null ? '' : String(it.person));
  const rel = dueReminderRelText(it.daysDiff);
  return '<div class="entry '+(positive ? 'income-bg' : 'expense-bg')+'"><div class="left"><span class="tag">'+
    '<span class="accbadge">'+typeLabel+'</span>'+
    '<b>'+escapeHtml(name)+'</b> · '+escapeHtml(it.dueDate)+(rel ? ' · '+rel : '')+'</span></div>'+
    '<div class="actions"><span class="amt '+(positive ? 'income' : 'expense')+'">'+moneyFmt(it.amount)+'</span></div></div>';
}

function renderDueReminderModalBody(r, win){
  const group = (cls, label, list) => list.length === 0 ? '' :
    '<div class="due-rem-head '+cls+'"><span>'+label+'</span><span>'+numFmt(list.length)+'</span></div>'+list.map(dueReminderRowHtml).join('');
  return group('overdue', L('dueRemOverdueHead'), r.overdue) +
         group('today', L('dueRemTodayHead'), r.today) +
         group('soon', tfmt('dueRemSoonHeadFmt', { d: numFmt(win) }), r.soon);
}

function isDueReminderModalOpen(){ return !!dueReminderModalEl && dueReminderModalEl.classList.contains('open'); }

function renderDueReminders(){
  const win = dueReminderWindowDays();
  const r = dueReminderEnabled() ? getDueReminders(todayStr(), win) : DUE_REMINDER_EMPTY;
  const o = r.overdue.length, t = r.today.length, s = r.soon.length, total = o + t + s;

  if(dueReminderCardEl){
    if(total === 0){ dueReminderCardEl.classList.remove('show', 'overdue'); }
    else {
      const parts = [];
      if(o) parts.push(tfmt('dueRemOverdueFmt', { n: numFmt(o) }));
      if(t) parts.push(tfmt('dueRemTodayFmt', { n: numFmt(t) }));
      if(s) parts.push(tfmt('dueRemSoonFmt', { d: numFmt(win), n: numFmt(s) }));
      document.getElementById('dueReminderMsg').textContent = parts.join(' · ');
      dueReminderCardEl.classList.add('show');
      dueReminderCardEl.classList.toggle('overdue', o > 0);
    }
  }
  if(loansTabBadgeEl){ loansTabBadgeEl.classList.remove('show', 'overdue'); loansTabBadgeEl.textContent = ''; }   // ট্যাবে সংখ্যা-ব্যাজ নেই (বেল আইকনেই দেখায়)
  if(isDueReminderModalOpen()){   // মডাল খোলা অবস্থায় ডেটা/ভাষা/দিন বদলালে তালিকা সঙ্গে সঙ্গে ঠিক থাকে
    if(total === 0) closeDueReminders();
    else document.getElementById('dueReminderBody').innerHTML = renderDueReminderModalBody(r, win);
  }
  renderDueReminderSettings();
  queueNativeDueSchedule();
  if(typeof checkRecurringReminder === 'function') checkRecurringReminder();   // বেল-ব্যাজ ও খোলা প্যানেল আপডেট
}

function openDueReminders(){
  if(!dueReminderModalEl || isDueReminderModalOpen()) return;
  const win = dueReminderWindowDays();
  const r = getDueReminders(todayStr(), win);
  if(r.overdue.length + r.today.length + r.soon.length === 0) return;
  document.getElementById('dueReminderBody').innerHTML = renderDueReminderModalBody(r, win);
  dueReminderModalEl.classList.add('open');
  lockBodyScroll();
}
function closeDueReminders(){
  if(!isDueReminderModalOpen()) return;
  dueReminderModalEl.classList.remove('open');
  unlockBodyScroll();
}
if(dueReminderCardEl){
  /* Enter/Space-এ খোলা document-এর গ্লোবাল role="button" কীবোর্ড হ্যান্ডলার (entries.js) থেকেই
     আসে — এখানে আলাদা keydown লিসনার লাগে না (A1: কমন হেল্পার পুনর্ব্যবহার, ডুপ্লিকেট নয়)। */
  dueReminderCardEl.addEventListener('click', openDueReminders);
}
document.getElementById('dueReminderCloseBtn').addEventListener('click', closeDueReminders);
if(dueReminderModalEl) dueReminderModalEl.addEventListener('click', (e)=>{ if(e.target === dueReminderModalEl) closeDueReminders(); });

/* ============================================================
   R3 — লোন/বকেয়া কার্ডে রঙিন মেয়াদ-ট্যাগ
   ------------------------------------------------------------
   render.js-এর renderLoansTab()/renderDuesTab() একবার getDueReminderTagMap() নেয়, তারপর প্রতি কার্ডে
   dueReminderTagHtml(map, kind, id) — শুধু "ফেরত দেওয়ার কথা" (dueDate) সারিতে বসে।
   অবস্থা: overdue = লাল, today = সোনালি (--amber), soon = হালকা/নিরপেক্ষ। বাকি আইটেমে (দূরের তারিখ/settled/তারিখহীন) ট্যাগ নেই।
   ============================================================ */
function getDueReminderTagMap(){
  const map = Object.create(null);
  if(!dueReminderEnabled()) return map;
  const r = getDueReminders(todayStr(), dueReminderWindowDays());
  [['overdue', r.overdue], ['today', r.today], ['soon', r.soon]].forEach(pair => {
    pair[1].forEach(it => { map[it.kind + ':' + it.id] = { state: pair[0], daysDiff: it.daysDiff }; });
  });
  return map;
}
function dueReminderTagHtml(map, kind, id){
  const m = map && map[kind + ':' + id];
  if(!m) return '';
  const rel = dueReminderRelText(m.daysDiff);
  const label = m.state === 'overdue' ? L('dueRemOverdueHead') + ' · ' + rel
              : m.state === 'today'   ? L('dueRemTodayHead')
              :                         L('dueRemSoonTag') + ' · ' + rel;
  return '<span class="due-tag ' + m.state + '">' + label + '</span>';
}


/* ============================================================
   বেল-প্যানেলে ঋণ/বকেয়ার মেয়াদ-রিমাইন্ডার
   ------------------------------------------------------------
   getNotifDueItems() → আজ + (দিতে হলে) আগামীকাল + মেয়াদ-পেরোনো (এখনো বাকি)
   পরিশোধ/আদায় হলে renderAll() → renderDueReminders() → বেল আপনা-আপনি হালনাগাদ, আইটেম সরে যায়।
   ============================================================ */
function getNotifDueItems(){
  if(!dueReminderEnabled()) return [];
  const r = getDueReminders(todayStr(), 1);
  return [].concat(r.today, r.soon, r.overdue);
}
function notifDueAction(kind, type, id){
  closeRecurringPendingModal();
  setTimeout(()=>{
    if(kind === 'due') openSettleDueModal(id);
    else if(type === 'self') openSelfLoanCardRepayModal(id);
    else settleLoan(id);
  }, 120);
}
let notifOpenKey = null;   // প্যানেলে এখন যেটার বিস্তারিত খোলা (রিরেন্ডারেও ঠিক থাকে)
const NT_CHEVRON = '<svg class="nt-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function renderNotifDueCards(items){
  return items.map(it=>{
    const typeLabel = it.kind === 'loan'
      ? (it.type === 'taken' ? L('loanTakenLabel') : it.type === 'self' ? L('loanSelfLabel') : L('loanGivenLabel'))
      : (it.type === 'receivable' ? L('dueReceivableLabel') : L('duePayableLabel'));
    const name = it.type === 'self' ? L('loanSelfPersonLabel') : (it.person == null ? '' : String(it.person));
    const state = it.daysDiff < 0 ? 'overdue' : it.daysDiff === 0 ? 'today' : 'soon';
    const stateLbl = state === 'overdue' ? L('dueRemOverdueHead') : state === 'today' ? L('dueRemTodayHead') : L('dueRemTomorrow');
    const rel = state === 'overdue' ? dueReminderRelText(it.daysDiff) : '';
    const act = it.pay ? L('payBtnLabel') : L('collectBtnLabel');
    const key = 'd:'+it.kind+':'+it.id;
    const ttl = dueNotifyTitle(it, state);
    return '<div class="notif-item notif-due '+(it.pay ? 'pay' : 'recv')+' '+state+(notifOpenKey === key ? ' open' : '')+'" data-key="'+key+'">'+
      '<button type="button" class="nt-head" aria-expanded="'+(notifOpenKey === key ? 'true' : 'false')+'"><span class="nt-title">'+escapeHtml(name)+' — '+ttl+'</span>'+NT_CHEVRON+'</button>'+
      '<div class="nt-body">'+
        '<div class="nd-top"><span class="nd-name">'+escapeHtml(name)+'</span><span class="nd-amt">'+moneyFmt(it.amount)+'</span></div>'+
        '<div class="nd-meta"><span class="nd-type">'+typeLabel+'</span><span class="nd-state '+state+'">'+stateLbl+(rel ? ' · '+rel : '')+'</span><span>'+escapeHtml(it.dueDate)+'</span></div>'+
        '<div class="nd-actions"><button class="ri-pay-btn nd-btn" onclick="notifDueAction(\''+it.kind+'\',\''+it.type+'\','+Number(it.id)+')">'+act+'</button></div>'+
      '</div>'+
    '</div>';
  }).join('');
}
