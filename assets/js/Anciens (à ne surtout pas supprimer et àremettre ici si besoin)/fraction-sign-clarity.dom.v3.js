
/* fraction-sign-clarity.dom.v3.js
   Ajoute explicitement les étapes:
     -(-k) -> + k
     +(-k) -> - k
   quand, dans une ligne .step, un opérateur '-' ou '+' précède immédiatement
   une fraction négative (.frac dont .num commence par '-' ou '−', ou avec .frac-sign).
   Important: pas de verrou global sur le container; on marque seulement chaque .step traitée.
*/
(function () {
  'use strict';
  const BIG = '\u2212';   // grand "−"
  const SMALL = '-';      // petit "-"

  function isNegFrac(frac){
    if(!frac || frac.nodeType !== 1 || !frac.matches('.frac')) return false;
    const signSpan = frac.querySelector('.frac-sign');
    if (signSpan && /[-\u2212]/.test((signSpan.textContent||'').trim())) return true;
    const num = frac.querySelector('.num');
    return !!(num && /^[\-\u2212]/.test((num.textContent||'').trim()));
  }

  function cloneAsPositive(frac){
    const c = frac.cloneNode(true);
    const signSpan = c.querySelector('.frac-sign');
    if (signSpan) signSpan.textContent = (signSpan.textContent||'').replace(/[\-\u2212]/g,'');
    const num = c.querySelector('.num');
    if (num) num.textContent = (num.textContent||'').replace(/^[\-\u2212]\s*/, '');
    return c;
  }

  // Cherche l'opérateur juste avant 'node' en remontant dans les siblings/parents
  function prevOperatorChar(step, node){
    let n = node;
    while (n && n !== step){
      if (n.previousSibling){
        n = n.previousSibling;
        // va au dernier descendant texte
        let last = n;
        while (last && last.lastChild) last = last.lastChild;
        let txt = '';
        if (last){
          if (last.nodeType === 3) txt = last.textContent || '';
          else txt = last.textContent || '';
        }
        if (txt){
          const m = txt.match(/([-\u2212\+])\s*$/);
          if (m) return m[1];
        }
      } else {
        n = n.parentNode;
      }
    }
    return null;
  }

  function process(container){
    if(!container) return;
    const steps = Array.from(container.querySelectorAll('.step'));
    for (const step of steps){
      if (step.__clarifiedV3__) continue; // déjà traité

      const fracs = Array.from(step.querySelectorAll('.frac'));
      let did = false;

      for (const frac of fracs){
        if(!isNegFrac(frac)) continue;
        const op = prevOperatorChar(step, frac);
        if(op !== SMALL && op !== BIG && op !== '+') continue; // pas d'opérateur clair juste avant

        // 1) ligne: op ( frac-négative )
        const s1 = document.createElement('div');
        s1.className = 'step';
        const wrapOp = (op===SMALL || op===BIG) ? SMALL : '+';
        s1.innerHTML = wrapOp + '(' + frac.outerHTML + ')';

        // 2) ligne: op combiné et fraction positive
        const s2 = document.createElement('div');
        s2.className = 'step';
        const outOp = (op===SMALL || op===BIG) ? '+' : SMALL; // -(-k)-> +k ; +(-k)-> -k
        s2.innerHTML = outOp + ' ' + cloneAsPositive(frac).outerHTML;

        // insérer dans l'ordre, juste après la ligne courante
        step.parentNode.insertBefore(s2, step.nextSibling);
        step.parentNode.insertBefore(s1, step.nextSibling);

        did = true;
      }

      if (did) step.__clarifiedV3__ = true;
    }
  }

  function run(){
    const res = document.querySelector('#res .steps, #res');
    if (res) process(res);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
})();
