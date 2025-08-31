// script.js — listes via manifest.json avec fallback local (data-embedded)
(function(){
  function qsa(s, r=document){ return Array.from(r.querySelectorAll(s)); }
  function setupSelect(select){
    const manifestUrl = select.getAttribute('data-manifest');
    function fill(list){
      select.innerHTML = '<option value="">—</option>';
      list.forEach(item=>{
        const opt=document.createElement('option');
        opt.value=item.file;
        opt.textContent=item.label||item.file;
        select.appendChild(opt);
      });
    }
    function loadEmbedded(){
      const raw = select.getAttribute('data-embedded');
      if(!raw) return;
      try { const list = JSON.parse(raw); if(Array.isArray(list)){ fill(list); select.disabled=false; } } catch(e){}
    }
    if(manifestUrl){
      fetch(manifestUrl, {cache:'no-store'})
        .then(r=>r.ok?r.json():[])
        .then(list=>{
          if(Array.isArray(list) && list.length){ fill(list); select.disabled=false; }
          else { loadEmbedded(); }
        })
        .catch(loadEmbedded);
    } else {
      loadEmbedded();
    }
    select.addEventListener('change', e=>{
      const base=select.getAttribute('data-base');
      const file=select.value;
      if(file && base){ window.location.href = base + '/' + file; }
    });
  }
  qsa('[data-toggle-panel]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.preventDefault();
      const id = btn.getAttribute('data-toggle-panel');
      const panel = document.getElementById(id);
      if(!panel) return;
      panel.classList.toggle('open');
      if(panel.classList.contains('open')){
        qsa('select[data-manifest]', panel).forEach(setupSelect);
      }
    });
  });
})();