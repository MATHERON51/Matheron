/*! ch0-mul-clean.multiplicatif.js — v2 (idempotent, anti-boucle)
 * Nettoyage typographique pour « Développer et réduire »
 * - Jamais de "+-" / "-+" / "--" (ASCII ou Unicode) -> remplacés par "−", "−", "+" (avec espaces propres)
 * - Ne touche qu'aux nœuds texte dans les zones d'énoncés/étapes (pas d'input/textarea/script/style)
 * - Idempotent + debounce MutationObserver (pas de boucle infinie)
 * - Conserve "×" dans la distribution ; n'introduit pas de "×" dans l'énoncé
 * - Jamais "1x" / "−1x" -> "x" / "−x"
 * - Convertit x^n -> xⁿ ; espace autour de × ; simplifie ((…)) ; ménage des espaces
 */
(function(){
  'use strict';
  if (window.__CH0_MUL_CLEAN_MULT_V2__) return;
  window.__CH0_MUL_CLEAN_MULT_V2__ = true;

  var ROOTS = ['#host','.equ','.eqline','.steps','.card','main','article'];
  var EXCLUDE = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','INPUT','TEXTAREA']);
  function isCE(el){ return !!(el && (el.isContentEditable || (el.closest && el.closest('[contenteditable="true"]')))); }
  function inOptOut(el){ return !!(el && el.closest && el.closest('[data-mulclean="off"]')); }

  function allowedContainer(node){
    if (!node || !(node instanceof Element)) return null;
    if (inOptOut(node)) return null;
    for (var i=0;i<ROOTS.length;i++){
      var host = node.closest(ROOTS[i]);
      if (host) return host;
    }
    return null;
  }

  var SUP = {'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  function toSuperscript(num){ return String(num).split('').map(function(ch){return SUP[ch]||'';}).join(''); }

  function normalizeSigns(s){
    // combinaisons mixtes ASCII/Unicode
    return s
      .replace(/\+\s*[−-]\s*/g, ' − ')
      .replace(/[−-]\s*\+\s*/g, ' − ')
      .replace(/[−-]\s*[−-]\s*/g, ' + ');
  }

  function fixString(s0){
    var s = String(s0);

    // Supprimer points médians de multiplication parasites
    s = s.replace(/[·⋅∙]/g,'');

    // x^n -> xⁿ
    s = s.replace(/([0-9a-zA-Z)\]])\^([+\-]?\d+)/g, function(_m, base, exp){ return base + toSuperscript(exp); });

    // Espace autour de ×
    s = s.replace(/\s*×\s*/g, ' × ');

    // 1x / −1x -> x / −x (aux frontières de mots)
    s = s.replace(/(^|[^0-9A-Za-z])1x\b/g, '$1x');
    s = s.replace(/(^|[^0-9A-Za-z])[−-]1x\b/g, '$1−x');

    // Distribution : parenthésage si terme de droite négatif ; dé‑parenthéser monôme positif simple
    // × -5x²  -> × (−5x²) ; × (5x²) -> × 5x²
    s = s.replace(/×\s*[−-]\s*((?:\d+)?x[⁰¹²³⁴⁵⁶⁷⁸⁹]*|\d+)/g, '× (−$1)');
    s = s.replace(/×\s*\(\s*((?:\d+)?x[⁰¹²³⁴⁵⁶⁷⁸⁹]*|x[⁰¹²³⁴⁵⁶⁷⁸⁹]*|\d+)\s*\)/g, '× $1');

    // Parenthèses redondantes
    for (var k=0;k<3;k++){
      var t = s.replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)');
      if (t===s) break; s=t;
    }

    // Normaliser suites de signes (mixte ASCII/Unicode)
    s = normalizeSigns(s);

    // Nettoyage espaces
    s = s.replace(/\s{2,}/g,' ')
    .replace(/\s*\(\s*/g,'(')
    .replace(/\s*\)\s*/g,')')
    .replace(/\)\s*(?=[\p{L}\p{N}])/gu, ')\u00A0')
    .replace(/\s*×\s*/g,' × ')
    .trim();

    return s;
  }

  function shouldSkip(n){
    if (!n || n.nodeType!==3) return true;
    var p = n.parentNode; if (!p || !(p instanceof Element)) return true;
    if (EXCLUDE.has(p.tagName)) return true;
    if (isCE(p)) return true;
    if (!allowedContainer(p)) return true;
    return false;
  }

  function process(root){
    try{
      var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(n){ return shouldSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
      });
      var list=[]; var node;
      while ((node = tw.nextNode())){ list.push(node); }
      for (var i=0;i<list.length;i++){
        var n = list[i], after = fixString(n.nodeValue);
        if (after !== n.nodeValue) n.nodeValue = after;
      }
    }catch(_){}
  }

  function processAll(){
    for (var i=0;i<ROOTS.length;i++){
      var sel = ROOTS[i];
      var arr = document.querySelectorAll(sel);
      for (var j=0;j<arr.length;j++){ process(arr[j]); }
    }
  }

  var scheduled = false;
  function schedule(){ if (scheduled) return; scheduled=true; setTimeout(function(){ scheduled=false; processAll(); }, 40); }

  var mo = new MutationObserver(function(recs){
    for (var i=0;i<recs.length;i++){
      var r = recs[i];
      if (r.type==='childList' || r.type==='characterData'){ schedule(); break; }
    }
  });

  function start(){
    try{ processAll(); mo.observe(document.body, {subtree:true, childList:true, characterData:true}); }catch(_){}
    ['#btn-new','#btn-solution','#btn-check','#btn-reset'].forEach(function(id){
      var b = document.querySelector(id); if (b) b.addEventListener('click', function(){ schedule(); });
    });
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
