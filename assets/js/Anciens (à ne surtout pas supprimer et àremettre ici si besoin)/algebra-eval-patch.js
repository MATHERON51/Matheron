/* algebra-eval-patch.js — bundle unifié (+ <sup>…</sup> & exposants Unicode)
   - ² / ³ … ou ^2 acceptés (+ <sup>n</sup> → **n)
   - multiplications implicites (3x, 2(x+1), (x+1)(x-2), …)
   - algebraicEqual robuste (expressions, fractions, listes ; ,)
   - Entrée (clavier physique) déclenche toujours “Vérifier”
   - Exo “Mettre au même dénominateur” : PPCM exigé (pas l’irréductible),
     on bloque les handlers d’origine “jolis”.
*/
(function(){
  'use strict';
  if (window.__ALGEBRA_EVAL_PATCH_BUNDLE__) return;
  window.__ALGEBRA_EVAL_PATCH_BUNDLE__ = true;

  /* =================== utils affichage/DOM =================== */
  function $(s, r=document){ return r.querySelector(s); }
  function findVerifyButton(){
    let b = document.getElementById('btn-check');
    if (b) return b;
    b = document.querySelector('button[data-verify], [data-verify="true"]');
    if (b) return b;
    return Array.from(document.querySelectorAll('button')).find(x=>{
      const t = (x.textContent||'').trim().toLowerCase();
      return t.startsWith('vérifier') || t.startsWith('verifier') || t.includes('✅');
    }) || null;
  }
  function setVerdict(ok){
    const host = document.getElementById('host') || document;
    const res = $('#res', host) || $('.res', host);
    if (!res) return;
    res.textContent = ok ? '✔' : '✘';
    res.className   = ok ? 'res-ok' : 'res-ko';
  }

  /* =================== normalisation algèbre =================== */
  // Ajoute * manquants : 3x, 2(…), x(…), )( …, )x, x2…
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

  // Convertit un bloc d’exposants Unicode (⁻ ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹) en texte normal
  function supRunToPlain(run){
    const map = { '⁻':'-', '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    return Array.from(run).map(ch => map[ch] ?? '').join('');
  }

  // Pré-traitement des notations de puissance AVANT la vérif de caractères sûrs :
  //  - <sup>n</sup>  -> ^n
  //  - x³, (x+1)⁻²   -> x^3, (x+1)^-2
  function preprocessPowNotations(s){
    // balises HTML <sup>…</sup> (avec éventuels espaces)
    s = s.replace(/<sup>\s*([+\-]?\d+)\s*<\/sup>/gi, '^$1');

    // exposants Unicode directement collés : base^(superscriptRun)
    // base = chiffre, x/X, ) ou ] (les cas usuels chez toi)
    s = s.replace(/([0-9xX)\]])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, function(_m, base, run){
      const plain = supRunToPlain(run);
      if (!plain) return base; // si rien à convertir
      return base + '^' + plain;
    });

    return s;
  }

  // Autorise chiffres/x/opérateurs/²/^/séparateurs (après pré-traitement)
  const SAFE_CHARS = /^[0-9xX+\-*/().,\s^·×²/⁄÷;]+$/;

  function normalizeForEval(expr){
    let s = String(expr||'').trim();

    // *** NOUVEAU : convertir d’abord <sup>…</sup> et exposants Unicode ***
    s = preprocessPowNotations(s);

    // vérif de sécurité basique
    if (!SAFE_CHARS.test(s)) throw new Error('caractères non autorisés');

    // décimal FR, signes & opérateurs
    s = s.replace(/,/g,'.')
         .replace(/\u2212/g,'-')        // − -> -
         .replace(/×|·/g,'*')           // × · -> *
         .replace(/[⁄÷]/g,'/');         // slash fraction / division

    // puissances restantes :  x², 7², (… )² → **2 ; et ^ → **
    s = s.replace(/([0-9xX)\]])\s*²/g, '$1**2')
         .replace(/\^/g,'**');

    // multiplications implicites
    s = insertImplicitMultiplication(s);

    // garde-fous
    if (/(?:new|Function|=>|while|for|class|import|require|this)/.test(s))
      throw new Error('expression invalide');

    return s.replace(/X/g,'x');
  }

  /* =================== évaluation & comparaison =================== */
  function evalExprAtPatched(expr, x){
    const s = normalizeForEval(expr);
    // eslint-disable-next-line no-new-func
    const f = new Function('x', `return (${s});`);
    const v = f(x);
    if (!Number.isFinite(v)) throw new Error('NaN');
    return v;
  }

  // fractions
  function parseFrac(txt){
    if (!txt) return null;
    let s = String(txt).trim().replace(/\u2212/g,'-');
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1,-1).trim();
    const m = s.match(/^([+\-]?\d+)\s*[\/⁄]\s*([+\-]?\d+)$/);
    if (!m) return null;
    let n = BigInt(m[1]), d = BigInt(m[2]);
    if (d === 0n) return null;
    if (d < 0n){ n = -n; d = -d; }
    return {n,d};
  }
  function fracEqual(u,v){ return (u.n * v.d === v.n * u.d); }

  function algebraicEqualSingle(user, refExpr){
    const pts = [-4.5,-4,-3.5,-3,-2.5,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,2.5,3,3.5,4,4.5];
    let used = 0;
    for (const t of pts){
      let u,v;
      try{
        u = evalExprAtPatched(user, t);
        v = evalExprAtPatched(refExpr, t);
      }catch(e){ continue; }
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (Math.abs(u - v) > 1e-9) return false;
      if (++used >= 8) break;
    }
    return used >= 3;
  }

  function algebraicEqualPatched(user, refExpr){
    const uStr = String(user||'').trim();
    const rStr = String(refExpr||'').trim();

    // listes: ; ou ,
    const sep = /[;,]/;
    if (sep.test(uStr) || sep.test(rStr)){
      const uu = uStr.split(sep).map(s=>s.trim()).filter(Boolean);
      const rr = rStr.split(sep).map(s=>s.trim()).filter(Boolean);
      if (uu.length !== rr.length) return false;
      for (let i=0;i<uu.length;i++){
        const uf = parseFrac(uu[i]);
        const rf = parseFrac(rr[i]);
        if (uf && rf){
          if (!fracEqual(uf, rf)) return false;
        } else {
          if (!algebraicEqualSingle(uu[i], rr[i])) return false;
        }
      }
      return true;
    }

    // fractions simples
    const uf = parseFrac(uStr);
    const rf = parseFrac(rStr);
    if (uf && rf) return fracEqual(uf, rf);

    // cas général
    return algebraicEqualSingle(uStr, rStr);
  }

  // expose nos fonctions
  window.evalExprAt = evalExprAtPatched;
  window.algebraicEqual = algebraicEqualPatched;

  /* =================== “Mettre au même dénominateur” =================== */
  const REQUIRE_LCM_DENOM = true; // si false, autorise n’importe quel dénominateur commun constant

  function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){ const t=a%b; a=b; b=t; } return a||1; }
  function lcm(a,b){ return Math.abs(a*b)/gcd(a,b); }

  function isSameDenomExercise(){
    const host = document.getElementById('host') || document;
    const txt = ($('.equ',host)?.textContent || '').replace(/\u2212/g,'-');
    return /Mettre au même dénominateur/i.test(txt);
  }
  function getSameDenomExpected(){
    const host = document.getElementById('host') || document;
    const prompt = ($('.equ',host)?.textContent || '').replace(/\u2212/g,'-');
    const fracs = [];
    const re = /([+\-]?\d+)\s*[\/⁄]\s*([+\-]?\d+)/g;
    let m;
    while((m = re.exec(prompt))){
      fracs.push({n:parseInt(m[1],10), d:parseInt(m[2],10)});
    }
    if (fracs.length < 2) return null;
    const L = fracs.map(f=>Math.abs(f.d)).reduce((acc,d)=>lcm(acc,d),1);
    return { L, fracs, expected: fracs.map(f=>({ n: f.n*(L/f.d), d: L })) };
  }
  function userMatchesSameDenom(expectedPack){
    const host = document.getElementById('host') || document;
    const inp = $('#reponse',host) || $('input[type="text"]',host);
    if (!inp) return false;
    const tokens = String(inp.value||'')
      .replace(/\u2212/g,'-')
      .split(/[;,]/).map(s=>s.trim()).filter(Boolean);
    if (tokens.length !== expectedPack.expected.length) return false;

    let userDenom = null;
    for (let i=0;i<expectedPack.expected.length;i++){
      const uf = parseFrac(tokens[i]); if (!uf) return false;
      if (REQUIRE_LCM_DENOM){
        if (Number(uf.d) !== Number(expectedPack.expected[i].d)) return false;
      }else{
        if (userDenom === null) userDenom = uf.d;
        if (uf.d !== userDenom) return false;
      }
      if (Number(uf.n) !== Number(expectedPack.expected[i].n)) return false;
    }
    return true;
  }
  function handleSameDenomAndBlock(e){
    const pack = getSameDenomExpected();
    if (!pack) return false;
    const ok = userMatchesSameDenom(pack);
    setVerdict(ok);
    if (e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
    return true;
  }

  /* =================== Entrée → Vérifier (global) =================== */
  function isTypingField(el){
    return !!el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.isContentEditable===true);
  }
  function triggerVerify(){
    const btn = findVerifyButton();
    if (btn) btn.click();
  }
  function onEnter(e){
    if (e.key==='Enter' && !e.shiftKey && isTypingField(document.activeElement)){
      if (isSameDenomExercise()){
        handleSameDenomAndBlock(e);
        return;
      }
      e.preventDefault();
      triggerVerify();
    }
  }
  document.addEventListener('keydown', onEnter, true);
  document.addEventListener('focusin', function(e){
    const el = e.target;
    if (isTypingField(el)) el.addEventListener('keydown', onEnter);
  });

  /* =================== Hook “Vérifier” en capture =================== */
  function attachEarly(){
    const btn = findVerifyButton();
    if (!btn) return;
    btn.addEventListener('click', function(e){
      if (isSameDenomExercise()){
        handleSameDenomAndBlock(e);
      }
    }, true);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachEarly);
  } else {
    attachEarly();
  }
  setTimeout(attachEarly, 300);
  setTimeout(attachEarly, 900);
})();
/* === parsePoly shim global : accepte <sup>n</sup>, ² ³ …, ^n === */
(function(){
  'use strict';
  if (window.__PARSEPOLY_SHIM__) return;
  window.__PARSEPOLY_SHIM__ = true;

  // si la page définit parsePoly, on l'embaIe pour lui passer une version "normalisée"
  const ORIG = window.parsePoly;
  if (typeof ORIG === 'function'){
    window.parsePoly = function(str){
      let s = String(str || '');

      // <sup>n</sup> => ^n
      s = s.replace(/<sup>\s*([+\-]?\d+)\s*<\/sup>/gi, '^$1');

      // exposants Unicode collés : x³, )², 7⁴, … => ^3, ^2, ^4
      s = s.replace(/([0-9xX)\]])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function(_m, base, run){
        const map = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
        const digits = Array.from(run).map(ch => map[ch] ?? '').join('');
        return digits ? (base + '^' + digits) : base;
      });

      // normalisations minuscules usuelles
      s = s
        .replace(/\u2212/g,'-')   // − -> -
        .replace(/\s+/g,'')       // espaces
        .replace(/x²/gi,'x^2');   // sécurité complémentaire

      // on délègue à la fonction d'origine (qui peut être propre à la page)
      return ORIG.call(this, s);
    };
  }
})();
/* === Normalisation universelle des saisies avant vérification === */
(function(){
  'use strict';
  if (window.__INPUT_POW_NORMALIZER__) return;
  window.__INPUT_POW_NORMALIZER__ = true;

  function supersToDigits(run){
    const map = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    return Array.from(run).map(ch => map[ch] ?? '').join('');
  }

  function normalizePowInText(txt){
    let s = String(txt||'');

    // 1) <sup>n</sup>  -> ^n
    s = s.replace(/<sup>\s*([+\-]?\d+)\s*<\/sup>/gi, '^$1');

    // 2) Exposants Unicode collés : x³, )², 7⁴ -> ^3, ^2, ^4
    s = s.replace(/([0-9xX)\]])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, base, run) => {
      const digits = supersToDigits(run);
      return digits ? (base + '^' + digits) : base;
    });

    // 3) Sécurité complémentaire : x² -> x^2
    s = s.replace(/x\s*²/gi, 'x^2');

    // 4) Signe moins typographique -> moins ASCII
    s = s.replace(/\u2212/g, '-');

    return s;
	function normalizePowInText(txt){
  let s = String(txt||'');

  // ... (tes remplacements <sup>…</sup> et exposants Unicode)

  // 3) Sécurités existantes
  s = s.replace(/x\s*²/gi, 'x^2');

  // 4) Signe moins typographique -> ASCII
  s = s.replace(/\u2212/g, '-');

  // 5) 🔥 NOUVEAU : accepter l’infini Unicode
  //    - "−∞" ou "-∞" -> "-oo"
  //    - "+∞" -> "+oo"
  //    - "∞"  (sans signe) -> "+oo"
  s = s.replace(/([+\-−])?\s*∞/g, (_m, sign) =>
    sign ? ((sign==='−' || sign==='-') ? '-oo' : '+oo') : '+oo'
  );

  return s;
}

  }

  function normalizeAllInputs(scope){
    const root = scope || document;
    const fields = Array.from(root.querySelectorAll('input[type="text"], textarea'));
    for (const f of fields){
      const before = f.value;
      const after  = normalizePowInText(before);
      if (after !== before) f.value = after;
    }
  }

  // Avant toute vérif via le bouton “Vérifier”
  function findVerifyButton(){
    return document.getElementById('btn-check')
        || document.querySelector('button[data-verify], [data-verify="true"]')
        || Array.from(document.querySelectorAll('button')).find(b=>{
             const t=(b.textContent||'').trim().toLowerCase();
             return t.startsWith('vérifier') || t.startsWith('verifier') || t.includes('✅');
           }) || null;
  }

  function attachNormalizer(){
    const btn = findVerifyButton();
    if (!btn) return;
    // capture: on passe avant le handler d’origine
    btn.addEventListener('click', function(){
      normalizeAllInputs(document);
    }, true);
  }

  // Entrée dans un champ = normaliser puis déclencher “Vérifier”
  function onEnter(e){
    const a = document.activeElement;
    if (e.key === 'Enter' && !e.shiftKey && a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA' || a.isContentEditable)){
      normalizeAllInputs(document);
    }
  }

  document.addEventListener('keydown', onEnter, true);
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachNormalizer);
  } else {
    attachNormalizer();
  }
  // si le bouton arrive après (changement d’exercice)
  setTimeout(attachNormalizer, 300);
  setTimeout(attachNormalizer, 900);
})();
/* === Solution -> écrire en saisie avec des puissances "x^n" (plain text) === */
(function(){
  'use strict';
  if (window.__SOLUTION_CARETIZER__) return;
  window.__SOLUTION_CARETIZER__ = true;

  function supersToDigits(run){
    const map={ '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
    return Array.from(run).map(ch=>map[ch] ?? '').join('');
  }
  // Convertit HTML/Unicode -> forme clavier: ^n, - etc.
  function toCaretInput(s){
    let t = String(s||'');
    // <sup>n</sup> -> ^n
    t = t.replace(/<sup>\s*([+\-]?\d+)\s*<\/sup>/gi, '^$1');
    // x², )³, 7⁴ -> ^2, ^3, ^4
    t = t.replace(/([0-9xX)\]])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, base, run)=>{
      const d = supersToDigits(run);
      return d ? (base + '^' + d) : base;
    });
    // sécurités
    t = t.replace(/x\s*²/gi,'x^2')
         .replace(/\u2212/g,'-')       // − -> -
         .replace(/&nbsp;|<[^>]*>/g,'') // enlève HTML résiduel
         .replace(/\s+/g,' ')           // espaces propres
         .trim();
    return t;
  }
  // Expose si tu veux l’utiliser à la main depuis tes pages
  window.toCaretInput = toCaretInput;

  // Quand on clique sur "Solution", on convertit la valeur de l’input en caret
  function findSolutionButton(){
    return document.getElementById('btn-solution')
        || Array.from(document.querySelectorAll('button')).find(b=>{
             const t=(b.textContent||'').toLowerCase();
             return t.includes('solution') || t.includes('💡');
           }) || null;
  }
  function caretizeAfterSolution(){
    const host = document.getElementById('host') || document;
    const inp = host.querySelector('#reponse') || host.querySelector('input[type="text"]');
    if (inp && inp.value){
      inp.value = toCaretInput(inp.value);
    }
  }
  function attach(){
    const btn = findSolutionButton();
    if (!btn) return;
    // en phase bubble + setTimeout pour passer APRÈS le handler qui remplit la réponse
    btn.addEventListener('click', function(){
      setTimeout(caretizeAfterSolution, 0);
    }, false);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
  setTimeout(attach, 300);
  setTimeout(attach, 900);
})();
/* === Hotfix "Mettre au même dénominateur" — priorité et robustesse === */
(function(){
  'use strict';
  if (window.__SAME_DENOM_HOTFIX__) return;
  window.__SAME_DENOM_HOTFIX__ = true;

  function textOfExercise(){
    const host = document.getElementById('host') || document;
    const eqText = Array.from(host.querySelectorAll('.equ'))
      .map(el => el.textContent).join(' ');
    const t = (eqText || host.textContent || '').replace(/\s+/g,' ').trim();
    return t;
  }
  function isSameDenom(){
    const t = textOfExercise().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return t.includes('mettre au meme denominateur');
  }

  function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){ const t=a%b; a=b; b=t; } return a||1; }
  function lcm(a,b){ return Math.abs(a*b)/gcd(a,b); }

  function parseFrac(s){
    if(!s) return null;
    s = String(s).trim().replace(/\u2212/g,'-'); // − -> -
    if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1,-1).trim();
    const m = s.match(/^([+\-]?\d+)\s*[\/⁄]\s*([+\-]?\d+)$/);
    if(!m) return null;
    let n = parseInt(m[1],10), d = parseInt(m[2],10);
    if(!Number.isFinite(n) || !Number.isFinite(d) || d===0) return null;
    if(d<0){ n=-n; d=-d; }
    return {n,d};
  }

  function getExpected(){
    if(!isSameDenom()) return null;
    const txt = textOfExercise().replace(/\u2212/g,'-');
    const fracs = [];
    const re = /([+\-]?\d+)\s*[\/⁄]\s*([+\-]?\d+)/g;
    let m; while((m = re.exec(txt))){
      fracs.push({n:parseInt(m[1],10), d:parseInt(m[2],10)});
    }
    if(fracs.length < 2) return null;
    const L = fracs.map(f=>Math.abs(f.d)).reduce((acc,d)=>lcm(acc,d),1);
    return fracs.map(f => ({ n: f.n*(L/f.d), d: L })); // ordre conservé
  }

  function handleSameDenom(e){
    const expected = getExpected();
    if(!expected) return false;

    const host = document.getElementById('host') || document;
    const input = host.querySelector('#reponse') || host.querySelector('input[type="text"]');
    const res   = host.querySelector('#res') || host.querySelector('.res');

    const tokens = String((input && input.value) || '')
      .replace(/\u2212/g,'-')
      .split(/[;,]/).map(s=>s.trim()).filter(Boolean);

    let ok = (tokens.length === expected.length);
    if(ok){
      for(let i=0;i<expected.length;i++){
        const u = parseFrac(tokens[i]);
        if(!u || u.d !== expected[i].d || u.n !== expected[i].n){ ok=false; break; }
      }
    }
    if(res){
      res.textContent = ok ? '✔' : '✘';
      res.className   = ok ? 'res-ok' : 'res-ko';
    }

    if(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // bloque les autres vérifs "jolies"
    }
    return true;
  }

  // Clic sur "Vérifier" (capture) — on passe AVANT les handlers existants
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button');
    if(!btn) return;
    const t = (btn.textContent||'').toLowerCase();
    if (btn.id==='btn-check' || t.includes('vérifier') || t.includes('verifier') || t.includes('✅')){
      if (isSameDenom()) handleSameDenom(e);
    }
  }, true);

  // Entrée au clavier dans un champ de saisie
  document.addEventListener('keydown', function(e){
    const a = document.activeElement;
    if(e.key==='Enter' && !e.shiftKey && a && (a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable)){
      if (isSameDenom()) handleSameDenom(e);
    }
  }, true);
})();

