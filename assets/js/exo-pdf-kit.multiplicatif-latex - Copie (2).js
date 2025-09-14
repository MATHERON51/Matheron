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

  // === CSS commun injecté dans TOUTES les fiches PDF ===
  // (bordures .tbl, carrés vides des inputs, espacement des lignes d’équations, marge des blocs MathJax…)
const PDF_BASE_CSS = `
  :root{
    --lh-exo: 2.20;     /* interligne des énoncés/corrigés */
    --gap-step: 10px;   /* espace entre lignes « step » */
    --gap-eq: 10px;     /* marge verticale des équations */
  }

  .tbl{border-collapse:collapse;border:1px solid #000}
  .tbl td,.tbl th{border:1px solid #000;padding:3px 6px;text-align:center}
  .pdf-blank{display:inline-block;width:90px;height:30px;}
  .tbl td:empty::before{content:"\\00a0";}

  /* Interlignes confortables (y compris quand les lignes viennent de <br>) */
  .ex, .solution, .steps{ line-height: var(--lh-exo); }
  .steps .step{ margin: var(--gap-step) 0; }

  /* Blocs d’équations et MathJax : marges verticales visibles */
  .equation{ line-height: var(--lh-exo); margin: var(--gap-eq) 0; }
  mjx-container[display="true"]{ margin: var(--gap-eq) 0; }

  /* Fractions HTML : inline-block pour que la ligne prenne sa vraie hauteur */
  .frac{ display:inline-block; vertical-align:middle; line-height:1; }
  .frac .num,.frac .den{ padding:0 .20em; white-space:nowrap; }
  .frac .bar{ border-top:1.6px solid currentColor; align-self:stretch; margin:.28em 0; }

  /* Numérotation 1) etc. : toujours séparée du texte/fraction qui suit */
  .qno{ display:inline-block; margin-right:.45em; }
  
  /* Espace latéral pour les maths inline (écran + PDF) */
mjx-container[jax="CHTML"][display="inline"]{
  margin-left: .22em;
  margin-right: .22em;
}

/* PDF : un peu d'air AVANT les maths inline uniquement */
mjx-container[jax="CHTML"][display="inline"]{ margin-left: .22em; margin-right: 0; }
.consigne mjx-container[jax="CHTML"][display="inline"],
.col-label mjx-container[jax="CHTML"][display="inline"]{ margin-left: .25em; margin-right: 0; }


`;


// Insère une fine espace insécable (NNBSP) autour des maths inline rendues par MathJax
function __pdf_padInlineMathNodes(root){
  const SPACE = '\u202F'; // fine NNBSP
  const isPunct = ch => /[.,;:!?)]/.test(ch || '');

  root.querySelectorAll('mjx-container').forEach(mjx => {
    // Inline si pas display="true"
    const disp = (mjx.getAttribute('display') || '').toLowerCase();
    const inline = disp !== 'true';
    if (!inline) return;

    // ----- espace AVANT -----
    let prev = mjx.previousSibling;
    let needBefore = true;
    if (prev) {
      if (prev.nodeType === 3) { // texte
        needBefore = !/\s$/.test(prev.textContent);
      } else if (prev.nodeType === 1) { // balise
        // si la balise précédente est ouvrante (ex. <strong>...), on met l'espace
        // sinon si c'est une ponctuation portée par un pseudo/texte -> on met aussi
        needBefore = true;
      }
    }
    if (needBefore) {
      mjx.parentNode.insertBefore(document.createTextNode(SPACE), mjx);
    }

    // ----- espace APRÈS (sauf si ponctuation suit immédiatement) -----
    let next = mjx.nextSibling;
    let needAfter = true;
    if (next) {
      if (next.nodeType === 3) {
        // texte : ne pas ajouter si premier caractère est ponctuation ou espace
        const s = next.textContent || '';
        needAfter = !(s.length && (/\s/.test(s[0]) || isPunct(s[0])));
      } else if (next.nodeType === 1) {
        // balise : on ajoute (le moteur d'impression collera sinon)
        needAfter = true;
      }
    }
    if (needAfter) {
      mjx.parentNode.insertBefore(document.createTextNode(SPACE), mjx.nextSibling);
    }
  });
}


  // --- PRE-RENDER MathJax (dans la page courante) ---
  async function __prerenderMathHTML(fragmentHTML){
    // Si MathJax n'est pas dispo, on renvoie tel quel.
    if (!(window.MathJax && MathJax.typesetPromise)) return fragmentHTML;
    const tmp = document.createElement('div');
    tmp.style.position = 'fixed';
    tmp.style.left = '-10000px';
    tmp.style.top = '-10000px';
    tmp.style.width = '0';
    tmp.style.height = '0';
    tmp.style.overflow = 'hidden';
    tmp.innerHTML = fragmentHTML;
    document.body.appendChild(tmp);
    try { await MathJax.typesetPromise([tmp]);    __pdf_padInlineMathNodes(tmp);  
} catch(e){}
    const out = tmp.innerHTML;
    tmp.remove();
    return out;
  }

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

  // --- util : nettoyage des aides pour le PDF (énoncé & corrigé) ---
  function stripSmallHints(html){
    if(!html) return '';
    let s = String(html);

    // 1) Supprimer <small>…</small> (+ le <br> éventuel juste avant)
    s = s.replace(/<br\s*\/?>\s*<small[\s\S]*?<\/small>/gi, '');
    s = s.replace(/<small[\s\S]*?<\/small>/gi, '');

    // 2) Normaliser les <em> entourant les mots-clés d'aide
    s = s.replace(/<em[^>]*>\s*(arrondi[\s\S]*?)<\/em>/gi, '$1');

    // 3) Supprimer les parenthèses contenant des indices d'aide
    const kw = '(?:arrondi|arrondir|%\\s*près|deux\\s+décimales|0,0+1\\s*%|0,01\\s*%|0,0001|entier\\s*\\(arrondi\\)|entier\\s*arrondi)';
    const reParenHints = new RegExp('\\s*\\((?:[^()]*'+kw+'[^()]*)\\)\\s*','gi');
    let prev;
    do { prev = s; s = s.replace(reParenHints, ' '); } while (s !== prev);

    return s;
  }
  function unwrapLegacyEqu(html){
    if(!html) return '';
    let s = String(html);
    // supprime uniquement les wrappers destinés aux formules
    s = s.replace(/<(?:code|span)\b[^>]*\bequ\b[^>]*>([\s\S]*?)<\/(?:code|span)>/gi, '$1');
    return s;
  }
  // Ajoute une fine espace insécable autour des maths inline <mjx-container display="inline">
// - avant si précédent char est une lettre/chiffre/fermeture de balise
// - après si le char suivant est une lettre/chiffre/une balise, mais pas une ponctuation
function padInlineMathSpaces(html){
  if(!html) return html;
  let s = String(html);

  // Espace AVANT: …X<mjx-container …>
  s = s.replace(
    /([^\s<(])(<mjx-container\b[^>]*\bdisplay="inline"[^>]*>)/g,
    '$1&#8239;$2'   // &#8239; = fine NNBSP
  );

  // Espace APRÈS: </mjx-container>Y… (sauf ponctuation)
  s = s.replace(
    /(<\/mjx-container>)(?=(?:\s*)(?:<|[^\s.,;:!?)]))/g,
    '$1&#8239;'
  );

  return s;
}

// Convertit les suites "ligne<br>ligne<br>..." en blocs .steps/.step
function blockifyLinesForPdf(html){
  if(!html) return '';
  let s = String(html);

  // Ne touche pas si on a déjà des blocs, des <p>, des listes ou des tableaux
  if (/\bclass\s*=\s*["']?steps["']?/i.test(s) || /<p\b/i.test(s) || /<li\b/i.test(s) || /<table\b/i.test(s)) {
    return s;
  }

  // Couper sur <br> ; ignorer blancs
  const parts = s.split(/<br\s*\/?>/i).map(x=>x.trim()).filter(Boolean);
  if (parts.length <= 1) return s;

  // Emballer en blocs
  return `<div class="steps">${parts.map(x=>`<div class="step">${x}</div>`).join('')}</div>`;
}

  // --- ENONCÉ : génération HTML standard (fallbacks) ---
  function exerciseHTML(def, st){
    if (typeof def.textHTML === 'function') return stripSmallHints(def.textHTML(st));
    if (typeof def.text === 'function')     return stripSmallHints(def.text(st));

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

        // 1) priorité : bloc spécial PDF
        const off = tmp.querySelector('.equ-offscreen');
        let html;
        if (off) {
          html = off.innerHTML || '';
        } else {
          // 2) figer l’UI et extraire l’énoncé
          staticizeForPrint(tmp);
          const block = tmp.querySelector('.statement') || tmp.querySelector('.equ') || tmp.querySelector('.hint') || null;
          html = block
            ? (block.classList.contains('statement') ? block.innerHTML : block.outerHTML)
            : tmp.innerHTML;
          // Supprimer "Exercice n :" éventuel
          html = html.replace(/<strong>\s*Exercice\s*\d+\s*:<\/strong>\s*/gi, '');
        }

        tmp.remove();
        // ⬇️ dé-wrapper + nettoyage
        return stripSmallHints( unwrapLegacyEqu(html && html.trim() ? html : 'Énoncé indisponible') );
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
if (html && html.trim()){
  const cleaned = stripSmallHints(html);
  return blockifyLinesForPdf(cleaned);   // <<< NEW
}
      } catch (e) {
        console.warn('[exo-pdf-kit] UI-first solution failed', e);
      }
    }

    if (typeof def.printSolutionHTML === 'function')
  return blockifyLinesForPdf( stripSmallHints(def.printSolutionHTML(st)) );  // <<< NEW

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

  async function buildPrintableHTML(nb, mix, withSolutions /* ignoré */, header, opts){
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
enonceHTML  = blockifyLinesForPdf(enonceHTML);

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
corrigeHTML = blockifyLinesForPdf(corrigeHTML);

      const lead = (opts.leadByDefId && def.id && opts.leadByDefId[def.id]) || opts.lead || DEFAULTS.lead;

      const blocEnonce = `<div class="ex"><span class="n">${i}.</span> ${lead && lead.trim() ? `<span class="lead">${lead}</span>` : ``} ${enonceHTML}</div>`;
      const blocCorrige = `<div class="ex"><span class="n">${i}.</span> ${lead && lead.trim() ? `<span class="lead">${lead}</span>` : ``} ${enonceHTML}
         <div class="solution"><div class="title">Corrigé</div>${corrigeHTML}</div>
      </div>`;
      // ⬇️ PRÉ-RENDU MATHJAX ICI
      enonces.push( padInlineMathSpaces(await __prerenderMathHTML(blocEnonce)) );

 corriges.push( padInlineMathSpaces(await __prerenderMathHTML(blocCorrige)) );

    }

    const safe = s => (s||"").toString().replace(/[<>]/g, '');
    return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>${title} — Fiche</title>

<!-- CSS de base pour toutes les fiches PDF -->
<style id="pdf-base-css">
${PDF_BASE_CSS}
</style>

<style>
.bar{display:none !important;background:transparent !important;border:none !important;height:0 !important;width:0 !important;padding:0 !important;margin:0 !important}
/* Tables des exercices (PDF) */
table{border-collapse:collapse}
/* Tableau Intervalles/Ensembles : plus compact et centré */
.table-exo{
  width:150mm;
  max-width:100%;
  margin:4mm auto;
  table-layout:fixed;
}
.table-exo th, .table-exo td{
  border:1px solid #000;
  padding:3px 6px;
  font-size:12px;
  white-space:normal;
}
.table-exo th:first-child, .table-exo td:first-child{ width:50mm; text-align:left; }
.table-exo th:not(:first-child), .table-exo td:not(:first-child){ width:16mm; text-align:center; }

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

.steps{margin:.35rem 0 0 0;padding:.3rem .5rem;background:#fafafa;border:1px dashed #e3e3e3;border-radius:6px;
  line-height: var(--lh-exo); /* NEW : interligne réel dans les steps */
}
.step{white-space:normal; margin: var(--gap-step) 0; /* NEW : espace clair entre lignes */ }

.proof-table{display:grid;column-gap:12px;row-gap:0;margin-top:.3rem;white-space:normal}
.proof-table .cell{align-self:start}
.proof-table .ou{text-align:center;color:#555;white-space:nowrap;padding:.25rem .4rem}

/* Fractions HTML dans le PDF (cohérent avec PDF_BASE_CSS) */
.frac{display:inline-block;vertical-align:middle;line-height:1}
.frac .num,.frac .den{padding:0 .20em;white-space:nowrap}
.frac .neverbar{border-top:1.6px solid currentColor;align-self:stretch;margin:.22em 0}

/* Visibilité des formules */
.equ, .equ *{visibility:visible !important; color:inherit !important}
code.equ{visibility:visible !important; color:inherit !important}

.frac-sign{margin-right:.15em}

footer.print-footer{position:fixed;bottom:6mm;left:0;right:0;text-align:center;color:#777;font-size:11px}
/* Saut de page garanti entre Énoncés et Corrigés */
.pagebreak{break-before:page; page-break-before:always;}

footer.print-footer{position:fixed;bottom:6mm;left:0;right:0;text-align:center;color:#777;font-size:11px}

/* Fractions HTML dans le PDF — ne pas compresser les lignes */
.frac{display:inline-block !important; vertical-align:middle; line-height:1 !important}
.frac .num,.frac .den{padding:0 .20em; white-space:nowrap}
.frac .bar{border-top:1.6px solid currentColor; margin:.28em 0}
/* si certains exos utilisaient .neverbar, on l’affiche proprement aussi */
.frac .neverbar{border-top:1.6px solid currentColor; margin:.28em 0}

/* Visibilité des formules */
.equ, .equ *{visibility:visible !important; color:inherit !important}
code.equ{visibility:visible !important; color:inherit !important}
/* Plus d’air dans le corrigé uniquement */
:root{
  --lh-exo: 2.20;      /* déjà défini en haut via PDF_BASE_CSS */
}
.solution{ --lh-exo: 2.35; }             /* ← interligne plus grand dans .solution */
.solution .steps .step{ margin: 12px 0; } /* ← espace entre lignes du corrigé */
/* Espace latéral pour les maths inline (écran + PDF) */
mjx-container[jax="CHTML"][display="inline"]{
  margin-left: .22em;
  margin-right: .22em;
}

/* PDF : un peu d'air AVANT les maths inline uniquement */
mjx-container[jax="CHTML"][display="inline"]{ margin-left: .22em; margin-right: 0; }
.consigne mjx-container[jax="CHTML"][display="inline"],
.col-label mjx-container[jax="CHTML"][display="inline"]{ margin-left: .25em; margin-right: 0; }


</style>

<style>
  /* Un socle stable pour la mesure */
  html, body { font-size: 16px; }
  mjx-container { page-break-inside: avoid; }
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

  async function openPrint(nb, mix, withSolutions, header, opts){
    const html = await buildPrintableHTML(nb, mix, withSolutions, header, opts);
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

    ui.querySelector('#btn-pdf').addEventListener('click', async function(){
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
      await openPrint(n, mix, /*withSolutions*/ false, header, runOpts);
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
