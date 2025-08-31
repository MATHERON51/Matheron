// js/ch0-mul-clean.js — SAFE
// Enlève le point médian (· ⋅ ∙) comme signe de multiplication avant x ou (
// et ailleurs le remplace par le symbole Unicode "×". Ne touche qu'aux TEXT NODES.

(function(){
  'use strict';

  const SELECTOR_SCOPE = [
    '#host', '.equ', '.eqline', '.steps', '.card', 'main', 'article'
  ].join(', ');

  const DOTS_RE = /[·⋅∙]/g;   // U+00B7, U+22C5, U+2219

  function fixString(s){
  // 0) Nettoyage basique
  s = String(s)
    .replace(/[·∙⋅]/g, '')                // jamais de point médian
    .replace(/\u2212/g, '−');             // moins typographique

  // 1) Puissances lisibles (si quelqu'un a écrit x^n en texte)
  const sup = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  s = s.replace(/x\^(\d+)/g, (_m,d)=> 'x' + d.split('').map(c=>sup[c]||'').join(''));

  // 2) Espaces autour de ×
  s = s.replace(/\s*×\s*/g, ' × ');

  // 3) Monômes : jamais 1x / −1x
  s = s
    .replace(/\b1x([⁰¹²³⁴⁵⁶⁷⁸⁹]|<sup>\d+<\/sup>)?\b/g, 'x$1')
    .replace(/([\-−])1x([⁰¹²³⁴⁵⁶⁷⁸⁹]|<sup>\d+<\/sup>)?\b/g, '−x$2')
    .replace(/\(1x([⁰¹²³⁴⁵⁶⁷⁸⁹]|<sup>\d+<\/sup>)?\)/g, '(x$1)')
    .replace(/\(([\-−])1x([⁰¹²³⁴⁵⁶⁷⁸⁹]|<sup>\d+<\/sup>)?\)/g, '(−x$2)');

  // 4) Coller coef et x dans un monôme (… × x[ⁿ] → …x[ⁿ])
  // (mais on respecte la distribution "k × (−monôme)" ci-dessous)
  s = s.replace(/([\-−]?\d+)\s*×\s*x((?:<sup>\d+<\/sup>)|[⁰¹²³⁴⁵⁶⁷⁸⁹])?/g, '$1x$2');

  // 5) Distribution k × monôme : parenthèses uniquement si monôme négatif
  // (détecte monôme simple: optionnel signe, coef éventuel, puis x[puissance])
  // 5a) forcer parenthèses si monôme négatif
  s = s.replace(/([\-−]?\d+)\s*×\s*(−[^+−×()\s][^+−×()]*)/g, '$1 × ($2)');
  // 5b) enlever parenthèses si monôme positif (pas d’opérateurs + − × à l’intérieur)
  s = s.replace(/([\-−]?\d+)\s*×\s*\(([^+−×()]+)\)/g, '$1 × $2');

  // 6) Parenthèses redondantes
  s = s.replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)');

  // 7) Signes propres
  s = s
    .replace(/\+\s*[−-]\s*/g, ' − ')
    .replace(/[−-]\s*[−-]\s*/g, ' + ');

  // 8) Espaces finaux
  s = s.replace(/\s{2,}/g, ' ').replace(/\s×\s/g, ' × ');

  return s;
}


  function fixTextNodes(root){
    if(!root) return;
    if(root.closest && root.closest('input,textarea,script,style,[contenteditable="true"]')) return;
    if (root.closest && root.closest('[data-mulclean="off"]')) return;

    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if(!node.nodeValue || !node.parentNode) return NodeFilter.FILTER_REJECT;
        const p = node.parentNode;
        if(p && (p.tagName==='SCRIPT' || p.tagName==='STYLE' || p.isContentEditable)) return NodeFilter.FILTER_REJECT;
        return (DOTS_RE.test(node.nodeValue) || /[^\d]\s*\.\s*[^\d]/.test(node.nodeValue))
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const list=[]; let n; while((n=tw.nextNode())) list.push(n);
    for(const t of list){
      const after = fixString(t.nodeValue);
      if(after!==t.nodeValue) t.nodeValue = after;
    }
  }

  function fixAll(){
    document.querySelectorAll(SELECTOR_SCOPE).forEach(el=>fixTextNodes(el));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    fixAll();
    const mo = new MutationObserver(list=>{
      for(const m of list){
        m.addedNodes && m.addedNodes.forEach(node=>{
          if(node.nodeType===Node.ELEMENT_NODE){
            if(node.matches && node.matches(SELECTOR_SCOPE)) fixTextNodes(node);
            node.querySelectorAll && node.querySelectorAll(SELECTOR_SCOPE).forEach(el=>fixTextNodes(el));
          }else if(node.nodeType===Node.TEXT_NODE){
            fixTextNodes(node.parentNode);
          }
        });
      }
    });
    mo.observe(document.body, {subtree:true, childList:true, characterData:true});
    ['btn-new','btn-solution','btn-check','btn-reset'].forEach(id=>{
      const b=document.getElementById(id);
      if(b) b.addEventListener('click', ()=>setTimeout(fixAll,0));
    });
  });
})();
