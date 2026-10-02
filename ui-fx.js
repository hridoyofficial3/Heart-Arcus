/* ============================================================
   Premium selection bars — sliding indicator for tabs & segments
   ============================================================ */
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VARIANTS = ['income','expense','need','want','self'];

  function move(ind, el, instant){
    if(!ind || !el || !el.offsetWidth){ if(ind) ind.style.opacity = '0'; return; }
    if(instant || reduce) ind.classList.add('no-anim');
    ind.style.width = el.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + el.offsetLeft + 'px)';
    ind.style.opacity = '1';
    if(instant || reduce) requestAnimationFrame(()=> requestAnimationFrame(()=> ind.classList.remove('no-anim')));
  }

  /* ---------- main tab bar ---------- */
  function initTabs(){
    const tabs = document.querySelector('.tabs');
    if(!tabs || tabs.querySelector('.tab-ind')) return;
    tabs.classList.add('fx');
    const ind = document.createElement('span');
    ind.className = 'tab-ind';
    ind.setAttribute('aria-hidden','true');
    tabs.insertBefore(ind, tabs.firstChild);
    let first = true;
    const sync = ()=>{
      const act = tabs.querySelector('.tab.active');
      move(ind, act, first);
      first = false;
      if(act && tabs.scrollWidth > tabs.clientWidth + 2){
        tabs.scrollTo({ left: act.offsetLeft - (tabs.clientWidth - act.offsetWidth)/2, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    new MutationObserver(sync).observe(tabs, { subtree:true, attributes:true, attributeFilter:['class'] });
    if(window.ResizeObserver) new ResizeObserver(()=>{ first = true; sync(); }).observe(tabs);
    window.addEventListener('resize', ()=>{ first = true; sync(); });
    tabs.addEventListener('click', e=>{
      const t = e.target.closest('.tab');
      if(t){ t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); try{ navigator.vibrate && navigator.vibrate(8); }catch(_){} }
    });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ first = true; sync(); });
    sync();
  }

  /* ---------- segmented controls ---------- */
  function initSeg(seg){
    if(seg.__fx || seg.closest('#settingsModal')) return;
    seg.__fx = true;
    seg.classList.add('fx');
    const th = document.createElement('span');
    th.className = 'seg-thumb';
    th.setAttribute('aria-hidden','true');
    seg.insertBefore(th, seg.firstChild);
    let first = true;
    const sync = ()=>{
      const on = seg.querySelector('button.on');
      if(!on){ th.style.opacity = '0'; return; }
      th.dataset.v = VARIANTS.find(v=> on.classList.contains(v)) || 'income';
      move(th, on, first);
      first = false;
    };
    new MutationObserver(sync).observe(seg, { subtree:true, attributes:true, attributeFilter:['class'] });
    if(window.ResizeObserver) new ResizeObserver(()=>{ first = true; sync(); }).observe(seg);
    sync();
  }
  function initAllSeg(){ document.querySelectorAll('.seg').forEach(initSeg); }

  function boot(){
    initTabs(); initAllSeg();
    let t;
    new MutationObserver(()=>{ clearTimeout(t); t = setTimeout(initAllSeg, 80); })
      .observe(document.body, { childList:true, subtree:true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
