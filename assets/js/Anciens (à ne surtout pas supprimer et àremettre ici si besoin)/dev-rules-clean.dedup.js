/*! dev-rules-clean.dedup.js — règle générale :
 *  • le signe du facteur GAUCHE devient le connecteur entre produits ;
 *  • on parenthèse le facteur DROIT s’il est négatif ;
 *  • on n’écrit JAMAIS les produits par 0.
 */
(function(){
  'use strict';
  if (window.DevRules) return;

  const UMINUS = '−';
  function supPow(k){ if(k===2)return'²'; if(k===3)return'³'; return '<sup>'+k+'</sup>'; }

  /* ===== Monômes/Polynômes ===== */
  function monoAbs(c,p){
    const a=Math.abs(c);
    if(p===0) return ''+a;
    if(p===1) return (a===1?'x':a+'x');
    return (a===1?'x'+supPow(p):a+'x'+supPow(p));
  }
  function polyHTMLDesc(poly){
    const parts=[];
    for(let p=poly.length-1;p>=0;p--){
      const c=poly[p]; if(!c) continue;
      const a=Math.abs(c);
      const s=(c<0)?(parts.length?' '+UMINUS+' ':UMINUS+' '):(parts.length?' + ':'');
      if(p===0) parts.push(s+a);
      else if(p===1) parts.push(s+(a===1?'x':a+'x'));
      else parts.push(s+(a===1?'x'+supPow(p):a+'x'+supPow(p)));
    }
    return parts.length?parts.join('').trim():'0';
  }
  function polyToCaret(poly){
    const out=[];
    for(let p=poly.length-1;p>=0;p--){
      const c=poly[p]; if(!c) continue;
      const a=Math.abs(c);
      const s=(c<0?'-':(out.length?'+':''));
      if(p===0) out.push(s+a);
      else if(p===1) out.push(s+(a===1?'':'')+'x');
      else out.push(s+(a===1?'':'')+'x^'+p);
    }
    return out.join('');
  }

  /* ===== Opérations poly ===== */
  function trimPoly(p){ const t=p.slice(); for(let i=t.length-1;i>0;i--){ if(t[i]===0) t.pop(); else break; } return t; }
  function polyAdd(a,b){ const n=Math.max(a.length,b.length), r=new Array(n).fill(0); for(let i=0;i<n;i++){ r[i]=(a[i]||0)+(b[i]||0); } return trimPoly(r); }
  function polyMul(a,b){ const r=new Array((a.length-1)+(b.length-1)+1).fill(0); for(let i=0;i<a.length;i++){ for(let j=0;j<b.length;j++){ r[i+j]+=(a[i]||0)*(b[j]||0); } } return trimPoly(r); }
  function scalarMul(k,a){ return trimPoly(a.map(c=>k*c)); }

  /* ===== Aides d’affichage ===== */
  function kStr(k){ const a=Math.abs(k); return (k<0? UMINUS+' '+a : ''+a); }
  function kxStr(k){ const a=Math.abs(k); const core=(a===1?'x':a+'x'); return (k<0? UMINUS+' '+core : core); }
  function leftCore_k(k){ return ''+Math.abs(k); }
  function leftCore_kx(k){ const a=Math.abs(k); return (a===1?'x':a+'x'); }
  function parenIfNegTerm(c,p){ const t=monoAbs(Math.abs(c),p); return (c<0?'('+UMINUS+' '+t+')':t); }

  /* ===== RÈGLE GÉNÉRALE (jointure) ===== */
  function joinLeftSigned(blocks){
    let out='';
    for(let i=0;i<blocks.length;i++){
      const t=blocks[i]; if(!t) continue;
      const conn = (i===0) ? (t.leftNeg ? UMINUS+' ' : '') : (t.leftNeg ? ' '+UMINUS+' ' : ' + ');
      out += conn + t.leftCore + ' × ' + t.right;
    }
    return out.trim();
  }

  // k × P(x)
  function dist_kP(k,P){
    const leftNeg = k<0, leftCore = leftCore_k(k);
    const blocks=[];
    for(let p=P.length-1;p>=0;p--){
      const c=P[p]; if(!c) continue;
      blocks.push({ leftNeg, leftCore, right: parenIfNegTerm(c,p) });
    }
    return joinLeftSigned(blocks);
  }

  // kx × P(x)
  function dist_kxP(k,P){
    const leftNeg = k<0, leftCore = leftCore_kx(k);
    const blocks=[];
    for(let p=P.length-1;p>=0;p--){
      const c=P[p]; if(!c) continue;
      blocks.push({ leftNeg, leftCore, right: parenIfNegTerm(c,p) });
    }
    return joinLeftSigned(blocks);
  }

  // (ax+b)(cx+d)
  function dist_PQ(P,Q){
    const a=P[1]||0, b=P[0]||0, c=Q[1]||0, d=Q[0]||0;
    const blocks=[];
    if(a){ if(c) blocks.push({leftNeg:a<0, leftCore:leftCore_kx(a), right:parenIfNegTerm(c,1)});
           if(d) blocks.push({leftNeg:a<0, leftCore:leftCore_kx(a), right:parenIfNegTerm(d,0)}); }
    if(b){ if(c) blocks.push({leftNeg:b<0, leftCore:monoAbs(Math.abs(b),0), right:parenIfNegTerm(c,1)});
           if(d) blocks.push({leftNeg:b<0, leftCore:monoAbs(Math.abs(b),0), right:parenIfNegTerm(d,0)}); }
    return joinLeftSigned(blocks);
  }

  function dist_sum(parts){ return parts.filter(Boolean).join(' + '); }

  /* ===== Steps minimales ===== */
  function pruneDupSteps(arr){ const r=[]; for(let i=0;i<arr.length;i++){ if(!r.length||r[r.length-1]!==arr[i]) r.push(arr[i]); } return r; }
  function enonce_kP(k,P){ return 'F = '+kStr(k)+' ('+polyHTMLDesc(P)+')'; }
  function enonce_kxP(k,P){ return 'F = '+kxStr(k)+' ('+polyHTMLDesc(P)+')'; }
  function enonce_PQ(P,Q){ return 'F = ( '+polyHTMLDesc(P)+' ) ( '+polyHTMLDesc(Q)+' )'; }
  function enonce_PQR(A,B,C){ return 'F = ( '+polyHTMLDesc(A)+' ) ( '+polyHTMLDesc(B)+' ) ( '+polyHTMLDesc(C)+' )'; }
  function enonce_square(P){ return 'F = ( '+polyHTMLDesc(P)+' )'+supPow(2); }

  function steps_kP(k,P,poly){ return pruneDupSteps([ enonce_kP(k,P), 'F = '+dist_kP(k,P), 'F = '+polyHTMLDesc(poly) ]); }
  function steps_kxP(k,P,poly){ return pruneDupSteps([ enonce_kxP(k,P), 'F = '+dist_kxP(k,P), 'F = '+polyHTMLDesc(poly) ]); }
  function steps_PQ(P,Q,poly){ return pruneDupSteps([ enonce_PQ(P,Q), 'F = '+dist_PQ(P,Q), 'F = '+polyHTMLDesc(poly) ]); }

  // Étapes détaillées (A,B,C) comme demandé : (produits) → développer à l’intérieur → réduire à l’intérieur → résultat
  function steps_PQR_detailed(A,B,C,poly){
    const a=A[1]||0,b=A[0]||0,c=B[1]||0,d=B[0]||0;
    const AB = polyMul(A,B);

    // 2) grande parenthèse des 4 produits (sans 0)
    const listAB = (function(){
      const blocks=[];
      if(a){ if(c) blocks.push({leftNeg:a<0, leftCore:leftCore_kx(a), right:parenIfNegTerm(c,1)});
             if(d) blocks.push({leftNeg:a<0, leftCore:leftCore_kx(a), right:parenIfNegTerm(d,0)}); }
      if(b){ if(c) blocks.push({leftNeg:b<0, leftCore:monoAbs(Math.abs(b),0), right:parenIfNegTerm(c,1)});
             if(d) blocks.push({leftNeg:b<0, leftCore:monoAbs(Math.abs(b),0), right:parenIfNegTerm(d,0)}); }
      return joinLeftSigned(blocks);
    })();

    // 3) développer à l'intérieur (les 4 termes visibles)
    const partsAB=[{c:a*c,p:2},{c:a*d,p:1},{c:b*c,p:1},{c:b*d,p:0}].filter(t=>!!t.c);
    function sumTerms(terms){
      let out=[], lead=true;
      for(const t of terms){
        const c=t.c, p=t.p, A=Math.abs(c);
        const s=(c<0?(lead?UMINUS+' ':' '+UMINUS+' '):(lead?'':' + '));
        if(p===0) out.push(s + A);
        else if(p===1) out.push(s + (A===1?'x':A+'x'));
        else out.push(s + (A===1?'x'+supPow(p):A+'x'+supPow(p)));
        lead=false;
      }
      return out.join('');
    }

    const s1 = enonce_PQR(A,B,C);
    const s2 = 'F = (' + listAB + ') ( ' + polyHTMLDesc(C) + ' )';
    const s3 = 'F = (' + sumTerms(partsAB) + ') ( ' + polyHTMLDesc(C) + ' )';
    const s4 = 'F = ( ' + polyHTMLDesc(AB) + ' ) ( ' + polyHTMLDesc(C) + ' )';

    // 5) distribution finale par (ex+f), puis 6) somme des produits, 7) résultat
    const e=C[1]||0, f=C[0]||0;
    const s5 = 'F = ' + ( (e||0)? dist_kxP(e,AB) : '' ) + ( (e&&f)?' + ':'') + ( (f||0)? dist_kP(f,AB) : '' );
    const partsFinal=[];
    for(let p2=AB.length-1;p2>=0;p2--){
      const co=AB[p2]; if(!co) continue;
      if(e) partsFinal.push({c:co*e,p:p2+1});
      if(f) partsFinal.push({c:co*f,p:p2});
    }
    const s6 = 'F = ' + sumTerms(partsFinal);
    const s7 = 'F = ' + polyHTMLDesc(poly);

    // normalisation + suppression doublons consécutifs
    const raw=[s1,s2,s3,s4,s5,s6,s7].map(normalizeSigns);
    const res=[]; for(const t of raw){ if(!res.length||res[res.length-1]!==t) res.push(t); }
    return res;
  }

  function normalizeSigns(s0){
    if(s0==null) return s0;
    let s=String(s0);
    s=s.replace(/-/g,UMINUS);
    s=s.replace(new RegExp(UMINUS+'\\s*'+UMINUS,'g'),' + ')
       .replace(/\+\s*[-−]/g,' '+UMINUS+' ')
       .replace(/[-−]\s*\+/g,' '+UMINUS+' ')
       .replace(/\+\s*\+/g,' + ');
    s=s.replace(/\s*×\s*/g,' × ').replace(/\s{2,}/g,' ').trim();
    return s;
  }

  function render(host,payload,opts){
    const h=(host && (host instanceof Element))?host:(document.getElementById('host')||document.body);
    const enonceHTML=payload.enonceHTML||'';
    const steps=(payload.steps||[]).slice();
    const consigne=(opts && opts.consigne)!==false;
    const autofill=opts && opts.autofill;

    h.innerHTML='';
    const row=document.createElement('div'); row.className='row';
    const lab=document.createElement('div'); lab.className='statement equ';
    lab.innerHTML=(consigne?'<div class="consigne small">Développer et réduire :</div>':'')+'<div>'+enonceHTML+'</div>';
    row.appendChild(lab);
    const inpWrap=document.createElement('div'); inpWrap.className='input-wrap';
    inpWrap.innerHTML='<div class="ans-row" style="display:flex;align-items:center;gap:6px"><span class="equ" aria-hidden="true">F =</span><input type="text" id="reponse" placeholder="…" style="flex:1;min-width:0"></div>';
    row.appendChild(inpWrap);
    const res=document.createElement('div'); res.id='res'; row.appendChild(res);
    h.appendChild(row);

    const stepsHTML='<div class="steps">'+steps.map(s=>'<div class="step">'+normalizeSigns(s)+'</div>').join('')+'</div>';
    res.innerHTML=stepsHTML; res.className='small';
    if(autofill){ const inp=h.querySelector('#reponse'); if(inp) inp.value=autofill; }
  }

  window.DevRules={
    consts:{ UMINUS },
    supPow, monoAbs, polyHTMLDesc, polyToCaret,
    kStr, kxStr, parenIfNegTerm,
    enonce_kP, enonce_kxP, enonce_PQ, enonce_PQR, enonce_square,
    dist_kP, dist_kxP, dist_PQ, dist_sum,
    steps_kP, steps_kxP, steps_PQ, steps_PQR_detailed,
    trimPoly, polyAdd, polyMul, scalarMul,
    render,
    normalizeSigns
  };
})();

/* ==== Cleaner DOM (limité aux zones maths) ==== */
(function(){
  'use strict';
  if(!window.DevRules) return;
  if(window.__DEV_RULES_DEDUP_CLEANER__) return;
  window.__DEV_RULES_DEDUP_CLEANER__=true;

  var ROOTS=['#host','.equ','.eqline','.steps'];
  var EXCLUDE=new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','INPUT','TEXTAREA']);

  function cleanString(s0){
    if(!s0) return s0;
    var s=String(s0);
    s=s.replace(/\s*\(\s*/g,' ( ').replace(/\s*\)\s*/g,' ) ');
    // × ( - … ) → × (− …)
    s=s.replace(/×\s*-\s*((?:\d+)?x(?:[²³]|\^\d+)?|\d+)/g,'× (− $1)');
    s=s.replace(/×\s*\(\s*((?:\d+)?x(?:[²³]|\^\d+)?|x(?:[²³]|\^\d+)?|\d+)\s*\)/g,'× $1');
    for(var k=0;k<3;k++){ var t=s.replace(/\(\s*\(([^()]+)\)\s*\)/g,'($1)'); if(t===s) break; s=t; }
    if(typeof DevRules.normalizeSigns==='function'){ s=DevRules.normalizeSigns(s); }
    s=s.replace(/\s{2,}/g,' ').replace(/\s*([()])\s*/g,'$1').replace(/\s*×\s*/g,' × ').trim();
    return s;
  }

  function shouldSkip(n){
    if(!n || n.nodeType!==3) return true;
    var p=n.parentNode; if(!p || !(p instanceof Element)) return true;
    if(EXCLUDE.has(p.tagName)) return true;
    if(p.isContentEditable) return true;
    var ok=false; for(var i=0;i<ROOTS.length;i++){ if(p.closest && p.closest(ROOTS[i])){ ok=true; break; } }
    return !ok;
  }

  function process(root){
    try{
      var tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
      var list=[], node; while((node=tw.nextNode())){ if(!shouldSkip(node)) list.push(node); }
      for(var i=0;i<list.length;i++){ var n=list[i], after=cleanString(n.nodeValue); if(after!==n.nodeValue) n.nodeValue=after; }
    }catch(_){}
  }
  function processAll(){ process(document.body); }

  var scheduled=false, mo=null;
  function schedule(){ if(scheduled) return; scheduled=true; setTimeout(function(){ scheduled=false; processAll(); },40); }
  function attachCleaner(){
    if(mo) return;
    try{
      processAll();
      mo=new MutationObserver(function(){ schedule(); });
      mo.observe(document.body,{subtree:true,childList:true,characterData:true});
    }catch(_){}
    ['#btn-new','#btn-solution','#btn-check','#btn-reset'].forEach(function(id){
      var b=document.querySelector(id); if(b) b.addEventListener('click',function(){ schedule(); });
    });
  }

  DevRules.cleanString=cleanString;
  DevRules.attachCleaner=attachCleaner;

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',attachCleaner); } else { attachCleaner(); }
})();
