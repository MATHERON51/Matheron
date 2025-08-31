/*! MatHeron — final fixes pack (2025-08-15)
 *  - Place ONE <script defer src="../../../../js/matheron-final-fixes.js"></script> at the end of <body> on every page
 *  - Remove duplicate math-kbd includes (keep skeleton's) and remove ch0-mul-clean.multiplicatif.js
 *  - PDF controls: single + mounted just below #accept
 *  - Robust spacing around words/formulas in statements & steps
 *  - Inéquations: ensure "p/q" fraction appears in the input after Solution
 *  - Repère: amp fallback + optional patch hook (if repere_patch_0813.js is present)
 */

(function(){
  'use strict';

  // -------- 1) PDF controls: single + mounted after #accept
  function remountPDF(){
    try{
      document.querySelectorAll('.pdf-controls').forEach(function(x){ x.remove(); });
      if (window.ExoPDF && typeof ExoPDF.init==='function'){
        ExoPDF.init({ mountAfterSelector:'#accept', max:50 });
      }
    }catch(e){ console.warn('[fix] exopdf remount', e); }
  }

  // -------- 2) Keyboard: keep a single mounted keyboard UI
  function dedupeKbd(){
    try{
      var kbs = document.querySelectorAll('.math-kbd');
      for(var i=0;i<kbs.length-1;i++){ kbs[i].remove(); }
    }catch(_){}
  }

  // -------- 3) Spacing around formulas & words
  function fixSpaces(){
    var sels=['.equ','.statement','.consigne','.hint','#res','#resSet','.steps','.step','.legend'];
    sels.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        var h = el.innerHTML;
        h = h.replace(/([A-Za-zÀ-ÖØ-öø-ÿ0-9])\(/g, '$1 (');
        h = h.replace(/\)(?=[A-Za-zÀ-ÖØ-öø-ÿ0-9])/g, ') ');
        h = h.replace(/([A-Za-zÀ-ÖØ-öø-ÿ])([A-Za-z])\(/g, '$1 $2(');
        h = h.replace(/,\s*/g, ', ');
        h = h.replace(/\s{2,}/g,' ');
        el.innerHTML = h.trim();
      });
    });
  }

  // -------- 4) Inéquations: force "p/q" in input after Solution if fraction found in steps
  function patchIneq(){
    var btn = document.getElementById('btn-solution') || document.getElementById('btn-check');
    if(!btn) return;
    btn.addEventListener('click', function(){
      setTimeout(function(){
        var host = document.getElementById('host') || document;
        var inp = host.querySelector('#reponseIneq, #reponse, input[type="text"]');
        if(!inp) return;
        var v = (inp.value||'').trim();
        if(!/\/\d+/.test(v)){
          var ref = document.getElementById('resSet') || document.getElementById('res') || host;
          var t = (ref.innerText || ref.textContent || '');
          var m = t.match(/(\d+)\s*[⁄\/]\s*(\d+)/);
          if(m){ v = v.replace(/([<≥>≤])\s*\d+/, '$1 '+m[1]+'/'+m[2]); }
        }
        v = v.replace(/-/g,'−').replace(/\s+/g,' ').trim();
        inp.value = v;
      }, 0);
    });
  }

  // -------- 5) Repère: AMP fallback + "Appliquer"
  function patchRepere(){
    window.AMP = window.AMP || {xmin:-6,xmax:6,ymin:-6,ymax:6};
    function get(id){var el=document.getElementById(id); return el? parseInt(el.value,10) : null;}
    if(typeof window.applyAMPInputs!=='function'){
      window.applyAMPInputs = function(){
        var xm=get('xmin'), xM=get('xmax'), ym=get('ymin'), yM=get('ymax');
        if([xm,xM,ym,yM].every(function(x){return typeof x==='number' && !isNaN(x);})){
          window.AMP = {xmin:xm,xmax:xM,ymin:ym,ymax:yM};
        }
        if(typeof window.buildOne==='function') window.buildOne();
      };
    }
    var btn=document.getElementById('amp-apply');
    if(btn){ btn.addEventListener('click', function(ev){ ev.preventDefault(); window.applyAMPInputs(); }); }
  }

  // -------- 6) Button theme for Ensembles (grey/black)
  function ensemblesTheme(){
    try{
      if(!/ensembles(\.html)?$/i.test(location.pathname)) return;
      var st = document.getElementById('btn-neutral-theme');
      if(!st){
        st = document.createElement('style'); st.id='btn-neutral-theme';
        st.textContent = '.btn{background:#f7f7f7 !important; color:#111 !important; border-color:#dadada !important} .btn:hover{background:#efefef !important}';
        document.head.appendChild(st);
      }
    }catch(_){}
  }


  // -------- 7) Bootstrap if exercises did not initialize
  function bootstrapIfNeeded(){
    try{
      var R = window.REGISTRY || (typeof REGISTRY!=='undefined' ? REGISTRY : []);
      var sel = document.getElementById('exo-select');
      if(sel && R && R.length && !sel.options.length){
        R.forEach(function(e,i){ sel.appendChild(new Option(e.title || ('Exo '+(i+1)), e.id)); });
        sel.value = R[0].id;
      }
      if(typeof window.buildOne==='function') window.buildOne();
      if(typeof window.updateScore==='function') window.updateScore();
      var st=document.getElementById('status'); if(st) st.textContent='';
    }catch(_){}
  }

  // ---- boot
  function runAll(){
    bootstrapIfNeeded();
    remountPDF();
    dedupeKbd();
    fixSpaces();
    patchIneq();
    patchRepere();
    ensemblesTheme();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){
      runAll();
      setTimeout(runAll, 100);
      setTimeout(runAll, 600);
    });
  }else{
    runAll();
    setTimeout(runAll, 100);
    setTimeout(runAll, 600);
  }

  // re-run on common interactions & mutations
  ['#btn-new','#btn-solution','#btn-check','#btn-reset'].forEach(function(id){
    var b=document.querySelector(id); if(b) b.addEventListener('click', function(){ setTimeout(runAll,0); });
  });
  var sel=document.querySelector('#exo-select'); if(sel) sel.addEventListener('change', function(){ setTimeout(runAll,0); });
  try{
    new MutationObserver(function(){ setTimeout(runAll,0); }).observe(document.body, {subtree:true, childList:true, characterData:true});
  }catch(_){}

})();