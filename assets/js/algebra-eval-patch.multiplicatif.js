
/* algebra-eval-patch.multiplicatif.js
   Patch d'évaluation/normalisation conforme aux règles « Développer et réduire » :
   - accepte ^, <sup>n</sup> et exposants Unicode (x², x³, …) côté saisie ;
   - autorise multiplications implicites (3x, 2(x+1), (x+1)(x-2), x2, )x, )(, …) ;
   - normalise ×· -> *, ⁄÷ -> /, et − (Unicode) -> - pour le calcul (affichage inchangé ailleurs) ;
   - égalité algébrique robuste (expressions, listes, fractions p/q) ;
   - Entrée (clavier) déclenche Vérifier ; bouton Solution « caretise » la zone de saisie en x^n.
   - cas spécial « Mettre au même dénominateur » : contrôle optionnel déclenché uniquement si l’énoncé le demande.
*/
(function(){
  'use strict';
  if (window.__ALGEBRA_EVAL_PATCH_MULT__) return;
  window.__ALGEBRA_EVAL_PATCH_MULT__ = true;

  /* ========== utils DOM ========== */
  function $(s, r){ return (r||document).querySelector(s); }
  function findVerifyButton(){
    return document.getElementById('btn-check')
        || Array.from(document.querySelectorAll('button')).find(b=>{
             const t=(b.textContent||'').toLowerCase();
             return t.includes('vérifier') || t.includes('verifier') || t.includes('✅');
           }) || null;
  }
  function clickVerify(){
    const b = findVerifyButton();
    if (b){ b.click(); return true; }
    return false;
  }

  /* ========== normalisations ========== */
  // 1) exposants Unicode -> chiffres
  function supersToDigits(run){
    const map = { '⁻':'-', '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    return Array.from(run).map(ch => map[ch] ?? '').join('');
  }

  // 2) notations de puissance -> caret ^
  function powToCaret(s){
    s = String(s||'');
    // <sup>n</sup>  -> ^n
    s = s.replace(/<sup>\s*([+\-]?\d+)\s*<\/sup>/gi, '^$1');
    // x³, )², 7⁴ -> ^3, ^2, ^4 (collé à la base)
    s = s.replace(/([0-9xX)\]])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function(_m, base, run){
      const digits = supersToDigits(run);
      return digits ? (base + '^' + digits) : base;
    });
    // garde-fou : x² -> x^2 (si l’exposant a été séparé par un espace)
    s = s.replace(/x\s*²/gi, 'x^2');
    return s;
  }

  // 3) multiplications implicites à l’écran (uniquement pour l’éval, pas d’insertion visuelle)
  function insertImplicitMultiplication(s){
    return s
      .replace(/(\d)(x)/gi, '$1*$2')
      .replace(/(\d)\(/g, '$1*(')
      .replace(/x(\d)/gi, 'x*$1')
      .replace(/x\(/gi, 'x*(')
      .replace(/\)(\d)/g, ')*$1')
      .replace(/\)(x)/gi, ')*$1')
      .replace(/\)\(/g, ')*(');
  }

  // 4) normalisation finale pour calcul (affichage HTML non modifié)
  const SAFE_CHARS = /^[0-9xX+\-*/().,\s^·×²/⁄÷;]+$/;
  function normalizeForEval(expr){
    let s = String(expr||'').trim();
    // remplacements typographiques HTML résiduels (ne touche pas l’affichage des étapes)
    s = s.replace(/&nbsp;|<[^>]*>/g, '');
    // puissances -> caret
    s = powToCaret(s);
    // décimales FR -> EN
    s = s.replace(/,/g, '.');
    // ×,· -> *,  ⁄,÷ -> /,  − -> -
    s = s.replace(/\u2212/g,'-').replace(/[×·]/g,'*').replace(/[⁄÷]/g,'/');
    // multiplications implicites
    s = insertImplicitMultiplication(s);
    // contrôle basique
    if (!SAFE_CHARS.test(s)) throw new Error('caractères non autorisés');
    // caret -> JS **
    s = s.replace(/\^/g, '**');
    // X -> x
    s = s.replace(/X/g,'x');
    return s;
  }

  /* ========== évaluation/égalité ========== */
  function evalExprAt(expr, x){
    const s = normalizeForEval(expr);
    // eslint-disable-next-line no-new-func
    const f = new Function('x', `return (${s});`);
    const v = f(x);
    if (!Number.isFinite(v)) throw new Error('NaN');
    return v;
  }
  window.evalExprAt = evalExprAt;

  // fractions p/q
  function parseFrac(txt){
    if (!txt) return null;
    let s = String(txt).trim().replace(/\u2212/g,'-');
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1,-1).trim();
    const m = s.match(/^([+\-]?\d+)\s*[\/⁄]\s*([+\-]?\d+)$/);
    if (!m) return null;
    let n = BigInt(m[1]), d = BigInt(m[2]);
    if (d === 0n) return null;
    // normaliser signe sur le numérateur
    if (d < 0n){ d = -d; n = -n; }
    return { n, d };
  }

  function fracEqual(a,b){
    // égalité par produit croisé
    return (a.n * b.d) === (b.n * a.d);
  }

  function listSplit(s){
    return String(s||'').split(/[;,]/).map(t=>t.trim()).filter(Boolean);
  }

  function algebraicEqual(a, b){
    // 1) listes ?
    const la = listSplit(a), lb = listSplit(b);
    if (la.length>1 || lb.length>1){
      if (la.length !== lb.length) return false;
      for (let i=0;i<la.length;i++){
        if (!algebraicEqual(la[i], lb[i])) return false;
      }
      return true;
    }
    // 2) fractions ?
    const fa = parseFrac(a), fb = parseFrac(b);
    if (fa && fb) return fracEqual(fa, fb);

    // 3) expressions : évalue sur une petite grille symétrique
    const pts = [-3,-2,-1,-0.5,1,2,3];
    let okcount = 0;
    for (let i=0;i<pts.length;i++){
      const x = pts[i];
      let va, vb;
      try{ va = evalExprAt(a, x); vb = evalExprAt(b, x); }
      catch(_e){ return false; }
      if (!Number.isFinite(va) || !Number.isFinite(vb)) return false;
      if (Math.abs(va - vb) <= 1e-9*Math.max(1,Math.abs(va),Math.abs(vb))) okcount++;
    }
    return okcount >= 3;
  }
  window.algebraicEqual = algebraicEqual;

  /* ========== UI : Entrée -> Vérifier ; Solution -> caret ========== */
  // Entrée au clavier
  document.addEventListener('keydown', function(e){
    const a = document.activeElement;
    if(e.key==='Enter' && !e.shiftKey && a && (a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable)){
      clickVerify();
    }
  }, true);

  // Solution : convertir la zone de saisie en x^n (ne touche pas l’affichage des étapes)
  function toCaretInput(s){
    let t = String(s||'');
    t = t.replace(/<sup>\s*([+\-]?\d+)\s*<\/sup>/gi, '^$1');
    t = t.replace(/([0-9xX)\]])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function(_m, base, run){
      const d = supersToDigits(run);
      return d ? (base + '^' + d) : base;
    });
    t = t.replace(/x\s*²/gi,'x^2')
         .replace(/&nbsp;|<[^>]*>/g,'') // enlève HTML
         .replace(/\s+/g,' ')           // espaces propres
         .trim();
    return t;
  }
  window.toCaretInput = toCaretInput;

  function findSolutionButton(){
    return document.getElementById('btn-solution')
        || Array.from(document.querySelectorAll('button')).find(b=>{
             const t=(b.textContent||'').toLowerCase();
             return t.includes('solution') || t.includes('💡');
           }) || null;
  }
  function attachCaretizer(){
    const btn = findSolutionButton();
    if (!btn) return;
    btn.addEventListener('click', function(){
      const host = document.getElementById('host') || document;
      const inp = host.querySelector('#reponse') || host.querySelector('input[type="text"]');
      if (inp && inp.value){ inp.value = toCaretInput(inp.value); }
    }, false);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachCaretizer);
  } else { attachCaretizer(); }
  setTimeout(attachCaretizer, 300);
  setTimeout(attachCaretizer, 900);

})();

/* ========== Option : « Mettre au même dénominateur » (déclenché par l’énoncé) ========== */
(function(){
  'use strict';
  if (window.__SAME_DENOM_HOTFIX_MULT__) return;
  window.__SAME_DENOM_HOTFIX_MULT__ = true;

  function textContentAll(){
    return (document.body ? (document.body.innerText || document.body.textContent || '') : '').toLowerCase();
  }
  function isSameDenomContext(){
    const t = textContentAll();
    return /mettre au m[êe]me d[ée]nominateur/.test(t);
  }

  function parseFrac(txt){
    if (!txt) return null;
    let s = String(txt).trim().replace(/\u2212/g,'-');
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1,-1).trim();
    const m = s.match(/^([+\-]?\d+)\s*[\/⁄]\s*([+\-]?\d+)$/);
    if (!m) return null;
    let n = BigInt(m[1]), d = BigInt(m[2]);
    if (d === 0n) return null;
    if (d < 0n){ d = -d; n = -n; }
    return { n, d };
  }

  function gcd(a,b){ a=(a<0n?-a:a); b=(b<0n?-b:b); while(b){ const t=a%b; a=b; b=t; } return a; }
  function lcm(a,b){ return (a/gcd(a,b))*b; }

  function expectedSameDenom(){
    const host = document.getElementById('host') || document;
    const label = host.querySelector('.col-label,.statement') || document.body;
    const txt = (label.innerText || label.textContent || '').toLowerCase();
    const m = txt.match(/:([^:]+)$/); // liste après les deux-points
    if (!m) return null;
    const items = m[1].split(/[;,]/).map(s=>s.trim()).filter(Boolean);
    const fracs = items.map(parseFrac);
    if (fracs.some(f=>!f)) return null;
    let L = 1n;
    fracs.forEach(f=>{ L = lcm(L, f.d); });
    const expected = fracs.map(f=>({ n: (f.n * (L/f.d)), d: L }));
    return { expected };
  }

  function setVerdict(ok){
    const host = document.getElementById('host') || document;
    const res = host.querySelector('#res'); if(!res) return;
    res.textContent = ok ? '✔' : '✘';
    res.className = ok ? 'res-ok' : 'res-ko';
  }

  function handleSameDenom(e){
    if (!isSameDenomContext()) return false;
    const pack = expectedSameDenom(); if (!pack) return false;
    const host = document.getElementById('host') || document;
    const inp = host.querySelector('#reponse') || host.querySelector('input[type="text"]');
    if (!inp) return false;
    const tokens = String(inp.value||'').replace(/\u2212/g,'-').split(/[;,]/).map(s=>s.trim()).filter(Boolean);
    if (tokens.length !== pack.expected.length) return false;
    for (let i=0;i<tokens.length;i++){
      const f = parseFrac(tokens[i]); if(!f) return setVerdict(false), true;
      if (Number(f.d) !== Number(pack.expected[i].d)) return setVerdict(false), true;
      if (Number(f.n) !== Number(pack.expected[i].n)) return setVerdict(false), true;
    }
    setVerdict(true);
    if (e){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
    return true;
  }

  // Capture sur « Vérifier » et sur Entrée (uniquement si l’énoncé contient la consigne)
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button'); if(!btn) return;
    const t=(btn.textContent||'').toLowerCase();
    if (t.includes('vérifier')||t.includes('verifier')||t.includes('✅')){
      if (isSameDenomContext()) handleSameDenom(e);
    }
  }, true);
  document.addEventListener('keydown', function(e){
    const a = document.activeElement;
    if(e.key==='Enter' && !e.shiftKey && a && (a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable)){
      if (isSameDenomContext()) handleSameDenom(e);
    }
  }, true);
})();
