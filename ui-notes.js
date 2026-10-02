/* ============================================================
   বিবরণ ফিল্ড — সিলেক্ট বারের মতো (bottom sheet)
   - আয়ের নাম শুধু আয়ে, ব্যয়ের নাম শুধু ব্যয়ে দেখায়
   - নিচের "+ নতুন নাম যোগ করো" দিয়ে নাম সেভ করা যায়
   ============================================================ */
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAG = '<svg class="acc-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
  const CHEV = '<svg class="ps-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const T = (k, fb) => { try{ const v = L(k); return (v && v !== k) ? v : fb; }catch(_){ return fb; } };
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  const FIELDS = [
    { id:'noteInput',          type: () => (typeof curType !== 'undefined' ? curType : 'expense') },
    { id:'recurringNoteInput', type: () => { const b = document.querySelector('.recTypeBtn.on'); return b ? b.dataset.type : 'expense'; } },
    { id:'editNote',           type: () => { const b = document.querySelector('.editTypeBtn.on'); return b ? b.dataset.type : 'expense'; } }
  ];
  let sheet = null;

  /* ---------- data ---------- */
  function store(){
    if(!settings.noteNames || typeof settings.noteNames !== 'object') settings.noteNames = {};
    if(!settings.noteHidden || typeof settings.noteHidden !== 'object') settings.noteHidden = {};
    ['income','expense'].forEach(t=>{
      if(!Array.isArray(settings.noteNames[t])) settings.noteNames[t] = [];
      if(!Array.isArray(settings.noteHidden[t])) settings.noteHidden[t] = [];
    });
    return settings;
  }
  function autoNotes(){
    const set = new Set();
    try{ set.add(L('savingsAutoEntryNote')); ['bn','en'].forEach(l=>{ try{ const v = dict[l].savingsAutoEntryNote; if(v) set.add(v); }catch(_){} }); }catch(_){}
    return set;
  }
  function namesFor(type){
    const st = store(), skip = autoNotes();
    const out = [], seen = new Set();
    const push = n => { n = (n||'').trim(); const k = n.toLowerCase(); if(!n || skip.has(n) || seen.has(k)) return; seen.add(k); out.push(n); };
    st.noteNames[type].forEach(push);
    const counts = Object.create(null);
    (typeof entries !== 'undefined' ? entries : []).forEach(en=>{
      if(en.transfer || en.type !== type) return;
      const n = (en.note||'').trim();
      if(n) counts[n] = (counts[n]||0) + 1;
    });
    Object.keys(counts).sort((a,b)=> counts[b]-counts[a]).forEach(push);
    (typeof recurringTemplates !== 'undefined' ? recurringTemplates : []).forEach(t=>{ if(t.type === type) push(t.note); });
    return out;
  }
  function addName(type, name){
    const st = store();
    st.noteNames[type] = st.noteNames[type].filter(n=> n !== name);
    st.noteNames[type].unshift(name);
    saveSettings();
  }
  /* কোন নাম কতটি হিসাবে (এন্ট্রি + রিকারিং) ব্যবহার হয়েছে */
  function usageMap(type){
    const m = Object.create(null);
    (typeof entries !== 'undefined' ? entries : []).forEach(en=>{
      if(en.transfer || en.type !== type) return;
      const n = (en.note||'').trim(); if(n) m[n] = (m[n]||0) + 1;
    });
    (typeof recurringTemplates !== 'undefined' ? recurringTemplates : []).forEach(t=>{
      if(t.type !== type) return;
      const n = (t.note||'').trim(); if(n) m[n] = (m[n]||0) + 1;
    });
    return m;
  }
  /* শুধু হিসাবহীন নাম মোছা যায় — হিসাব থাকলে false */
  function removeName(type, name){
    if((usageMap(type)[name]||0) > 0) return false;
    const st = store();
    st.noteNames[type] = st.noteNames[type].filter(n=> n !== name);
    saveSettings();
    return true;
  }
  /* নাম বদলালে ওই নামের সব হিসাবও নতুন নামে আপডেট হয়, যাতে গ্রুপিং ঠিক থাকে */
  function renameName(type, oldN, newN){
    newN = (newN||'').trim();
    if(!newN) return { err:'empty' };
    if(newN === oldN) return { same:true };
    const low = newN.toLowerCase();
    if(namesFor(type).some(n=> n !== oldN && n.toLowerCase() === low)) return { err:'dup' };
    const snap = {
      st: JSON.stringify(store().noteNames),
      en: JSON.stringify(typeof entries !== 'undefined' ? entries : []),
      rc: JSON.stringify(typeof recurringTemplates !== 'undefined' ? recurringTemplates : [])
    };
    let n = 0;
    (typeof entries !== 'undefined' ? entries : []).forEach(en=>{
      if(!en.transfer && en.type === type && (en.note||'').trim() === oldN){ en.note = newN; n++; }
    });
    let tpl = 0;
    (typeof recurringTemplates !== 'undefined' ? recurringTemplates : []).forEach(t=>{
      if(t.type === type && (t.note||'').trim() === oldN){ t.note = newN; tpl++; }
    });
    const st = store(), i = st.noteNames[type].indexOf(oldN);
    if(i >= 0) st.noteNames[type][i] = newN; else st.noteNames[type].unshift(newN);
    // তিনটাই সেভ হতে হবে; একটাও ফেল করলে মেমরি আর সেভ — দুটোই আগের অবস্থায় ফেরানো হয়
    const okAll = [saveSettings(), n ? saveEntries() : true, tpl ? saveRecurring() : true].every(Boolean);
    if(!okAll){
      try{
        store().noteNames = JSON.parse(snap.st);
        entries.splice(0, entries.length, ...JSON.parse(snap.en));
        recurringTemplates.splice(0, recurringTemplates.length, ...JSON.parse(snap.rc));
        saveSettings(); saveEntries(); saveRecurring();
      }catch(_){}
      return { err:'save' };
    }
    if(n || tpl){ try{ renderAll(); }catch(_){} }
    return { ok:true, n: n + tpl };
  }
  const num = n => (typeof numFmt === 'function' ? numFmt(n) : n);

  /* ---------- trigger ---------- */
  function refresh(f){
    const v = (f.input.value || '').trim();
    const type = f.type() === 'income' ? 'income' : 'expense';
    f.trigger.className = 'ps-trigger nb-trigger t-' + type;
    f.trigger.innerHTML =
      '<span class="ps-label'+(v?'':' ph')+'">'+esc(v || f.input.placeholder || T('selectPlaceholder','সিলেক্ট করুন'))+'</span>' + CHEV;
  }

  /* ---------- sheet ---------- */
  function fitToViewport(){
    if(!sheet) return;
    const vv = window.visualViewport;
    if(vv){ sheet.style.top = vv.offsetTop + 'px'; sheet.style.height = vv.height + 'px'; sheet.style.bottom = 'auto'; }
  }
  function closeSheet(){
    if(!sheet) return;
    const s = sheet; sheet = null;
    s.classList.remove('open');
    document.body.classList.remove('ps-lock');
    document.removeEventListener('keydown', s.__key);
    if(window.visualViewport){ visualViewport.removeEventListener('resize', fitToViewport); visualViewport.removeEventListener('scroll', fitToViewport); }
    setTimeout(()=> s.remove(), reduce ? 0 : 280);
  }
  function choose(f, name){
    f.input.value = name;                       // setter → refresh
    f.input.dispatchEvent(new Event('input', { bubbles:true }));
    try{ navigator.vibrate && navigator.vibrate(6); }catch(_){}
    setTimeout(closeSheet, reduce ? 0 : 130);
  }
  function renderList(f, ov){
    const type = f.type() === 'income' ? 'income' : 'expense';
    const cur = (f.input.value || '').trim();
    const names = namesFor(type), use = usageMap(type);
    let html = '';
    if(cur){
      html += '<button type="button" class="ps-item nb-none" data-act="none"><span class="ps-name">'+esc(T('noteSugNone','কোনোটি নয়'))+'</span></button>';
    }
    names.forEach(n=>{
      const on = n === cur, c = use[n] || 0;
      html += '<div class="ps-item nb-row'+(on?' on':'')+'" role="option" aria-selected="'+on+'" data-act="pick" data-name="'+esc(n)+'">'+
        '<span class="ps-name"><span class="nb-nm">'+esc(n)+'</span>'+
        (c ? '<small class="nb-use">'+esc(tfmt('noteUsedFmt',{n:num(c)}))+'</small>' : '')+'</span>'+
        '<span class="ps-check">'+CHECK+'</span></div>';
    });
    if(!names.length && !cur) html += '<div class="nb-empty2">'+esc(T('noteSugEmpty','নিচের + চেপে নতুন নাম যোগ করো'))+'</div>';
    ov.querySelector('.ps-list').innerHTML = html;
  }
  function openSheet(f){
    if(sheet) return;
    const type = f.type() === 'income' ? 'income' : 'expense';
    const lab = f.wrap.parentElement && f.wrap.parentElement.querySelector('label');
    const ov = document.createElement('div');
    ov.className = 'ps-overlay';
    ov.innerHTML = '<div class="ps-sheet nb-sheet t-'+type+'" role="listbox"><div class="ps-grab"></div>'+
      '<div class="ps-title nb-title"><span>'+esc((lab && lab.textContent.trim()) || T('noteLabel','বিবরণ'))+'</span>'+
      '<span class="nb-badge '+type+'">'+esc(T(type==='income'?'typeIncome':'typeExpense', type==='income'?'আয়':'ব্যয়'))+'</span></div>'+
      '<div class="ps-list"></div>'+
      '<div class="nb-hint"><span class="nb-hint-ico">'+LOCK+'</span><span>'+esc(T('noteSheetHint','নাম মুছতে বা বদলাতে সেটিংস › এডভান্স মোডে যাও'))+'</span></div>'+
      '<div class="nb-foot"><button type="button" class="nb-new" data-act="new"><span class="nb-plus">'+PLUS+'</span><span>'+esc(T('noteSugNew','নতুন নাম যোগ করো'))+'</span></button></div></div>';
    document.body.appendChild(ov);
    document.body.classList.add('ps-lock');
    sheet = ov;
    renderList(f, ov);

    ov.addEventListener('click', e=>{
      if(e.target === ov){ closeSheet(); return; }
      const el = e.target.closest('[data-act]'); if(!el) return;
      const act = el.dataset.act, name = el.dataset.name;
      if(act === 'none'){ choose(f, ''); return; }
      if(act === 'pick'){ choose(f, name); return; }
      if(act === 'new'){ showForm(f, ov, type); return; }
      if(act === 'save'){ saveNew(f, ov, type); }
    });
    ov.__key = e=>{ if(e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', ov.__key);

    /* swipe-down to close */
    const sh = ov.querySelector('.ps-sheet'), list = ov.querySelector('.ps-list');
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', e=>{ if(e.target.closest('.nb-form')) return; if(list.scrollTop <= 0){ y0 = e.touches[0].clientY; dy = 0; } }, { passive:true });
    sh.addEventListener('touchmove', e=>{ if(y0 === null) return; dy = e.touches[0].clientY - y0; if(dy > 0){ sh.style.transition = 'none'; sh.style.transform = 'translateY('+dy+'px)'; } }, { passive:true });
    sh.addEventListener('touchend', ()=>{ if(y0 === null) return; sh.style.transition = ''; sh.style.transform = ''; if(dy > 90) closeSheet(); y0 = null; dy = 0; });

    if(window.visualViewport){ visualViewport.addEventListener('resize', fitToViewport); visualViewport.addEventListener('scroll', fitToViewport); }
    requestAnimationFrame(()=> requestAnimationFrame(()=>{
      ov.classList.add('open');
      const on = ov.querySelector('.ps-item.on'); if(on) on.scrollIntoView({ block:'center' });
    }));
  }
  function showForm(f, ov, type){
    const foot = ov.querySelector('.nb-foot');
    foot.innerHTML = '<div class="nb-form"><input type="text" class="nb-in" autocomplete="off" maxlength="60" placeholder="'+esc(T('noteSugNamePh','নাম লিখুন'))+'">'+
      '<button type="button" class="nb-save" data-act="save" aria-label="'+esc(T('noteSugSave','সেভ'))+'">'+CHECK+'</button></div>';
    const inp = foot.querySelector('.nb-in');
    inp.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); saveNew(f, ov, type); } });
    setTimeout(()=> inp.focus(), 60);
  }
  function saveNew(f, ov, type){
    const inp = ov.querySelector('.nb-in');
    const name = inp ? inp.value.trim() : '';
    if(!name){ if(inp){ inp.classList.add('shake'); setTimeout(()=> inp.classList.remove('shake'), 400); inp.focus(); } return; }
    addName(type, name);
    choose(f, name);
  }

  /* ---------- সেটিংস › এডভান্স মোড › বিবরণের নাম ---------- */
  let mgrType = 'expense', mgrEdit = null, mgrNames = [];
  function renderManager(){
    const box = document.getElementById('noteMgrList'); if(!box) return;
    document.querySelectorAll('#noteMgrSeg button').forEach(b=> b.classList.toggle('on', b.dataset.type === mgrType));
    mgrNames = namesFor(mgrType);
    const use = usageMap(mgrType);
    if(!mgrNames.length){ box.innerHTML = '<div class="nm-empty">'+esc(T('noteMgrEmpty','এখনো কোনো নাম নেই'))+'</div>'; return; }
    box.innerHTML = mgrNames.map((n, i)=>{
      const c = use[n] || 0;
      const ico = '';
      if(mgrEdit === i){
        return '<div class="nm-row editing t-'+mgrType+'" data-i="'+i+'">'+ico+
          '<input type="text" class="nm-in" maxlength="60" autocomplete="off" value="'+esc(n)+'" placeholder="'+esc(T('noteSugNamePh','নাম লিখুন'))+'">'+
          '<button type="button" class="nm-btn ok" data-nm="save" aria-label="'+esc(T('noteSugSave','সেভ'))+'">'+CHECK+'</button>'+
          '<button type="button" class="nm-btn" data-nm="cancel" aria-label="'+esc(T('cancelBtn','বাতিল'))+'">'+X+'</button></div>';
      }
      return '<div class="nm-row t-'+mgrType+'" data-i="'+i+'">'+ico+
        '<span class="nm-info"><span class="nm-name">'+esc(n)+'</span>'+
        '<span class="nm-use'+(c?' has':'')+'">'+esc(c ? tfmt('noteUsedFmt',{n:num(c)}) : T('noteUnused','কোনো হিসাব নেই'))+'</span></span>'+
        '<button type="button" class="nm-btn" data-nm="edit" aria-label="'+esc(T('noteEditAria','নাম বদলাও'))+'">'+PENCIL+'</button>'+
        (c
          ? '<button type="button" class="nm-btn lock" data-nm="locked" aria-label="'+esc(T('noteLockedAria','মোছা যাবে না — হিসাব আছে'))+'">'+LOCK+'</button>'
          : '<button type="button" class="nm-btn del" data-nm="del" aria-label="'+esc(T('noteSugRemove','মুছে ফেলো'))+'">'+TRASH+'</button>')+
        '</div>';
    }).join('');
    if(mgrEdit !== null){ const inp = box.querySelector('.nm-in'); if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  }
  function saveRename(row){
    const i = +row.dataset.i, old = mgrNames[i], inp = row.querySelector('.nm-in');
    const r = renameName(mgrType, old, inp.value);
    if(r.err){
      inp.classList.add('shake'); setTimeout(()=> inp.classList.remove('shake'), 400);
      if(r.err === 'dup') toast(T('noteDupToast','এই নামটি আগে থেকেই আছে'));
      if(r.err === 'save') toast(T('noteRenameFailToast','নাম বদলানো যায়নি — স্টোরেজ ভরা থাকতে পারে'));
      inp.focus(); return;
    }
    mgrEdit = null; renderManager();
    if(r.ok) toast(r.n ? tfmt('noteRenameDoneFmt',{n:num(r.n)}) : T('noteRenameDone','নাম বদলানো হলো'));
  }
  function bootManager(){
    const seg = document.getElementById('noteMgrSeg'), box = document.getElementById('noteMgrList');
    if(!seg || !box || box.__nm) return; box.__nm = true;
    seg.addEventListener('click', e=>{
      const b = e.target.closest('button[data-type]'); if(!b) return;
      mgrType = b.dataset.type; mgrEdit = null; renderManager();
    });
    box.addEventListener('click', e=>{
      const btn = e.target.closest('[data-nm]'); if(!btn) return;
      const row = btn.closest('.nm-row'), act = btn.dataset.nm, i = +row.dataset.i, name = mgrNames[i];
      if(act === 'edit'){ mgrEdit = i; renderManager(); return; }
      if(act === 'cancel'){ mgrEdit = null; renderManager(); return; }
      if(act === 'save'){ saveRename(row); return; }
      if(act === 'locked'){ toast(T('noteLockedToast','এই নামে হিসাব আছে, তাই মুছা যাবে না — শুধু নাম বদলানো যাবে')); return; }
      if(act === 'del'){
        openSimpleConfirm(tfmt('noteDeleteConfirmFmt',{name:name}), ()=>{
          if(removeName(mgrType, name)){ renderManager(); toast(T('noteNameDeleted','নাম মুছে ফেলা হলো')); }
          else { renderManager(); toast(T('noteLockedToast','এই নামে হিসাব আছে, তাই মুছা যাবে না — শুধু নাম বদলানো যাবে')); }
        });
      }
    });
    box.addEventListener('keydown', e=>{
      if(!e.target.classList.contains('nm-in')) return;
      if(e.key === 'Enter'){ e.preventDefault(); saveRename(e.target.closest('.nm-row')); }
      if(e.key === 'Escape'){ e.stopPropagation(); mgrEdit = null; renderManager(); }
    });
    const gear = document.getElementById('gearBtn');
    if(gear) gear.addEventListener('click', ()=>{ mgrEdit = null; renderManager(); });
    renderManager();
  }

  /* ---------- wiring ---------- */
  function enhance(cfg){
    const input = document.getElementById(cfg.id);
    if(!input || input.__nb) return;
    input.__nb = true;
    input.removeAttribute('list');
    const wrap = document.createElement('div');
    wrap.className = 'ps-wrap';
    input.parentNode.insertBefore(wrap, input);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    wrap.appendChild(trigger);
    wrap.appendChild(input);
    input.classList.add('nb-native');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden','true');
    const f = { input, wrap, trigger, type: cfg.type };
    input.__f = f;
    Object.defineProperty(input, 'value', {
      configurable:true,
      get(){ return nativeValue.get.call(this); },
      set(v){ nativeValue.set.call(this, v); refresh(f); }
    });
    input.addEventListener('input', ()=> refresh(f));
    trigger.addEventListener('click', ()=> openSheet(f));
    refresh(f);
  }
  function boot(){
    FIELDS.forEach(enhance);
    bootManager();
    /* আয়/ব্যয় বদলালে অন্য ধরনের নাম ফিল্ডে থেকে গেলে মুছে দাও */
    document.addEventListener('click', e=>{
      if(!e.target.closest || !e.target.closest('.typeBtn, .recTypeBtn, .editTypeBtn')) return;
      setTimeout(()=> FIELDS.forEach(c=>{
        const i = document.getElementById(c.id); if(!i || !i.__f) return;
        const t = c.type() === 'income' ? 'income' : 'expense', v = (nativeValue.get.call(i) || '').trim();
        if(v && !namesFor(t).includes(v)) i.value = '';
      }), 0);
    }, true);
    /* type buttons / language change → keep trigger colors & placeholder in sync */
    document.addEventListener('click', ()=> setTimeout(()=> { if(mgrEdit === null) renderManager(); FIELDS.forEach(c=>{ const i = document.getElementById(c.id); if(i && i.__f) refresh(i.__f); }); }, 60), true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
