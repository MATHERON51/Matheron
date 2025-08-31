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
    if(!s || !DOTS_RE.test(s)) return s;

    // Implicite : nombre · x  /  nombre · (
    s = s.replace(/(\d+)\s*[·⋅∙]\s*(x|\()/g, '$1$2');
    // ) · (  -> )(
    s = s.replace(/\)\s*[·⋅∙]\s*\(/g, ')(');
    // nombre · ) -> nombre)
    s = s.replace(/(\d+)\s*[·⋅∙]\s*\)/g, '$1)');
    // ( · (nombre|x) -> (
    s = s.replace(/\(\s*[·⋅∙]\s*(\d+|x)/g, '($1');

    // reste des points de multiplication -> "×"
    s = s.replace(DOTS_RE, '×');

    // Si un point "." est utilisé comme produit entre mots/parenthèses (pas décimale) -> "×"
    s = s.replace(/([^\d])\s*\.\s*([^\d])/g, '$1×$2');

    return s;
  }

  function fixTextNodes(root){
    if(!root) return;
    if(root.closest && root.closest('input,textarea,script,style,[contenteditable="true"]')) return;

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
