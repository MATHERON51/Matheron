/*! ch0-mul-clean.multiplicatif.js
 * Nettoyage typographique « Chapitre 0 — Développement »
 * Respecte les règles :
 *  - Pas de libellé technique ajouté.
 *  - ENONCÉ : on ne rajoute ni n'enlève de × ; ce patch ne s'applique qu'au texte déjà rendu.
 *  - DISTRIBUTION : on conserve explicitement le symbole × ; on parenthèse le monôme de droite s'il est négatif.
 *  - Jamais de 1x / −1x ; exposants lisibles (x^n → xⁿ) ; espaces propres autour de ×.
 *  - ⚠️ Contrairement à l'ancienne version, on NE fusionne PAS « k × xⁿ » en « kxⁿ » (× reste visible).
 */
(function(){
  'use strict';
  if (window.__CH0_MUL_CLEAN_MULT__) return;
  window.__CH0_MUL_CLEAN_MULT__ = true;

  /* ===== Zones autorisées & exclus ===== */
  const ROOT_SELECTORS = ['#host','.equ','.eqline','.steps','.card','main','article'];
  const EXCLUDE = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','INPUT','TEXTAREA']);
  function isContentEditable(el){ return !!(el && (el.isContentEditable || el.closest('[contenteditable="true"]'))); }
  function inOptOut(el){ return !!(el && el.closest('[data-mulclean="off"]')); }

  function allowedContainer(node){
    if (!node || !(node instanceof Element)) return null;
    if (inOptOut(node)) return null;
    for (const sel of ROOT_SELECTORS){
      const host = node.closest(sel);
      if (host) return host;
    }
    return null;
  }

  /* ===== Conversions d'exposants ===== */
  const SUP = {'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  function toSuperscript(numStr){
    return String(numStr).split('').map(ch => SUP[ch] ?? '').join('');
  }

  /* ===== Règles de nettoyage ===== */
  function fixString(s0){
    let s = String(s0);

    // 1) supprimer les points médians utilisés comme pseudo‑multiplication
    // (on ne remplace pas par × ici pour ne pas introduire du × dans l’énoncé)
    s = s.replace(/[·⋅∙]/g, '');

    // 2) x^n -> xⁿ   (exposants Unicode)
    s = s.replace(/([0-9a-zA-Z)\]])\^([+\-]?\d+)/g, (_, base, exp) => base + toSuperscript(exp));

    // 3) espaces propres autour de ×
    s = s.replace(/\s*×\s*/g, ' × ');

    // 4) Pas de 1x / −1x (aux frontières de mots, y compris entre parenthèses)
    // ASCII et Unicode moins
    s = s.replace(/(^|[^0-9A-Za-z])1x\b/g, '$1x');
    s = s.replace(/(^|[^0-9A-Za-z])\u22121x\b/g, '$1\u2212x'); // −1x -> −x (Unicode)
    s = s.replace(/(^|[^0-9A-Za-z])\-1x\b/g, '$1-x');          // -1x -> -x (ASCII, au cas où)

    // 5) DISTRIBUTION : parenthéser le monôme de droite si négatif,
    //    et dé‑parenthéser un monôme positif simple.
    //   a) × −5x²  -> × (−5x²)  ;  × −7 -> × (−7)
    s = s.replace(/×\s*(?:\u2212|-)\s*((?:\d+)?x[⁰¹²³⁴⁵⁶⁷⁸⁹]*|\d+)/g, '× (${\u2212}$1)');
    //   b) × (5x²) -> × 5x²     ;  × (x³) -> × x³ ; × (12) -> × 12
    s = s.replace(/×\s*\(\s*((?:\d+)?x[⁰¹²³⁴⁵⁶⁷⁸⁹]*|x[⁰¹²³⁴⁵⁶⁷⁸⁹]*|\d+)\s*\)/g, '× $1');

    // 6) Parenthèses redondantes : ((…)) -> (…)
    for (let k=0;k<3;k++){ // limite itérations
      const t = s.replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)');
      if (t===s) break; s=t;
    }

    // 7) Suites de signes & espaces multiples
    s = s.replace(/\+\s*\u2212/g, '\u2212')   // + −  -> −
         .replace(/\u2212\s*\u2212/g, ' + ')  // − −  ->  +
         .replace(/\+\s*\+/g, ' + ')
         .replace(/\s{2,}/g, ' ')
         .trim();

    return s;
  }

  /* ===== Parcours texte ===== */
  function shouldSkip(node){
    if (!node) return true;
    if (node.nodeType !== Node.TEXT_NODE) return true;
    const p = node.parentNode;
    if (!p || !(p instanceof Element)) return true;
    if (EXCLUDE.has(p.tagName)) return true;
    if (isContentEditable(p)) return true;
    if (!allowedContainer(p)) return true;
    return false;
  }

  function process(root){
    try{
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n){
          return shouldSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });
      const will = [];
      while (walker.nextNode()){ will.push(walker.currentNode); }
      for (const n of will){
        const after = fixString(n.nodeValue);
        if (after !== n.nodeValue){ n.nodeValue = after; }
      }
    }catch(e){ /* no-op */ }
  }

  function processAll(){
    for (const sel of ROOT_SELECTORS){
      document.querySelectorAll(sel).forEach(process);
    }
  }

  /* ===== Observer DOM (nouveaux énoncés/solutions) ===== */
  const mo = new MutationObserver((recs)=>{
    for (const r of recs){
      if (r.type === 'childList'){
        r.addedNodes.forEach(nd=>{
          if (nd.nodeType===1){
            if (allowedContainer(nd)) process(nd);
            // traiter aussi ses sous‑arbres autorisés
            nd.querySelectorAll && nd.querySelectorAll(ROOT_SELECTORS.join(',')).forEach(process);
          }else if (nd.nodeType===3){ // texte
            const p = nd.parentNode;
            if (p && allowedContainer(p)) process(p);
          }
        });
      } else if (r.type === 'characterData'){
        const p = r.target && r.target.parentNode;
        if (p && allowedContainer(p)) process(p);
      }
    }
  });

  function start(){
    try{
      processAll();
      mo.observe(document.body, {subtree:true, childList:true, characterData:true});
    }catch(_){}
    // boutons habituels
    ['#btn-new','#btn-solution','#btn-check','#btn-reset'].forEach(id=>{
      const b = document.querySelector(id);
      if (b) b.addEventListener('click', ()=>{ setTimeout(processAll, 0); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }

})();
