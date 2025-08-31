
/* fraction-sign-clarity.dom.js — ajoute les étapes -(-k) puis +k
   quand on a un signe '-' extérieur suivi d'une fraction négative (signe dans .num). */
(function () {
  'use strict';
  const BIG = '\u2212';            // "grand −" (déjà présent dans ton HTML)
  const SMALL = '-';               // petit '-'

  const isTextMinus = (n) => n && n.nodeType === 3 && /[-\u2212]\s*$/.test(n.textContent || '');
  const isNegFrac = (frac) => {
    if (!frac || frac.nodeType !== 1 || !frac.matches('.frac')) return false;
    const num = frac.querySelector('.num');
    return !!(num && /^[\-\u2212]/.test((num.textContent || '').trim()));
  };

  // clone -> supprime le signe dans le numérateur
  const cloneAsPositive = (frac) => {
    const c = frac.cloneNode(true);
    const n = c.querySelector('.num');
    if (n) n.textContent = (n.textContent || '').replace(/^[\-\u2212]\s*/, '');
    return c;
  };

  function processStepsOnce(container){
    if (!container || container.__signClarityDone__) return;
    container.__signClarityDone__ = true;

    const steps = Array.from(container.querySelectorAll('.step'));
    for (const step of steps) {
      // Évite les doublons si on ré-exécute
      if (step.__clarified__) continue;

      // Cherche toutes les fractions de la ligne
      const fracs = Array.from(step.querySelectorAll('.frac'));
      let foundAny = false;

      fracs.forEach(frac => {
        const prev = frac.previousSibling;
        if (!isTextMinus(prev)) return;       // on veut un '-' extérieur juste avant
        if (!isNegFrac(frac)) return;         // fraction négative ? (signe dans .num)

        foundAny = true;

        // Étape 1 : - ( -k )
        const s1 = document.createElement('div');
        s1.className = 'step';
        const negHTML = frac.outerHTML;       // garde exactement le HTML de la fraction
        s1.innerHTML = SMALL + '(' + negHTML + ')';

        // Étape 2 : + k   (même fraction mais positive)
        const s2 = document.createElement('div');
        s2.className = 'step';
        const posHTML = cloneAsPositive(frac).outerHTML;
        s2.innerHTML = '+ ' + posHTML;

        // insère juste après la ligne courante (dans l'ordre)
        step.parentNode.insertBefore(s2, step.nextSibling);
        step.parentNode.insertBefore(s1, step.nextSibling);
      });

      if (foundAny) step.__clarified__ = true;
    }
  }

  function run(){
    const res = document.querySelector('#res .steps, #res');
    if (res) processStepsOnce(res);
  }

  // 1) au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // 2) quand la solution se régénère
  new MutationObserver(run).observe(document.body, {childList:true, subtree:true});
})();
