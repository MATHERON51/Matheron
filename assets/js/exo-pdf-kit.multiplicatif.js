/*! exo-pdf-kit.js — Générateur de fiches PDF réutilisable (v4.2, patch rétro-compatible)
   Changements majeurs (option 3) :
   - Préférence .equ-offscreen pour l’énoncé (évite la double consigne)
   - Suppression des <small>…</small> dans le HTML PDF (énoncé & solution)
   - Style .tbl (bordures noires) injecté dans le PDF
   - staticizeForPrint : n’imprime plus les placeholders des inputs
*/
(function(){
  // … en haut du fichier, dans DEFAULTS :
const DEFAULTS = {
  title: document.title.replace(/\s+–.+$/,'').trim() || 'Fiche d’exercices',
  lead: '',
  max: 50,
  mountAfterSelector: '.controls.card',
  leadByDefId: null,
  beforeGen: null,
  beforeRender: null,
  autoPrint: false      // ⟵ NOUVEAU : pas d’impression auto
};


  function $(sel, r=document){ return r.querySelector(sel); }

  function pickDef(mix, allowIds){
  const REG = (window.REGISTRY && Array.isArray(window.REGISTRY)) ? window.REGISTRY : [];
  if(!REG.length){
    console.warn('[exo-pdf-kit] REGISTRY introuvable'); return null;
  }
  if(mix){
    let pool = REG;
    if (Array.isArray(allowIds) && allowIds.length){
      const set = new Set(allowIds);
      pool = REG.filter(d => set.has(d.id));
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const sel = $('#exo-select');
  return REG.find(e => e.id === (sel? sel.value : null)) || REG[0];
}


  // --- util : nettoyage des aides pour le PDF ---
  // --- util : nettoyage des aides pour le PDF (énoncé & corrigé) ---
function stripSmallHints(html){
  if(!html) return '';
  let s = String(html);

  // 1) Supprimer <small>…</small> (+ le <br> éventuel juste avant)
  s = s.replace(/<br\s*\/?>\s*<small[\s\S]*?<\/small>/gi, '');
  s = s.replace(/<small[\s\S]*?<\/small>/gi, '');

  // 2) Normaliser les <em> entourant les mots-clés d'aide (ex. <em>arrondir au % près</em>)
  //    → on garde le texte, on enlève juste le balisage <em>...> ... </em> pour ces cas
  s = s.replace(/<em[^>]*>\s*(arrondi[\s\S]*?)<\/em>/gi, '$1');

  // 3) Supprimer les parenthèses qui contiennent des indices d'aide (arrondi, % près, deux décimales, etc.)
  //    On boucle jusqu'à ce qu'il n'y ait plus de match (plusieurs aides dans la même ligne)
  const kw = '(?:arrondi|arrondir|%\\s*près|deux\\s+décimales|0,0+1\\s*%|0,01\\s*%|0,0001|entier\\s*\\(arrondi\\)|entier\\s*arrondi)';
  const reParenHints = new RegExp('\\s*\\((?:[^()]*'+kw+'[^()]*)\\)\\s*','gi');
  let prev;
  do { prev = s; s = s.replace(reParenHints, ' '); } while (s !== prev);

  return s;
}


  // --- ENONCÉ : génération HTML standard (fallbacks) ---
  function exerciseHTML(def, st){
    if (typeof def.textHTML === 'function') return stripSmallHints(def.textHTML(st));
    if (typeof def.text === 'function')     return stripSmallHints(def.text(st));

    // Fallback UI : on rend offscreen, on préfère .equ-offscreen si présent.
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

        // 1) priorité : contenu spécialement prévu pour le PDF
        const off = tmp.querySelector('.equ-offscreen');
        if (off) {
          const html = off.innerHTML || '';
          tmp.remove();
          return stripSmallHints(html) || 'Énoncé indisponible';
        }

        // 2) pages anciennes : on fige l’UI (et on ne garde pas les placeholders)
        staticizeForPrint(tmp);
        const equ = tmp.querySelector('.equ') || tmp.querySelector('.hint') || null;
        const html = equ ? equ.outerHTML : tmp.innerHTML;

        tmp.remove();
        return stripSmallHints(html && html.trim() ? html : 'Énoncé indisponible');
      } catch (e) {
        console.warn('[exo-pdf-kit] fallback render failed', e);
      }
    }
    return 'Énoncé indisponible';
  }

  // Figer l’UI pour impression (pages sans .equ-offscreen)
  function staticizeForPrint(root){
    // <select>
    root.querySelectorAll('select').forEach(sel=>{
      const txt = sel.options[sel.selectedIndex]?.text || sel.value || '';
      const span = document.createElement('span');
      span.className = 'sol-sel';
      span.textContent = txt;
      sel.replaceWith(span);
    });
    // Checkbox / radio
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
    // Inputs texte/nombre — IMPORTANT : ne PAS imprimer les placeholders
    root.querySelectorAll('input[type=text], input[type=number]').forEach(inp=>{
      const span = document.createElement('span');
      span.className = 'sol-text';
      span.textContent = inp.value || ''; // (plus de placeholder en PDF)
      inp.replaceWith(span);
    });
    // Boutons
    root.querySelectorAll('button').forEach(b=>b.remove());
  }

  // --- SOLUTION : même logique que l’UI (fallbacks)
  function solutionHTML(def, st){
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

        // Retirer inputs utilisés par la page pour éviter artefacts
        tmp.querySelectorAll('input#reponse, input[name=reponse]').forEach(el=>el.remove());

        let html = __pdf_extractUISolution(tmp);
        if(!html){
          staticizeForPrint(tmp);
          html = __pdf_extractUISolution(tmp) || tmp.innerHTML;
        }
        tmp.remove();
        if (html && html.trim()) return stripSmallHints(html);
      } catch (e) {
        console.warn('[exo-pdf-kit] UI-first solution failed', e);
      }
    }

    if (typeof def.printSolutionHTML === 'function')
      return stripSmallHints(def.printSolutionHTML(st));

    return '<div class="steps"><div class="step">Corrigé non disponible pour ce type.</div></div>';
  }

  function buildControlsUI(opts){
  const wrap = document.createElement('div');
  wrap.className = 'card pdf-controls';
  const REG = (window.REGISTRY && Array.isArray(window.REGISTRY)) ? window.REGISTRY : [];
  wrap.innerHTML = `
    <div class="small" style="font-weight:600">Générer une fiche</div>
    <div class="row-inline" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <label for="pdf-count">Nombre d’exercices (≤ ${opts.max}) :</label>
      <input id="pdf-count" type="number" min="1" max="${opts.max}" value="10">
      <label style="display:inline-flex;align-items:center;gap:6px">
        <input id="pdf-mix" type="checkbox" checked> mélanger
      </label>
      <button id="btn-pdf" class="btn">🗂️ Générer la fiche</button>
    </div>

    <!-- Choix des types quand "mélanger" est coché -->
    <div id="mix-chooser" class="card small" style="margin-top:8px; padding:10px; border:1px dashed #ddd">
      <div style="margin-bottom:6px"><strong>Inclure ces types :</strong></div>
      <div class="mix-grid" style="display:flex;flex-wrap:wrap;gap:8px">
        ${REG.map(d=>`
          <label class="chip" style="display:inline-flex;align-items:center;gap:6px;border:1px solid #ddd;border-radius:999px;padding:4px 10px">
            <input class="mix-id" type="checkbox" value="${d.id}" checked> ${d.title}
          </label>`).join('')}
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn" id="mix-all">Tout cocher</button>
        <button type="button" class="btn" id="mix-none">Tout décocher</button>
      </div>
    </div>

    <div class="row-inline" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <input id="pdf-etab" type="text" placeholder="Nom de l’établissement" style="min-width:240px">
      <input id="pdf-classe" type="text" placeholder="Classe (ex. 2nde A)" style="min-width:220px">
      <label style="display:inline-flex;align-items:center;gap:6px">
        <input id="pdf-blanks" type="checkbox" checked> afficher lignes Nom / Prénom / Date
      </label>
    </div>
    <div class="small" style="color:#555">Astuce : dans la boîte d’impression, décoche « En-têtes et pieds de page » pour ne pas afficher l’URL.</div>
  `;

  // interactions "tout cocher/décocher"
  wrap.querySelector('#mix-all')?.addEventListener('click', ()=>{
    wrap.querySelectorAll('.mix-id').forEach(ch=>ch.checked=true);
  });
  wrap.querySelector('#mix-none')?.addEventListener('click', ()=>{
    wrap.querySelectorAll('.mix-id').forEach(ch=>ch.checked=false);
  });

  // masque/affiche le sélecteur selon la case "mélanger"
  const mixBox = wrap.querySelector('#pdf-mix');
  const chooser = wrap.querySelector('#mix-chooser');
  function syncChooser(){ chooser.hidden = !mixBox.checked; }
  mixBox.addEventListener('change', syncChooser);
  syncChooser();

  return wrap;
}


function buildPrintableHTML(nb, mix, withSolutions /* ignoré */, header, opts){
  const today = new Date().toLocaleDateString('fr-FR');
  const title = opts.title || DEFAULTS.title;

  // anti-doublon local
  const SEEN = new Set();
  const keyOf = (def, st) => JSON.stringify({
    id: def.id || def.title || '?',
    kind: st?.kind ?? null, type: st?.type ?? null,
    n: ('n' in (st||{}) ? st.n : null),
    params: st?.params || {}
  });

  const enonces = [];
  const corriges = [];

  for (let i=1; i<=nb; i++) {
    const def = pickDef(mix, opts && Array.isArray(opts.allowIds) ? opts.allowIds : null);
    if(!def) break;

    // état généré non dupliqué
    let st = {};
    let tries = 0, sig = '';
    do {
      st = (typeof def.gen === 'function') ? def.gen(null) : {};
      sig = keyOf(def, st);
      tries++;
    } while (SEEN.has(sig) && tries < 30);
    SEEN.add(sig);

    if (typeof opts.beforeGen === 'function') {
      try { st = opts.beforeGen(def, st, {index:i,total:nb,withSolutions:false}) || st; }
      catch(e){ console.warn('[exo-pdf-kit] beforeGen() a échoué:', e); }
    }

    // ÉNONCÉ
    let enonceHTML = null;
    if (typeof opts.beforeRender === 'function') {
      try {
        const out = opts.beforeRender(def, st, false);
        if (typeof out === 'string') enonceHTML = out;
        else if (out && typeof out.statement === 'string') enonceHTML = out.statement;
      } catch(e){ console.warn('[exo-pdf-kit] beforeRender(statement) a échoué:', e); }
    }
    if (!enonceHTML) enonceHTML = exerciseHTML(def, st);

    // SOLUTION
    let corrigeHTML = null;
    if (typeof opts.beforeRender === 'function') {
      try {
        const out = opts.beforeRender(def, st, true);
        if (typeof out === 'string') corrigeHTML = out;
        else if (out && typeof out.solution === 'string') corrigeHTML = out.solution;
      } catch(e){ console.warn('[exo-pdf-kit] beforeRender(solution) a échoué:', e); }
    }
    if (!corrigeHTML) corrigeHTML = solutionHTML(def, st);

    const lead = (opts.leadByDefId && def.id && opts.leadByDefId[def.id]) || opts.lead || DEFAULTS.lead;

    enonces.push(
      `<div class="ex"><span class="n">${i}.</span> ${lead && lead.trim() ? `<span class="lead">${lead}</span>` : ``} ${enonceHTML}</div>`
    );

    corriges.push(
  `<div class="ex">
     <span class="n">${i}.</span>
     ${lead && lead.trim() ? `<span class="lead">${lead}</span>` : ``}
     ${enonceHTML}
     <div class="solution"><div class="title">Corrigé</div>${corrigeHTML}</div>
   </div>`
);

  }

  const safe = s => (s||"").toString().replace(/[<>]/g, '');
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>${title} — Fiche</title>
<style>
/* Tables & bordures noires conservées */
table{border-collapse:collapse}
.tbl{border-collapse:collapse;border:1px solid #000}
.tbl td,.tbl th{border:1px solid #000;padding:3px 6px;text-align:center}

/* Mise en page */
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

.section-title{font-weight:800;margin:8mm 0 3mm;font-size:14px}
.ex{margin:10px 0;page-break-inside:avoid}
.ex .n{font-weight:700;margin-right:6px}
.lead{font-weight:600;margin-right:6px}
.solution{margin:6px 0 0 0;padding:6px 10px;background:#f9f9f9;border-left:3px solid #ddd}
.solution .title{font-weight:700;font-size:13px;margin-bottom:4px}

/* Saut de page garanti entre Énoncés et Corrigés */
.pagebreak{break-before:page; page-break-before:always;}

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
      <div class="meta">Date : ${today} · NB d’exercices : ${enonces.length} · ${mix?'Types mélangés':'Type sélectionné'} · corrigés en fin de fiche</div>
    </header>

    <div class="section-title">Énoncés</div>
    ${enonces.join('')}

    <div class="pagebreak"></div>

    <div class="section-title">Corrigés</div>
    ${corriges.join('')}
  </div>
</body></html>`;
}



  function openPrint(nb, mix, withSolutions, header, opts){
  const html = buildPrintableHTML(nb, mix, withSolutions, header, opts);
  const blob = new Blob([html], {type:'text/html'});
  const url  = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if(!w){
    alert("Le bloqueur de fenêtres empêche l’ouverture. Autorise temporairement les pop-ups pour générer la fiche.");
    return;
  }
  // Impression automatique désactivée par défaut
  if (opts.autoPrint) {
    setTimeout(()=>{ try{ w.focus(); w.print(); } catch(e){} }, 350);
  }
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
    const header = {
      etab: (ui.querySelector('#pdf-etab')||{}).value || '',
      classe: (ui.querySelector('#pdf-classe')||{}).value || '',
      blanks: !!(ui.querySelector('#pdf-blanks')||{}).checked
    };
    // ids sélectionnés si "mélanger"
    const ids = Array.from(ui.querySelectorAll('.mix-id:checked')).map(x=>x.value);
    if (mix && ids.length===0){ alert('Sélectionnez au moins un type d’exercice.'); return; }
    const runOpts = Object.assign({}, opts, { allowIds: mix ? ids : null });

    // withSolutions devient inutile : toujours "annexes"
    openPrint(n, mix, /*withSolutions*/ false, header, runOpts);
  });
}


  // ==== Utilitaires internes pour l’extraction de la solution (inchangés)
  function __pdf_signatureFromHTML(html){
    try{
      const tmp = document.createElement('div');
      tmp.innerHTML = html || '';
      let t = (tmp.textContent || '').toString();
      t = t.replace(/\u2212/g, '-').replace(/[\u00A0\u202F\u2009\u200A\u2008\u2007]/g, ' ').replace(/\s+/g,' ').trim();
      t = t.replace(/(^|\n)\s*\d+[.)]\s*/g, '$1');
      return t;
    }catch(e){ return (html||'').toString(); }
  }
  function __pdf_extractUISolution(root){
    const sels = [
      '#res .steps','#res',
      '.solution .steps','.solution',
      '.corrige .steps','.corrige',
      '.corrigé .steps','.corrigé',
      '.correction .steps','.correction',
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

  // ==== API publique ====
  window.ExoPDF = {
    init(userOpts){
      const opts = Object.assign({}, DEFAULTS, userOpts||{});
      // Styles min
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

/* ==== CLONE COURBE POUR PDF — compact & lisible (identique) ==== */
function cloneCurveForPDF(root, opts={}){
  const svg = root.querySelector('svg');
  if(!svg) return '';
  const c = svg.cloneNode(true);

  const W = opts.widthPx || 340;
  const H = opts.heightPx || 240;
  c.setAttribute('width',  W);
  c.setAttribute('height', H);

  if(!c.getAttribute('viewBox')){
    const vb = svg.viewBox && svg.viewBox.baseVal
      ? svg.viewBox.baseVal
      : {x:0,y:0,width:(svg.width?.baseVal?.value||800),height:(svg.height?.baseVal?.value||600)};
    c.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
  }
  c.setAttribute('preserveAspectRatio','xMidYMid meet');

  c.querySelectorAll('.grid line').forEach(el=>{
    el.setAttribute('stroke-width', String(Math.min(0.4, +(el.getAttribute('stroke-width')||1)*0.5)));
  });
  c.querySelectorAll('.axis line, .axis path').forEach(el=>{
    el.setAttribute('stroke-width', String(Math.min(0.8, +(el.getAttribute('stroke-width')||1.5)*0.7)));
  });
  c.querySelectorAll('path, polyline').forEach(el=>{
    el.setAttribute('stroke-width', String(Math.max(0.9, +(el.getAttribute('stroke-width')||2)*0.7)));
  });
  c.querySelectorAll('text').forEach(t=>{
    const fs = parseFloat(t.getAttribute('font-size')||'12');
    t.setAttribute('font-size', (fs*0.9).toFixed(1));
  });

  const wrap = document.createElement('div');
  wrap.style.display = 'block';
  wrap.style.width   = opts.blockWidth || '85%';
  wrap.style.margin  = '6px 0 10px';
  wrap.appendChild(c);
  return wrap.outerHTML;
}
