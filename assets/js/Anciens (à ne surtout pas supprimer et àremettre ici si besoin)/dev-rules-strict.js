/*! dev-rules-strict.js — v2 (étapes détaillées conformes au PDF)
 * Règles d’affichage « Développer et réduire » (Seconde)
 * - Énoncé SANS × ; distribution AVEC × ; − Unicode ; jamais 1x/−1x ; parenthèses si terme de droite négatif.
 * - Génère TOUTES les étapes comme dans le PDF (FOIL détaillé, puis réduction).
 * API (window.DevRules):
 *   consts:{UMINUS}
 *   format: supPow, monoAbs, monoStr, polyHTMLDesc, polyToCaret, normalizeSigns
 *   enoncés: enonce_kP, enonce_kxP, enonce_PQ, enonce_PQR, enonce_square
 *   dist: dist_kP, dist_kxP, dist_PQ, dist_AB_C   // chaînes "× …" (distribution)
 *   steps: steps_kP, steps_kxP, steps_PQ_all, steps_square_all, steps_kP_plus_lQ_all, steps_PQ_plus_kR_all, steps_PQR_all
 *   poly:  trimPoly, polyAdd, polyMul, scalarMul
 *   render(host,{enonceHTML,steps},{consigne:true,autofill:''})
 */
(function(){
  'use strict';
  if (window.DevRules && window.DevRules.__v2__) return;

  /* ===== Signes & exposants ===== */
  const UMINUS = '−';
  function supPow(k){
    if (k===2) return '²';
    if (k===3) return '³';
    return '<sup>'+k+'</sup>';
  }

  /* ===== Format monômes/polynômes ===== */
  function monoAbs(c,p){
    const a = Math.abs(c);
    if (p===0) return String(a);
    if (p===1) return (a===1? 'x' : a+'x');
    return (a===1? 'x'+supPow(p) : a+'x'+supPow(p));
  }
  function monoStr(c,p,lead=false){
    // lead: true si c est le premier terme (pas de " + " devant un positif)
    const a=Math.abs(c), s = (c<0? (lead? UMINUS+' ' : ' '+UMINUS+' ') : (lead? '' : ' + '));
    if (p===0) return s + a;
    if (p===1) return s + (a===1? 'x' : a+'x');
    return s + (a===1? 'x'+supPow(p) : a+'x'+supPow(p));
  }
  function kStr(k){ return (k<0? UMINUS+' '+Math.abs(k) : ''+Math.abs(k)); }
  function kxStr(k){ const a=Math.abs(k); const core=(a===1? 'x' : a+'x'); return (k<0? UMINUS+' '+core : core); }

  function polyHTMLDesc(poly){
    const parts=[];
    for(let p=poly.length-1;p>=0;p--){
      const c = poly[p]; if(!c) continue;
      parts.push(monoStr(c,p,parts.length===0));
    }
    return parts.length? parts.join('').trim() : '0';
  }

  function polyToCaret(poly){
    const out=[];
    for(let p=poly.length-1;p>=0;p--){
      const c = poly[p]; if(!c) continue;
      const a=Math.abs(c), sign = (c<0?'-':(out.length?'+':''));
      if (p===0) out.push(sign+a);
      else if (p===1) out.push(sign + (a===1?'':'') + 'x');
      else out.push(sign + (a===1?'':'') + 'x^'+p);
    }
    return out.join(' ').replace(/\+\s*-/g,'-');
  }

  function normalizeSigns(txt){
    let s = String(txt);
    s = s.replace(/\+\s*−\s*/g, ' '+UMINUS+' ')
         .replace(/−\s*\+\s*/g, ' '+UMINUS+' ')
         .replace(/−\s*−\s*/g, ' + ')
         .replace(/\+\s*-\s*/g, ' '+UMINUS+' ')
         .replace(/-\s*\+\s*/g, ' '+UMINUS+' ')
         .replace(/-\s*-\s*/g, ' + ')
         .replace(/\+\s*\+/g, ' + ')
         .replace(/\s{2,}/g,' ')
         .trim();
    return s;
  }

  /* ===== Helpers produits ===== */
  function parenIfNegTerm(c,p){
    const t = monoAbs(c,p);
    return (c<0? '('+UMINUS+' '+t+')' : t);
  }
  function prodDisplay(leftCoef,leftPow,rightCoef,rightPow){
    // "a x^p × (±b x^q)" avec parenthèses si rightCoef < 0
    const L = monoAbs(leftCoef,leftPow);
    const R = parenIfNegTerm(rightCoef,rightPow);
    return L+' × '+R;
  }
  function prodResultMono(leftCoef,leftPow,rightCoef,rightPow){
    const c = leftCoef*rightCoef, p = leftPow+rightPow;
    return {c,p, str: monoStr(c,p,false)};
  }

  /* ===== Distributions ===== */
  function dist_kP(k,P){
    const K = kStr(k), parts=[]; let first=true;
    for(let p=P.length-1;p>=0;p--){
      const c=P[p]; if(!c) continue;
      const right = parenIfNegTerm(c,p);
      parts.push((first? K : ' + '+K) + ' × ' + right);
      first=false;
    }
    return normalizeSigns(parts.join(''));
  }
  function dist_kxP(k,P){
    const Kx = kxStr(k), parts=[]; let first=true;
    for(let p=P.length-1;p>=0;p--){
      const c=P[p]; if(!c) continue;
      const right = parenIfNegTerm(c,p);
      parts.push((first? Kx : ' + '+Kx) + ' × ' + right);
      first=false;
    }
    return normalizeSigns(parts.join(''));
  }
  function dist_PQ(P,Q){
    const a=P[1]||0, b=P[0]||0, c=Q[1]||0, d=Q[0]||0;
    const t1 = kxStr(a)+' × '+parenIfNegTerm(c,1);
    const t2 = kxStr(a)+' × '+parenIfNegTerm(d,0);
    const t3 = parenIfNegTerm(b,0)+' × '+parenIfNegTerm(c,1);
    const t4 = parenIfNegTerm(b,0)+' × '+parenIfNegTerm(d,0);
    return normalizeSigns([t1,t2,t3,t4].join(' + '));
  }
  function dist_AB_C(AB, C){
    const e = C[1]||0, f = C[0]||0;
    const parts=[];
    for(let p=AB.length-1;p>=0;p--){
      const c=AB[p]; if(!c) continue;
      parts.push( monoAbs(c,p)+' × '+parenIfNegTerm(e,1) );
      parts.push( monoAbs(c,p)+' × '+parenIfNegTerm(f,0) );
    }
    return normalizeSigns(parts.join(' + '));
  }

  /* ===== Étapes détaillées ===== */
  function steps_kP(k,P,poly){
    return [
      'F = '+kStr(k)+' ('+polyHTMLDesc(P)+')',
      'F = '+dist_kP(k,P),
      'F = '+polyHTMLDesc(poly)
    ].map(normalizeSigns);
  }

  function steps_kxP(k,P,poly){
    return [
      'F = '+kxStr(k)+' ('+polyHTMLDesc(P)+')',
      'F = '+dist_kxP(k,P),
      'F = '+polyHTMLDesc(poly)
    ].map(normalizeSigns);
  }

  function steps_PQ_all(P,Q,poly){
    const a=P[1]||0, b=P[0]||0, c=Q[1]||0, d=Q[0]||0;
    // 1) Enoncé
    const s1 = 'F = ( '+polyHTMLDesc(P)+' ) ( '+polyHTMLDesc(Q)+' )';
    // 2) Distribution "×"
    const s2 = 'F = '+dist_PQ(P,Q);
    // 3) Résultat des 4 produits (non réduits)
    const r1 = prodResultMono(a,1,c,1).str;
    const r2 = prodResultMono(a,1,d,0).str;
    const r3 = prodResultMono(b,0,c,1).str;
    const r4 = prodResultMono(b,0,d,0).str;
    const s3 = normalizeSigns('F = '+r1 + r2 + r3 + r4);
    // 4) Réduction
    const s4 = 'F = '+polyHTMLDesc(poly);
    return [s1,s2,s3,s4];
  }

  function steps_square_all(P,poly){
    const a=P[1]||0, b=P[0]||0;
    const base = '( '+polyHTMLDesc(P)+' )';
    const s1 = 'F = '+base+supPow(2);
    const s2 = 'F = '+base+'( '+polyHTMLDesc(P)+' )';
    const t1 = prodDisplay(a,1,a,1);
    const t2 = prodDisplay(a,1,b,0);
    const t3 = prodDisplay(b,0,a,1);
    const t4 = prodDisplay(b,0,b,0);
    const s3 = normalizeSigns('F = '+t1+' + '+t2+' + '+t3+' + '+t4);
    const r1 = prodResultMono(a,1,a,1).str;
    const r2 = prodResultMono(a,1,b,0).str;
    const r3 = prodResultMono(b,0,a,1).str;
    const r4 = prodResultMono(b,0,b,0).str;
    const s4 = normalizeSigns('F = '+r1+r2+r3+r4);
    const s5 = 'F = '+polyHTMLDesc(poly);
    return [s1,s2,s3,s4,s5];
  }

  function steps_kP_plus_lQ_all(k,P,l,Q,poly){
    const s1 = 'F = '+kStr(k)+' ('+polyHTMLDesc(P)+') + '+kStr(l)+' ('+polyHTMLDesc(Q)+')';
    const s2 = 'F = '+dist_kP(k,P)+' + '+dist_kP(l,Q);
    const s3 = 'F = '+polyHTMLDesc(poly);
    return [s1, normalizeSigns(s2), s3];
  }

  function steps_PQ_plus_kR_all(P,Q,k,R,poly){
    const s1 = 'F = ( '+polyHTMLDesc(P)+' ) ( '+polyHTMLDesc(Q)+' ) + '+kStr(k)+' ('+polyHTMLDesc(R)+')';
    const s2 = 'F = '+dist_PQ(P,Q)+' + '+dist_kP(k,R);
    const a=P[1]||0, b=P[0]||0, c=Q[1]||0, d=Q[0]||0;
    const r1 = prodResultMono(a,1,c,1).str;
    const r2 = prodResultMono(a,1,d,0).str;
    const r3 = prodResultMono(b,0,c,1).str;
    const r4 = prodResultMono(b,0,d,0).str;
    const s3 = normalizeSigns('F = '+r1+r2+r3+r4+' + '+dist_kP(k,R).replace(/^.*?=\s*/,'').trim());
    const prod = polyMul(P,Q);
    const s4 = 'F = '+polyHTMLDesc(prod)+' + '+polyHTMLDesc( (function(){return R.map((c,i)=> (k*(R[i]||0)));})() );
    const s5 = 'F = '+polyHTMLDesc(poly);
    return [s1, normalizeSigns(s2), s3, s4, s5];
  }

  function steps_PQR_all(A,B,C,poly){
    // 1) Enoncé
    const s1 = 'F = ( '+polyHTMLDesc(A)+' ) ( '+polyHTMLDesc(B)+' ) ( '+polyHTMLDesc(C)+' )';
    // 2) FOIL pour (A)(B) à l’intérieur des () suivi de (C)
    const s2 = 'F = ('+dist_PQ(A,B)+') ( '+polyHTMLDesc(C)+' )';
    // 3) Résultat des 4 produits dans la 1ère parenthèse (non réduits)
    const a=A[1]||0, b=A[0]||0, c=B[1]||0, d=B[0]||0;
    const r1 = prodResultMono(a,1,c,1).str;
    const r2 = prodResultMono(a,1,d,0).str;
    const r3 = prodResultMono(b,0,c,1).str;
    const r4 = prodResultMono(b,0,d,0).str;
    const s3 = normalizeSigns('F = ('+(r1+r2+r3+r4).replace(/^\s*\+\s*/,'')+') ( '+polyHTMLDesc(C)+' )');
    // 4) Réduction à (AB) × (C)
    const AB = polyMul(A,B);
    const s4 = 'F = ( '+polyHTMLDesc(AB)+' ) ( '+polyHTMLDesc(C)+' )';
    // 5) Distribution (AB) sur (C) en 6 produits
    const s5 = 'F = '+dist_AB_C(AB,C);
    // 6) Résultat des 6 produits (non réduits)
    const e=C[1]||0, f=C[0]||0;
    let parts=[];
    for(let p=AB.length-1;p>=0;p--){
      const coef=AB[p]; if(!coef) continue;
      parts.push(prodResultMono(coef,p,e,1).str);
      parts.push(prodResultMono(coef,p,f,0).str);
    }
    const s6 = normalizeSigns('F = '+parts.join(''));
    // 7) Réduction finale
    const s7 = 'F = '+polyHTMLDesc(poly);
    return [s1,s2,s3,s4,s5,s6,s7];
  }

  /* ===== Enoncés ===== */
  function enonce_kP(k,P){ return 'F = '+kStr(k)+' ('+polyHTMLDesc(P)+')'; }
  function enonce_kxP(k,P){ return 'F = '+kxStr(k)+' ('+polyHTMLDesc(P)+')'; }
  function enonce_PQ(P,Q){ return 'F = ( '+polyHTMLDesc(P)+' ) ( '+polyHTMLDesc(Q)+' )'; }
  function enonce_PQR(A,B,C){ return 'F = ( '+polyHTMLDesc(A)+' ) ( '+polyHTMLDesc(B)+' ) ( '+polyHTMLDesc(C)+' )'; }
  function enonce_square(P){ return 'F = ( '+polyHTMLDesc(P)+' )'+supPow(2); }

  /* ===== Opérations polynomiales ===== */
  function trimPoly(p){ const t=p.slice(); for(let i=t.length-1;i>0;i--){ if(t[i]===0) t.pop(); else break; } return t; }
  function polyAdd(a,b){ const n=Math.max(a.length,b.length), r=new Array(n).fill(0); for(let i=0;i<n;i++){ r[i]=(a[i]||0)+(b[i]||0);} return trimPoly(r); }
  function polyMul(a,b){ const r=new Array((a.length-1)+(b.length-1)+1).fill(0); for(let i=0;i<a.length;i++){ for(let j=0;j<b.length;j++){ r[i+j]+=(a[i]||0)*(b[j]||0); } } return trimPoly(r); }
  function scalarMul(k,a){ return trimPoly(a.map(c=>k*c)); }

  /* ===== Rendu DOM minimal ===== */
  function render(host, payload, opts){
    const h = (host && (host instanceof Element)) ? host : document.getElementById('host') || document.body;
    const enonceHTML = normalizeSigns(payload.enonceHTML || '');
    const steps = (payload.steps||[]).map(normalizeSigns);
    const consigne = (opts && opts.consigne)!==false; // true par défaut
    const autofill = opts && opts.autofill;

    h.innerHTML='';
    const row = document.createElement('div'); row.className='row';
    const lab = document.createElement('div'); lab.className='statement equ';
    lab.innerHTML = (consigne? '<div class="consigne small">Développer et réduire :</div>' : '') + '<div>'+enonceHTML+'</div>';
    row.appendChild(lab);
    const inpWrap = document.createElement('div'); inpWrap.className='input-wrap';
    inpWrap.innerHTML = '<input type="text" id="reponse" placeholder="F = …">';
    row.appendChild(inpWrap);
    const res = document.createElement('div'); res.id='res'; row.appendChild(res);
    h.appendChild(row);

    const stepsHTML = '<div class="steps">'+steps.map(s=>'<div class="step">'+s+'</div>').join('')+'</div>';
    res.innerHTML = stepsHTML;
    res.className = 'small';

    if (autofill){ const inp = h.querySelector('#reponse'); if(inp) inp.value = autofill; }
  }

  
  function steps_kP_all(k,P,poly){
    // 1) Enoncé: F = k (P)
    const s1 = 'F = '+kStr(k)+' ('+polyHTMLDesc(P)+')';
    // 2) Distribution: k × terme
    const s2 = 'F = '+dist_kP(k,P);
    // 3) Produits calculés (non réduits)
    const parts=[];
    for(let p=P.length-1;p>=0;p--){
      const c=P[p]; if(!c) continue;
      const r = prodResultMono(k,0,c,p).str; // k×(c x^p) -> (kc) x^p
      parts.push(r);
    }
    const s3 = normalizeSigns('F = '+parts.join(''));
    // 4) Réduction finale
    const s4 = 'F = '+polyHTMLDesc(poly);
    return [s1,s2,s3,s4];
  }

  function steps_kxP_all(k,P,poly){
    // 1) Enoncé
    const s1 = 'F = '+kxStr(k)+' ('+polyHTMLDesc(P)+')';
    // 2) Distribution
    const s2 = 'F = '+dist_kxP(k,P);
    // 3) Produits calculés (non réduits)
    const parts=[];
    for(let p=P.length-1;p>=0;p--){
      const c=P[p]; if(!c) continue;
      // (kx)×(c x^p) -> (kc) x^(p+1)
      const r = prodResultMono(k,1,c,p).str;
      parts.push(r);
    }
    const s3 = normalizeSigns('F = '+parts.join(''));
    // 4) Réduction
    const s4 = 'F = '+polyHTMLDesc(poly);
    return [s1,s2,s3,s4];
  }

  window.DevRules = {
    __v2__: true,
    consts:{ UMINUS },
    supPow, monoAbs, monoStr, polyHTMLDesc, polyToCaret, normalizeSigns,
    kStr, kxStr, parenIfNegTerm,
    enonce_kP, enonce_kxP, enonce_PQ, enonce_PQR, enonce_square,
    dist_kP, dist_kxP, dist_PQ, dist_AB_C,
    steps_kP, steps_kxP, steps_kP_all, steps_kxP_all, steps_PQ_all, steps_square_all, steps_kP_plus_lQ_all, steps_PQ_plus_kR_all, steps_PQR_all,
    trimPoly, polyAdd, polyMul, scalarMul,
    render
  };
})();