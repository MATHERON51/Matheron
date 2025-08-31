/*! spaces-guard.matheron.js — garantit l’espace insécable après ')' si lettre/chiffre */
(function(){
  'use strict';
  var EXCLUDE = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','INPUT','TEXTAREA']);
  function fixNode(n){
    var s = n.nodeValue;
    var t = s && s.replace(/\)\s*(?=[\p{L}\p{N}])/gu, ')\u00A0');
    if (t && t!==s) n.nodeValue = t;
  }
  function process(root){
    try{
      var tw = document.createTreeWalker(root||document.body, NodeFilter.SHOW_TEXT, null, false), node;
      while ((node = tw.nextNode())){
        var p = node.parentNode;
        if (!p || !(p instanceof Element) || EXCLUDE.has(p.tagName) || p.isContentEditable) continue;
        fixNode(node);
      }
    }catch(_){}
  }
  var mo = new MutationObserver(function(){ clearTimeout(mo._t); mo._t = setTimeout(function(){ process(document.body); }, 30); });
  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', function(){ process(document.body); try{ mo.observe(document.body,{subtree:true,childList:true,characterData:true}); }catch(_){} }); }
  else { process(document.body); try{ mo.observe(document.body,{subtree:true,childList:true,characterData:true}); }catch(_){} }
})();