/*! exo-pdf-kit.js — Générateur de fiches PDF réutilisable (v4.2, patch rétro-compatible)
   Changements majeurs (option 3) :
   - Préférence .equ-offscreen pour l’énoncé (évite la double consigne)
   - Suppression des <small>…</small> dans le HTML PDF (énoncé & solution)
   - Style .tbl (bordures noires) injecté dans le PDF
   - staticizeForPrint : n’imprime plus les placeholders des inputs
*/
(function(){
  // … en haut du fichier, dans DEFAULTS :
// vers le début (DEFAULTS)
const DEFAULTS = {
  title: document.title.replace(/\s+–.+$/,'').trim() || 'Fiche d’exercices',
  lead: '',
  max: 50,
  mountAfterSelector: '.card.small',
  leadByDefId: null,
  beforeGen: null,
  beforeRender: null,
  hideStatementInCorrige: false   // ← NOUVEAU
};


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
  try { await MathJax.typesetPromise([tmp]); } catch(e){}
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
function unwrapLegacyEqu(html){
  if(!html) return '';
  let s = String(html);
  // supprime uniquement les wrappers destinés aux formules
  s = s.replace(/<(?:code|span)\b[^>]*\bequ\b[^>]*>([\s\S]*?)<\/(?:code|span)>/gi, '$1');
  return s;
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
        if (html && html.trim()) return stripSmallHints(html);
      } catch (e) {
        console.warn('[exo-pdf-kit] UI-first solution failed', e);
      }
    }

    if (typeof def.printSolutionHTML === 'function')
      return stripSmallHints(def.printSolutionHTML(st));
// if (html && html.trim()) return stripSmallHints( unwrapLegacyEqu(html) );// 

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

const blocEnonce = `<div class="ex"><span class="n">${i}.</span> ${lead && lead.trim() ? `<span class="lead">${lead}</span>` : ``} ${enonceHTML}</div>`;
const blocCorrige = `<div class="ex"><span class="n">${i}.</span>${lead.trim() ? `<span class="lead">${lead}</span>` : ``} ${opts.hideStatementInCorrige ? '' : enonceHTML}
  <div class="solution"><div class="title">Corrigé</div>${corrigeHTML}</div>
</div>`;

    // ⬇️ PRÉ-RENDU MATHJAX ICI
    enonces.push( await __prerenderMathHTML(blocEnonce) );
    corriges.push( await __prerenderMathHTML(blocCorrige) );

  }

  const safe = s => (s||"").toString().replace(/[<>]/g, '');
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>${title} — Fiche</title>
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

.steps{margin:.35rem 0 0 0;padding:.3rem .5rem;background:#fafafa;border:1px dashed #e3e3e3;border-radius:6px}
.step{margin:.18rem 0;white-space:normal}
.proof-table{display:grid;column-gap:12px;row-gap:0;margin-top:.3rem;white-space:normal}
.proof-table .cell{align-self:start}
.proof-table .ou{text-align:center;color:#555;white-space:nowrap;padding:.25rem .4rem}

.frac{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1}
.frac .num,.frac .den{padding:0 .20em;white-space:nowrap}
.frac .neverbar{border-top:1.6px solid currentColor;align-self:stretch;margin:.06em 0}
.frac-sign{margin-right:.15em}

footer.print-footer{position:fixed;bottom:6mm;left:0;right:0;text-align:center;color:#777;font-size:11px}
/* Saut de page garanti entre Énoncés et Corrigés */
.pagebreak{break-before:page; page-break-before:always;}

footer.print-footer{position:fixed;bottom:6mm;left:0;right:0;text-align:center;color:#777;font-size:11px}

/* === Patch anti-barres & visibilité formules (print only) === */
.frac{display:inline !important; line-height:1}
.frac .neverbar{display:none !important}
.frac .num::after{content:'/'; padding:0 .15em}
/* Assurer que tout le contenu des formules est visible et hérite de la couleur */
.equ, .equ *{visibility:visible !important; color:inherit !important}
code.equ{visibility:visible !important; color:inherit !important}
/* === Bordures opt-in pour certains tableaux (PDF uniquement) === */
table.pdfb{ border-collapse: collapse; }
table.pdfb, table.pdfb th, table.pdfb td{
  border: 1px solid #000;
  padding: 4px 6px;
  vertical-align: top;
}
/* Tableaux "plein largeur" pour le PDF, uniquement si .pdfb est présente */
table.pdfb{
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;          /* répartit la largeur sur toute la page */
}
table.pdfb, table.pdfb th, table.pdfb td{
  border: 1px solid #000;
  padding: 6px 8px;
  vertical-align: top;
  white-space: normal;          /* pour que le contenu aille à la ligne */
  word-break: break-word;
}
/* PDF : même respiration pour la colonne 3 des tableaux de corrigé */
table.pdfb.corrige td:nth-child(3),
table.pdfb.corrige th:nth-child(3){
  padding-left: 12px;
  padding-right: 12px;
}
/* Tableau 2 colonnes pour c / t */
.eq-tab{ border-collapse:collapse; border:none; }
.eq-tab td{ border:none; padding:.12rem .4rem; vertical-align:baseline; }
.eq-tab .col-bullet{ width:1.6em; }

/* Grosse puce ronde */
.eq-tab .dot{
  display:inline-block;
  width:.50em; height:.50em;      /* ← taille de la puce */
  border-radius:50%;
  background:currentColor;
  vertical-align:middle;
  transform: translateY(.06em);   /* ajustement fin d’alignement */
}

/* aucune bordure même à l'impression */
@media print{
  .eq-tab, .eq-tab td{ border:none !important; }
}
/* Grille façon tableur avec indices de lignes/colonnes */
table.sheet{border-collapse:collapse;font-size:.95rem}
.sheet th,.sheet td{border:1px solid #cfd6e4;padding:.25rem .55rem;min-width:46px;text-align:center}
.sheet thead th{background:#f2f5fb;font-weight:700}
.sheet .corner{background:#eef2f9;width:34px;min-width:34px}
.sheet .rhead{background:#f7f8fb;font-weight:600;width:34px}
.sheet .colA{background:#fafafa;font-weight:600}

/* === Bordures pour nos tableaux « écran » quand ils sont imprimés par le kit === */

/* tables classiques (ta classe .table) : bordures noires partout */
table.table{
  border-collapse: collapse;
  width: 100%;
}
table.table th, table.table td{
  border: 1px solid #000;
  padding: 4px 6px;
  vertical-align: top;
}
table.table th{ background:#f3f3f6 }

  /* Variation table */
  .var-wrap{display:flex;justify-content:center}
  table.var{width:max-content;border-collapse:separate;border-spacing:0;margin:.35rem auto}
/* 1) 1ʳᵉ ligne moins haute + padding horizontal raisonnable */
table.var thead th,
table.var thead td{
  padding: 12px 16px !important;    /* plus 80px */
}

/* 2) Coller -∞ à gauche et +∞ à droite */
table.var thead td.cap-left{
  text-align: left;
  padding-left: 0 !important;       /* bord gauche collé */
}
table.var thead td.cap-right{
  text-align: right;
  padding-right: 0 !important;      /* bord droit collé */
}

  table.var th, table.var td{padding:20px 30px;border:1.5px solid #000}
  table.var th{background:#f3f3f6}
  table.var .bigsel select{font-size:28px;line-height:1;height:2.1em}
  table.var .bigsel{padding:0 4px}
  table.var input[type="text"]{width:110px;text-align:center}
  table.var tr > td:nth-child(2), table.var tr > th:nth-child(2){ border-right:none; }
  table.var tr > td:nth-child(3), table.var tr > th:nth-child(3){ border-left:none; border-right:none; }
  table.var tr > td:nth-child(4), table.var tr > th:nth-child(4){ border-left:none; }
  table.var tbody tr:first-child td:nth-child(3){ border-bottom:none; }
  table.var .thin td{ border-top:none; border-left:none; border-right:none; padding-top:2px; }
  table.var .gaprow td{ border:none !important; height:8px; padding:0; }
table.var .cap-left{ text-align:left; padding-left:8px; }
table.var .cap-right{ text-align:right; padding-right:8px; }
/* 1) Taille générale du texte dans le tableau */
table.var{
  font-size: 20px;                 /* ← grossit tout le texte “normal” (x, f, flèches, etc.) */
}

/* 2) Rendre plus gros le rendu MathJax (−∞, +∞, x, f en LaTeX) */
table.var .mjx-chtml{
  font-size: 1.25em !important;    /* 1.2–1.35 selon ton goût */
}

/* 3) Champs (inputs + sélecteurs de flèches) */
table.var input[type="text"]{
  width: 100px;
  font-size: 20px;                 /* valeur cohérente avec le tableau */
  text-align: center;
}
table.var .bigsel select{
  font-size: 32px;                 /* flèches bien visibles */
  line-height: 1;
  height: 2.2em;
}
/* 1ʳᵉ colonne plus étroite + padding réduit (override) */
table.var tr > *:first-child{
  width: 50px !important;          /* ajuste 60–90 selon ton goût */
  padding: 12px 14px !important;   /* au lieu de 50px 80px */
  white-space: nowrap;             /* évite le retour à la ligne sur "f" ou "x" */
}

/* Écran + PDF */
table.var input, table.var select,
.sign-table input, .sign-table select{
  display: none !important;
}

/* base */
table.pdf-tbl{
  border-collapse: separate;
  border-spacing: 0;
  border: none;
  margin: .4rem 0;
  position: relative; /* pour le pseudo-élément cadre */
}
table.pdf-tbl th, table.pdf-tbl td{
  border: none;
  padding: 4px 6px;
  text-align: center;
  vertical-align: middle;
}
table.pdf-tbl th{ background:#f3f3f6 }

/* === Cadre extérieur, une seule fois pour toute la table === */
table.pdf-tbl::before{
  content:"";
  position:absolute; inset:0;
  border:1.5px solid #000;
  pointer-events:none;   /* ne gêne pas les interactions */
}

/* === Séparateur vertical après la 1ʳᵉ colonne === */
table.pdf-tbl thead tr > *:first-child,
table.pdf-tbl tbody tr > *:first-child{
  border-right: 1.5px solid #000;
}

/* Ne PAS tracer ce séparateur sur les lignes “techniques” */
table.pdf-tbl tbody tr.thin > *:first-child,
table.pdf-tbl tbody tr.gaprow > *:first-child{
  border-right: none !important;
}
table.pdf-tbl thead tr > *{
  border-bottom: 1.5px solid #000; /* séparation x / f(x) */
}
.sign-table{
  width:50%;
  border:2px solid #000;
  border-collapse:separate;
  border-spacing:0;
  table-layout:fixed;
  --zeroW: 110px;
   margin: 0 auto;              /* ← centre le tableau */
}
.sign-table col.col-lbl{ width: 96px; }
.sign-table col.col-zero{ width: var(--zeroW); }
.sign-table col.col-int{ width:auto; }

.sign-table th, .sign-table td{
  padding:8px 6px; text-align:center; vertical-align:middle;
  border-top:1px solid #000;
  border-bottom:1px solid #000;
  border-right:none; border-left:none;
}

.sign-table .lbl{
  font-weight:600;
  border-right:2px solid #000;
  white-space:nowrap;
}

.sign-table td.int{ border-left:0 !important; border-right:0 !important; }
.sign-table td.zero{ border-left:0 !important; border-right:0 !important; }
.sign-table .cap-left{ text-align:left; padding-left:8px; }
.sign-table .cap-right{ text-align:right; padding-right:8px; }

.sign-table .sel, .sign-table .root{
    width: var(--zeroW);
    height: 34px;
    line-height: 1.2;
    font-size: 16px;
    padding: 6px 8px;
    border:1px solid #cbd5e1; border-radius:8px;
    text-align:center; box-sizing:border-box;
    margin:0 auto; display:block; background:#fff;
  }
.sign-table .sel{
  -webkit-appearance:none; -moz-appearance:none; appearance:none;
  text-align-last:center;
}

.sign-table{ font-size:1.15rem; }
.sign-table th, .sign-table td{
  padding:10px 14px;
}
.sign-table .cell{ width:84px; height:44px; font-size:1.12rem; }
.sign-table .sel{ height:40px; min-width:84px; text-align-last:center; }
.sign-table .root{ min-width:110px; height:40px; font-size:1.12rem; }

  @media print{ .controls{display:none !important;} }

.sign-table .cell-inline{ display:inline-flex; align-items:center; justify-content:center; gap:6px; }

/* Demi-taille pour le tableau de signes */
.sign-table.half{
  font-size:.575rem;           /* 1.15 / 2 */
  --zeroW:55px;                /* 110 / 2 */
}
.sign-table.half th,
.sign-table.half td{ padding:5px 7px; }      /* 10–14 -> ~5–7 */
.sign-table.half .cell{ width:42px; height:22px; font-size:.56rem; } /* 84x44 -> moitié */
.sign-table.half .sel{ height:20px; min-width:42px; }
.sign-table.half .root{ min-width:55px; height:22px; font-size:.56rem; }
/* Extrémités de la ligne f(x) : gauche -> droite ; droite -> gauche */


/* Si tu utilises .half ou .pdf-large, on réaffirme pareil */
.sign-table.half tbody tr:nth-child(2) td.int:first-of-type{ text-align:right !important; }
.sign-table.half tbody tr:nth-child(2) td.int:last-of-type { text-align:left  !important; }
.pdf-large.sign-table tbody tr:nth-child(2) td.int:first-of-type{ text-align:right !important; }
.pdf-large.sign-table tbody tr:nth-child(2) td.int:last-of-type { text-align:left  !important; }

@media print {
  .equ-offscreen{
    position: static !important;
    left: 0 !important;
    top: 0 !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
    visibility: visible !important;
    display: block !important;
  }
}
@media print {
  .pdf-half{
    width:50% !important;
    display:inline-block !important;
    vertical-align:top !important;
  }
  .pdf-half .sign-table{
    width:100% !important;   /* le tableau remplit son wrapper à 50% */
  }
}
/* base */
table.pdf-tbl-var{
  border-collapse: separate;
  border-spacing: 0;
  border: none;
  margin: .6rem 0;                 /* un peu plus d’air */
  position: relative;              /* pour le pseudo-cadre */
  font-size: 50px;                 /* ← agrandit TOUT le tableau */
}
table.pdf-tbl-var th, table.pdf-tbl td{
  border: none;
  padding: 10px 14px;              /* ← au lieu de 4px 6px */
  text-align: center;
  vertical-align: middle;
}
table.pdf-tbl-var th{ background:#f3f3f6 }
.left-dev{
  display:flex;
  justify-content:space-between;   /* label à gauche, expression collée à droite */
  align-items:baseline;
  gap:.5rem;
}
.left-dev .fact-latex{ white-space:nowrap; }  /* évite le retour à la ligne */
.pdf-expand{ display:none; }

/* En PDF seulement : on force la hauteur de la ligne Développement */

  /* le spacer devient visible et “pousse” la cellule */
  .pdf-expand{
    display:block;
    height: 24mm;            /* ajuste 24–40mm selon la place que tu veux */
  }

  /* si besoin, neutraliser le padding qu’on aurait ajouté ailleurs */
  .table tr.row-dev td.dev-right{
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }
 .tbl-main{ table-layout: fixed; width: 100%; }
  .tbl-main col.col-left  { width: 35% !important; }  /* ← ajuste 26–35% à ton goût */
  .tbl-main col.col-right { width: 65% !important; }

 .tbl-main3{ table-layout: fixed; width: 100%; }
  .tbl-main3 col.col-left  { width: 50% !important; }  /* ← ajuste 26–35% à ton goût */
  .tbl-main3 col.col-right { width: 50% !important; }
  
  svg{max-width:100%;height:auto;}

.tree-wrap{
  position:relative;
  width:760px;         /* ou 640px, mais UNE seule valeur */
  height:260px;
  margin:6px 0 10px;
}
#tree3 svg{overflow:visible}
.tree-wrap svg{position:absolute; inset:0; width:100%; height:100%}

.branch-input{
  position:absolute; width:58px; padding:2px 4px; font-size:12px;
  border:1px solid #cbd5e1; border-radius:6px; text-align:center; background:#fff;
}

}
/* libellés posés dans la coupure du trait */
.branch-label{
  position:absolute;white-space:nowrap;padding:0 4px;background:#fff;
  transform:translateY(-50%); /* centrage vertical sur la branche */
  font:16px system-ui,Segoe UI,Roboto,Arial;color:#111
}

/* Apparence en mode solution : les inputs deviennent des étiquettes */
.branch-input.as-label{
  border: none;
  background: transparent;
  pointer-events: none;
  font-weight: 600;
  width: auto;          /* pour épouser le contenu */
  padding: 0;
  text-align: left;
}
   /* s'assurer que la zone de l'arbre ne rogne rien et garde ses positions absolues */
  .tree-wrap{ position: relative !important; overflow: visible !important; }
  #tree3 svg{ overflow: visible !important; }

  /* les inputs/labels doivent rester visibles (le kit n'appliquera pas display:none) */
  .branch-input, .branch-label{ visibility: visible !important; opacity: 1 !important; } 
  .tree-wrap .branch-input,
  .tree-wrap .tick.abs{
    display: none !important;
  }
    .qa{display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:start}
  .qmark{min-width:1.2em;text-align:center;font-weight:700}
  
   /* ===== Graphe (SVG) ===== */
.repere { width:100%; height:auto }
.repere .grid{ stroke:#e6e6e6; stroke-width:1 }
.repere .axis{ stroke:#555; stroke-width:1.4 }
.repere .curve{ stroke:#111; stroke-width:2; fill:none }
.repere .tick text{ font-size:12px; fill:#333 }



/* Quadrillage complet */
.repere .gridH{ stroke:#e8e8e8; stroke-width:1 }
.repere .gridV{ stroke:#e8e8e8; stroke-width:1 }
.repere .gridH.major, .repere .gridV.major{ stroke:#dddddd; stroke-width:1.2 } /* un poil plus visible */

.repere .tickline{ stroke:#111; stroke-width:1.4 }
.repere .tick.int text{ font-size:12px; dominant-baseline:ideographic; }
.repere .tick.pi  text{ font-size:11px; opacity:.85; dominant-baseline:ideographic; }
.repere .tick.y  text{ font-size:12px; dominant-baseline:middle; }
  
   .controls,
  [data-math-kbd],
  input, select, textarea, button,
  .tick { display:none !important; }
  
  /* BÂTONS UNIQUEMENT DANS LES TABLEAUX DE SOLUTION (PDF) */
table.pdf-tbl td.sbar,
table.pdf-tbl td.zbar,
table.pdf-tbl td.dbar { position: relative; }

/* 1 barre centrale (vide ou avec 0) */
table.pdf-tbl td.sbar::before,
table.pdf-tbl td.zbar::before{
  content:'';
  position:absolute;
  top:-1.5px;               /* colle aux lignes horizontales */
  bottom:-1.5px;
  left:50%;
  transform:translateX(-50%);
  border-left:2px solid #000;
}
/* 0 plus grand mais moins épais */
table.pdf-tbl td.zbar,
table.var td.zbar {
  font-size: 1.35em;     /* plus grand */
  font-weight: 400;      /* poids normal, plus fin */
  line-height: 1;        /* évite que ça déborde verticalement */
}
/* écrase le gras inline sur les zéros */
table.pdf-tbl td.zbar { font-weight:400 !important; }

.controls,.header,.kbd-host,.hide-print{display:none!important} 

.uvtab{
  border-collapse:collapse;
  margin:.6rem 0 .8rem 0;
  font-size:0.95rem;
}
.uvtab td{
  border:none;
  padding:4px 32px 4px 0; /* 👈 plus d'espace entre les deux colonnes */
  white-space:nowrap;
  vertical-align:top;
  line-height:1.6;
}
@media print{
  .uvtab td{
    padding:4px 40px 4px 0;
  }
}

.twocol-solution{
  border-collapse:collapse;
  margin:.6rem 0 .8rem 0;
  width:auto;
}
.twocol-solution td{
  vertical-align:top;
  padding:0 16px;
  /* pas de bordure autour par défaut */
  border:none;
  white-space:nowrap;
  line-height:1.75;
  font-size:0.95rem;
}

/* on force UNIQUEMENT une barre verticale entre les 2 colonnes */
.twocol-solution td.col-gauche{
  border-right:2px solid #999; /* la barre visible */
  padding-right:24px;
}
.twocol-solution td.col-droite{
  padding-left:24px;
}

.twocol-solution .line{
  margin:.3rem 0;
}
.twocol-solution .line mjx-container{
  padding-bottom:.08em;
}
/* Masques spécifiques au rendu PDF */
.pdf-hide{ display:none !important; }


.tbl-suites{
  border-collapse:collapse;
  border:1px solid #ccc;
}
.tbl-suites th,
.tbl-suites td{
  border:1px solid #ccc;
  padding:4px 6px;
}

ul.no-bullet{
  list-style:none;
  padding-left:0;
  margin-left:0;
}

/* Masques spécifiques au rendu PDF */
.pdf-hide{ display:none !important; }
 .screen-only{display:none!important} .print-only{display:block!important} 


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
