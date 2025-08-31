/*! exo-pdf-kit.js — Générateur de fiches PDF réutilisable
   Attentes côté page : window.REGISTRY (array), #exo-select (select), chaque def a gen() et text(); def.printSolutionHTML(st) est facultatif.
*/
(function(){
  const DEFAULTS = {
    title: document.title.replace(/\s+–.+$/,'').trim() || 'Fiche d’exercices',
    lead: 'Résoudre :',
    max: 50,
    mountAfterSelector: '.controls.card',
    leadByDefId: null
  };

  function $(sel, r=document){ return r.querySelector(sel); }
  function pickDef(mix){
    if(!window.REGISTRY || !Array.isArray(window.REGISTRY) || !window.REGISTRY.length){
      console.warn('[exo-pdf-kit] REGISTRY introuvable'); return null;
    }
    if(mix) return REGISTRY[Math.floor(Math.random()*REGISTRY.length)];
    const sel = $('#exo-select');
    return REGISTRY.find(e => e.id === (sel? sel.value : null)) || REGISTRY[0];
  }

  // --- ENONCE ---
  function exerciseHTML(def, st){
  if (typeof def.textHTML === 'function') return def.textHTML(st);

  if (typeof def.render === 'function') {
    try {
      const tmp = document.createElement('div');
      tmp.style.position = 'fixed';
      tmp.style.left = '-10000px';
      tmp.style.top = '-10000px';
      tmp.style.width = '0';
      tmp.style.height = '0';
      tmp.style.overflow = 'hidden';
      document.body.appendChild(tmp);

      def.render(tmp, st);
      const equ = tmp.querySelector('.equ');
      const html = equ ? equ.innerHTML : tmp.innerHTML;

      tmp.remove();
      if (html && html.trim()) return html;
    } catch (e) {
      console.warn('[exo-pdf-kit] fallback render failed', e);
    }
  }

  if (typeof def.text === 'function') return def.text(st);
  return 'Énoncé indisponible';
} catch (e) {
        console.warn('[exo-pdf-kit] fallback render failed', e);
      }
    }
    return 'Énoncé indisponible';
  }
function staticizeForPrint(root){
  // Remplace <select> par le texte choisi
  root.querySelectorAll('select').forEach(sel=>{
    const txt = sel.options[sel.selectedIndex]?.text || sel.value || '—';
    const span = document.createElement('span');
    span.className = 'sol-sel';
    span.textContent = txt;
    sel.replaceWith(span);
  });
  // Remplace checkbox/radio par un symbole
  root.querySelectorAll('input[type=checkbox]').forEach(chk=>{
    const span = document.createElement('span');
    span.className = 'sol-check';
    span.textContent = chk.checked ? '✓' : '✗';
    chk.replaceWith(span);
  });
  root.querySelectorAll('input[type=radio]').forEach(r=>{
    const span = document.createElement('span');
    span.className = 'sol-check';
    span.textContent = r.checked ? '●' : '○';
    r.replaceWith(span);
  });
  // Remplace inputs texte/nombre par leur valeur
  root.querySelectorAll('input[type=text], input[type=number]').forEach(inp=>{
    const span = document.createElement('span');
    span.className = 'sol-text';
    span.textContent = inp.value || inp.placeholder || '';
    inp.replaceWith(span);
  });
  // On supprime les boutons éventuels
  root.querySelectorAll('button').forEach(b=>b.remove());
}

  // --- CORRIGE ---

function solutionHTML(def, st){
  // UI-first: on rend offscreen puis on clique programmatique sur Solution
  if (typeof def.render === 'function' && (typeof def.solution === 'function' || typeof def.correct === 'function')) {
    try {
      const tmp = document.createElement('div');
      tmp.style.position = 'fixed';
      tmp.style.left = '-10000px';
      tmp.style.top = '-10000px';
      tmp.style.width = '0';
      tmp.style.height = '0';
      tmp.style.overflow = 'hidden';
      document.body.appendChild(tmp);

      def.render(tmp, st);
      if (typeof def.solution === 'function') {
        try { def.solution(tmp, st); } catch(e){ /* ignore */ }
      } else if (typeof def.correct === 'function') {
        try { def.correct(tmp, st); } catch(e){ /* ignore */ }
      }

      // Retirer inputs de réponse pour éviter artefacts
      tmp.querySelectorAll('input#reponse, input[name=reponse]').forEach(el=>el.remove());

      // Essayer d'extraire EXACTEMENT le bloc UI de solution
      let html = __pdf_extractUISolution(tmp);
      if(!html){
        // en dernier recours : conversion minimale puis nouvel essai
        staticizeForPrint(tmp);
        html = __pdf_extractUISolution(tmp) || tmp.innerHTML;
      }
      tmp.remove();
      if (html && html.trim()) return html;
    } catch (e) {
      console.warn('[exo-pdf-kit] UI-first solution failed', e);
    }
  }

  // Fallback sur la voie “auteur” si fournie
  if (typeof def.printSolutionHTML === 'function') return def.printSolutionHTML(st);

  // Dernier recours
  return '<div class="steps"><div class="step">Corrigé non disponible pour ce type.</div></div>';
}




  function buildControlsUI(opts){
    const wrap = document.createElement('div');
    wrap.className = 'card pdf-controls';
    wrap.innerHTML = `
      <div class="small" style="font-weight:600">Générer une fiche (PDF)</div>
      <div class="row-inline" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <label for="pdf-count">Nombre d’exercices (≤ ${opts.max}) :</label>
        <input id="pdf-count" type="number" min="1" max="${opts.max}" value="10">
        <label style="display:inline-flex;align-items:center;gap:6px">
          <input id="pdf-mix" type="checkbox" checked> mélanger
        </label>
        <label style="display:inline-flex;align-items:center;gap:6px">
          <input id="pdf-sol" type="checkbox"> avec corrigés
        </label>
        <button id="btn-pdf" class="btn">🖨️ Générer la fiche</button>
      </div>
      <div class="row-inline" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <input id="pdf-etab" type="text" placeholder="Établissement (optionnel)" style="min-width:220px">
        <input id="pdf-classe" type="text" placeholder="Classe (ex. 2nde A)" style="min-width:220px">
        <label style="display:inline-flex;align-items:center;gap:6px">
          <input id="pdf-blanks" type="checkbox" checked> afficher lignes Nom / Prénom / Date
        </label>
      </div>
      <div class="small" style="color:#555">Dans la boîte d’impression, décoche “En-têtes et pieds de page” pour ne pas afficher l’URL.</div>
    `;
    return wrap;
  }

  function buildPrintableHTML(nb, mix, withSolutions, header, opts){
    const today = new Date().toLocaleDateString('fr-FR');
    const title = opts.title || DEFAULTS.title;

    const __seen = new Set();

    let items = [];
    for(let i=1;i<=nb;i++){
      const def = pickDef(mix);
      if(!def) break;
      const st  = def.gen();
      const lead = (opts.leadByDefId && def.id && opts.leadByDefId[def.id]) || opts.lead || DEFAULTS.lead;
      const enonce = exerciseHTML(def, st);
      let block = `<div class="ex"><span class="n">${i}.</span> <span class="lead">${lead}</span> ${enonce}`;
      if(withSolutions){
        block += `<div class="solution"><div class="title">Corrigé</div>${solutionHTML(def, st)}</div>`;
      }
      block += `</div>`;
      items.push(block);
    }

    const safe = s => (s||"").toString().replace(/[<>]/g, '');
    return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>${title} — Fiche</title>
<style>
/* Tables des exercices (PDF) */
table{border-collapse:collapse}
/* Tableau Intervalles/Ensembles : plus compact et centré */
.table-exo{
  width:150mm;          /* ≈ 15 cm au lieu de 100% de la page */
  max-width:100%;
  margin:4mm auto;      /* centré */
  table-layout:fixed;   /* colonnes fixes, évite l'étirement */
}
.table-exo th, .table-exo td{
  border:1px solid #000;
  padding:3px 6px;      /* moins de marge interne */
  font-size:12px;       /* un peu plus petit pour la fiche */
  white-space:normal;   /* autorise les retours à la ligne si besoin */
}
/* Largeur raisonnable de la 1re colonne (les nombres) */
.table-exo th:first-child, .table-exo td:first-child{
  width:50mm;
  text-align:left;
}
/* Colonnes d’ensembles étroites et régulières */
.table-exo th:not(:first-child), .table-exo td:not(:first-child){
  width:16mm;
  text-align:center;
}
  @page{size:A4;margin:14mm}
  body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:0;color:#111}
  .wrap{padding:0 2mm}
  header{margin:0 0 8mm 0;padding:0 0 6mm 0;border-bottom:1px solid #ddd}
  header .top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}
  .h-left{display:flex;flex-direction:column;gap:2px}
  .h-etab{font-weight:700}
  .h-classe{color:#555;font-size:12px}
  .h-blanks{font-size:12px;color:#444;white-space:nowrap}
  .h-blanks .lbl{margin:0 6px 0 0}
  .h-blanks .line{display:inline-block;border-bottom:1px dotted #999;height:12px;vertical-align:baseline;margin:0 14px 0 6px}
  .h-blanks .line.lg{min-width:68mm}
  .h-blanks .line.sm{min-width:36mm}
  h1{font-size:18px;margin:6px 0 0 0}
  .meta{color:#666;font-size:12px;margin-top:2mm}

  .ex{margin:10px 0;page-break-inside:avoid}
  .ex .n{font-weight:700;margin-right:6px}
  .lead{font-weight:600;margin-right:6px}
  .solution{margin:6px 0 0 0;padding:6px 10px;background:#f9f9f9;border-left:3px solid #ddd}
  .solution .title{font-weight:700;font-size:13px;margin-bottom:4px}

  .steps{margin:.35rem 0 0 0;padding:.3rem .5rem;background:#fafafa;border:1px dashed #e3e3e3;border-radius:6px}
  .step{margin:.18rem 0;white-space:normal}
  .proof-table{display:grid;column-gap:12px;row-gap:0;margin-top:.3rem;white-space:normal}
  .proof-table .cell{align-self:start}
  .proof-table .ou{text-align:center;color:#555;white-space:nowrap;padding:.25rem .4rem}

  .frac{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1}
  .frac .num,.frac .den{padding:0 .20em;white-space:nowrap}
  .frac .bar{border-top:1.6px solid currentColor;align-self:stretch;margin:.06em 0}
  .frac-sign{margin-right:.15em}

  footer.print-footer{position:fixed;bottom:6mm;left:0;right:0;text-align:center;color:#777;font-size:11px}
</style>
</head>
<body>
  <footer class="print-footer">© MatHeron</footer>
  <div class="wrap">
    <header>
      <div class="top">
        <div class="h-left">
          <div class="h-etab">${safe(header.etab)}</div>
          <div class="h-classe">${safe(header.classe?('Classe : '+header.classe):'')}</div>
        </div>
        ${header.blanks? `
        <div class="h-blanks">
          <span class="lbl">Nom :</span><span class="line lg"></span>
          <span class="lbl">Prénom :</span><span class="line lg"></span>
          <span class="lbl">Date :</span><span class="line sm"></span>
        </div>` : ``}
      </div>
      <h1>${title} — Fiche d’exercices</h1>
      <div class="meta">Date : ${today} · NB d’exercices : ${nb} · ${mix?'Types mélangés':'Type sélectionné'}${withSolutions?' · corrigés inclus':''}</div>
    </header>
    ${items.join('')}
  </div>
</body></html>`;
  }

  function openPrint(nb, mix, withSolutions, header, opts){
    const html = buildPrintableHTML(nb, mix, withSolutions, header, opts);
    const blob = new Blob([html], {type:'text/html'});
    const url  = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if(!w){ alert("Le bloqueur de fenêtres empêche l’ouverture. Autorise temporairement les pop-ups pour générer le PDF."); return; }
    setTimeout(()=>{ try{ w.focus(); w.print(); } catch(e){} }, 350);
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
  }

  function mountUI(opts){
    const after = $(opts.mountAfterSelector) || $('.wrap');
    if(!after) return console.warn('[exo-pdf-kit] Zone de montage introuvable');
    const ui = buildControlsUI(opts);
    after.parentNode.insertBefore(ui, after.nextSibling);

    ui.querySelector('#btn-pdf').addEventListener('click', function(){
      const n = Math.max(1, Math.min(opts.max, parseInt((ui.querySelector('#pdf-count')||{}).value || '10', 10)));
      const mix = !!(ui.querySelector('#pdf-mix')||{}).checked;
      const withSol = !!(ui.querySelector('#pdf-sol')||{}).checked;
      const header = {
        etab: (ui.querySelector('#pdf-etab')||{}).value || '',
        classe: (ui.querySelector('#pdf-classe')||{}).value || '',
        blanks: !!(ui.querySelector('#pdf-blanks')||{}).checked
      };
      openPrint(n, mix, withSol, header, opts);
    });
  }

  
// === MatHeron PDF helpers (v4) ===
function __pdf_signatureFromHTML(html){
  try{
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    let t = (tmp.textContent || '').toString();
    t = t.replace(/\u2212/g, '-').replace(/[\u00A0\u202F\u2009\u200A\u2008\u2007]/g, ' ').replace(/\s+/g,' ').trim();
    t = t.replace(/(^|\n)\s*\d+[.)]\s*/g, '$1'); // retire 1., 2) en début de ligne
    return t;
  }catch(e){ return (html||'').toString(); }
}

// On veut le même rendu que quand on clique sur “Solution” : on extrait le bloc UI (#res/.steps)
function __pdf_extractUISolution(root){
  const sels = [
    '#res .steps',
    '#res',
    '.solution .steps',
    '.solution',
    '.corrige .steps',
    '.corrige',
    '.corrigé .steps',
    '.corrigé',
    '.correction .steps',
    '.correction',
    '.steps'
  ];
  for(const sel of sels){
    const n = root.querySelector(sel);
    if(n && (n.outerHTML || n.innerHTML)){
      const html = n.outerHTML || n.innerHTML;
      if(html && html.trim()) return html;
    }
  }
  return null;
}
window.ExoPDF = {
    init(userOpts){
      const opts = Object.assign({}, DEFAULTS, userOpts||{});
      // styles minimaux si jamais
      const style = document.createElement('style');
      style.textContent = `
        .pdf-controls{display:flex;flex-direction:column;gap:10px}
        .pdf-controls .small{font-size:.92rem;color:#666}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #dadada;background:#f7f7f7;border-radius:10px;cursor:pointer;white-space:nowrap}
        .btn:hover{background:#efefef}`;
      document.head.appendChild(style);

      if(document.readyState==='loading'){
        document.addEventListener('DOMContentLoaded', ()=>mountUI(opts));
      }else{
        mountUI(opts);
      }
    }
  };
})();
