/* ============================================================
   Premium select — native <select> → custom trigger + bottom sheet
   (native select stays in the DOM, so all existing logic keeps working)
   ============================================================ */
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const nativeIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const CHEV = '<svg class="ps-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>';
  let sheet = null;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const EMOJI = /^(\p{Extended_Pictographic}\uFE0F?\u200D?)+\s*/u;

  /* option → { icon html, bg, color, label } */
  function describe(opt){
    let label = (opt.textContent || '').trim();
    let icon = '', bg = '', color = '';
    try{
      const accs = (typeof getAccountsList === 'function') ? getAccountsList() : [];
      const a = accs.find(x => x.id === opt.value);
      if(a && a.icon && typeof accIconHtml === 'function'){
        icon = accIconHtml(a.icon);
        color = (typeof safeCssColor === 'function') ? safeCssColor(a.color) : (a.color || '');
        bg = (a.icon === '__bkash') ? '#fff' : '';
        label = label.replace(EMOJI, '');
      }
    }catch(_){}
    if(!icon){
      const m = label.match(EMOJI);
      if(m && typeof ACC_SVG !== 'undefined'){
        const tok = m[0].trim();
        if(ACC_SVG[tok] && typeof accIconHtml === 'function'){ icon = accIconHtml(tok); label = label.replace(EMOJI, ''); }
      }
    }
    return { icon, bg, color, label };
  }

  function tile(d, cls){
    if(!d.icon) return '';
    const st = (d.bg ? 'background:'+d.bg+';' : '') + (d.color ? 'color:'+d.color+';' : '');
    return '<span class="ps-ico '+(cls||'')+'" style="'+st+'">'+d.icon+'</span>';
  }

  function refresh(sel){
    const tr = sel.__ps; if(!tr) return;
    const opt = sel.options[sel.selectedIndex];
    const isPlaceholder = !opt || opt.value === '' ;
    const d = opt ? describe(opt) : { icon:'', label:'' };
    tr.innerHTML = (isPlaceholder ? '' : tile(d, 'sm')) +
      '<span class="ps-label'+(isPlaceholder ? ' ph' : '')+'">'+esc(d.label || (typeof L==='function' ? L('selectPlaceholder') : ''))+'</span>' + CHEV;
    tr.disabled = sel.disabled;
    tr.classList.toggle('is-disabled', sel.disabled);
    tr.classList.toggle('is-required', sel.required && isPlaceholder);
  }

  function titleOf(sel){
    const box = sel.closest('.ps-wrap') && sel.closest('.ps-wrap').parentElement;
    const l = box && box.querySelector('label');
    return (l && l.textContent.trim()) || (typeof L==='function' ? L('selectPlaceholder') : '');
  }

  function closeSheet(){
    if(!sheet) return;
    const s = sheet; sheet = null;
    s.classList.remove('open');
    document.body.classList.remove('ps-lock');
    document.removeEventListener('keydown', s.__key);
    setTimeout(()=> s.remove(), reduce ? 0 : 280);
    if(s.__sel && s.__sel.__ps) s.__sel.__ps.focus({ preventScroll:true });
  }

  function openSheet(sel){
    if(sheet || sel.disabled) return;
    const ov = document.createElement('div');
    ov.className = 'ps-overlay';
    let items = '';
    Array.from(sel.options).forEach((o, i)=>{
      if(o.value === '' && o.disabled) return;           // hide the placeholder
      const d = describe(o);
      const on = i === sel.selectedIndex;
      items += '<button type="button" class="ps-item'+(on?' on':'')+'" data-i="'+i+'"'+(o.disabled?' disabled':'')+' role="option" aria-selected="'+on+'">'+
        (tile(d) || '<span class="ps-dot"></span>')+
        '<span class="ps-name">'+esc(d.label)+'</span>'+
        '<span class="ps-check">'+CHECK+'</span></button>';
    });
    ov.innerHTML = '<div class="ps-sheet" role="listbox"><div class="ps-grab"></div>'+
      '<div class="ps-title">'+esc(titleOf(sel))+'</div><div class="ps-list">'+items+'</div></div>';
    ov.__sel = sel;
    document.body.appendChild(ov);
    document.body.classList.add('ps-lock');
    sheet = ov;

    ov.addEventListener('click', e=>{
      if(e.target === ov){ closeSheet(); return; }
      const b = e.target.closest('.ps-item');
      if(!b || b.disabled) return;
      const idx = +b.dataset.i;
      nativeIndex.set.call(sel, idx);
      refresh(sel);
      try{ navigator.vibrate && navigator.vibrate(6); }catch(_){}
      sel.dispatchEvent(new Event('input', { bubbles:true }));
      sel.dispatchEvent(new Event('change', { bubbles:true }));
      ov.querySelectorAll('.ps-item').forEach(x=>{ x.classList.toggle('on', x === b); });
      setTimeout(closeSheet, reduce ? 0 : 140);
    });
    ov.__key = e=>{ if(e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', ov.__key);

    /* swipe-down to close */
    const sh = ov.querySelector('.ps-sheet'), list = ov.querySelector('.ps-list');
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', e=>{ if(list.scrollTop <= 0){ y0 = e.touches[0].clientY; dy = 0; } }, { passive:true });
    sh.addEventListener('touchmove', e=>{
      if(y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if(dy > 0){ sh.style.transition = 'none'; sh.style.transform = 'translateY('+dy+'px)'; }
    }, { passive:true });
    sh.addEventListener('touchend', ()=>{
      if(y0 === null) return;
      sh.style.transition = ''; sh.style.transform = '';
      if(dy > 90) closeSheet();
      y0 = null; dy = 0;
    });

    requestAnimationFrame(()=> requestAnimationFrame(()=>{
      ov.classList.add('open');
      const on = ov.querySelector('.ps-item.on');
      if(on) on.scrollIntoView({ block:'center' });
    }));
  }

  function enhance(sel){
    if(sel.__ps || sel.multiple || sel.size > 1) return;
    const wrap = document.createElement('div');
    wrap.className = 'ps-wrap';
    sel.parentNode.insertBefore(wrap, sel);
    const tr = document.createElement('button');
    tr.type = 'button';
    tr.className = 'ps-trigger' + (sel.classList.contains('chip-select') ? ' chip' : '');
    tr.setAttribute('aria-haspopup', 'listbox');
    wrap.appendChild(tr);
    wrap.appendChild(sel);
    sel.classList.add('ps-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel.__ps = tr;

    /* programmatic .value / .selectedIndex assignments must refresh the trigger */
    Object.defineProperty(sel, 'value', {
      configurable:true,
      get(){ return nativeValue.get.call(this); },
      set(v){ nativeValue.set.call(this, v); refresh(this); }
    });
    Object.defineProperty(sel, 'selectedIndex', {
      configurable:true,
      get(){ return nativeIndex.get.call(this); },
      set(v){ nativeIndex.set.call(this, v); refresh(this); }
    });

    new MutationObserver(()=> refresh(sel)).observe(sel, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['disabled','selected','label'] });
    sel.addEventListener('change', ()=> refresh(sel));
    tr.addEventListener('click', ()=> openSheet(sel));
    refresh(sel);
  }

  function all(){ document.querySelectorAll('select').forEach(enhance); }
  function boot(){
    all();
    let t;
    new MutationObserver(()=>{ clearTimeout(t); t = setTimeout(all, 60); }).observe(document.body, { childList:true, subtree:true });
    /* language switch / late renders */
    document.addEventListener('click', ()=> setTimeout(()=> document.querySelectorAll('select').forEach(s=> s.__ps && refresh(s)), 120), true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
