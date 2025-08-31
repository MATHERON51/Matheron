/* fix-bold-math-spacing.js
   Ajoute automatiquement une fine espace autour des blocs inline (b/strong/code/kbd/var/.expr)
   dans .equ et .steps afin d'éviter l'effet “collé” quand une expression mathématique est en gras.
   100 % CSS => aucune interaction avec dev-rules-clean.dedup.js (pas de conflit) et rien n'est
   injecté dans la version PDF (zone .equ-offscreen).
*/
(function(){
  'use strict';
  if (window.__FIX_BOLD_MATH_SPACING__) return;
  window.__FIX_BOLD_MATH_SPACING__ = true;

  var css = [
    '/* --- Espaces visuels autour des blocs inline math en gras --- */',
    '#host .equ b:not(:first-child)::before,',
    '#host .equ strong:not(:first-child)::before,',
    '#host .equ code:not(:first-child)::before,',
    '#host .equ kbd:not(:first-child)::before,',
    '#host .equ var:not(:first-child)::before,',
    '#host .equ .expr:not(:first-child)::before,',
    '#host .steps b:not(:first-child)::before,',
    '#host .steps strong:not(:first-child)::before { content:"\\2009"; }',

    '#host .equ b:not(:last-child)::after,',
    '#host .equ strong:not(:last-child)::after,',
    '#host .equ code:not(:last-child)::after,',
    '#host .equ kbd:not(:last-child)::after,',
    '#host .equ var:not(:last-child)::after,',
    '#host .equ .expr:not(:last-child)::after,',
    '#host .steps b:not(:last-child)::after,',
    '#host .steps strong:not(:last-child)::after { content:"\\2009"; }',

    '/* Pas d’espaces injectés dans les rendus hors-écran (PDF) */',
    '.equ-offscreen *::before, .equ-offscreen *::after { content: normal !important; content: none !important; }'
  ].join('\\n');

  var style = document.createElement('style');
  style.id = 'fix-bold-math-spacing-style';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();