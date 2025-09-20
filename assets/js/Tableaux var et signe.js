<style>

  /* ---- tableau variations compact ---- */
  .var-wrap{display:flex;justify-content:center}
  table.var{width:max-content;border-collapse:separate;border-spacing:0;margin:.35rem auto}
  table.var th, table.var td{padding:4px 6px;border:1.5px solid #000}
  table.var th{background:#f3f3f6}
  table.var .bigsel select{font-size:28px;line-height:1;height:2.1em}
  table.var .bigsel{padding:0 4px}
  table.var input[type="text"]{width:110px;text-align:center}
  table.var tr > td:nth-child(2), table.var tr > th:nth-child(2){ border-right:none; }
  table.var tr > td:nth-child(3), table.var tr > th:nth-child(3){ border-left:none; border-right:none; }
  table.var tr > td:nth-child(4), table.var tr > th:nth-child(4){ border-left:none; }
  table.var tbody tr:first-child td:nth-child(3){ border-bottom:none; }
  table.var .thin td{ border-top:none; border-left:none; border-right:none; padding-top:2px; }
  table.var .gaprow td{ border:none !important; height:8px; padding:0; }
 
 </style>

 /* ===================== Ex3 : Tableau de variations ===================== */
const exVariations={ id:'var', title:'Tableau de variations à compléter (f en forme canonique)',
  gen(){ const a=choice([-3,-2,-1,1,2,3]); const alpha=fromInt(rnd(-5,5)); const beta=fromInt(rnd(-6,6)); return {a,alpha,beta}; },
  render(host,st){
    const line = wrap( `f(x) = ${canonTex(st.a, st.alpha, st.beta)}` );
    host.innerHTML=[
      `<div class="statement">On considère ${line}.</div>`,
      '<div style="margin:.4rem 0">Sommet : \\(S \\)( <input class="alpha-q" type="text" style="width:110px"> ; <input class="beta-q" type="text" style="width:110px"> )<span class="tick"></span></div>',
      '<div class="var-wrap"><table class="var">',
      '<thead><tr><th>\\(x\\)</th><td>\\(−∞\\)</td><td style="text-align:center"><input class="alpha-in" type="text" style="width:90px"></td><td>\\(+∞\\)</td></tr></thead>',
      '<tbody>',
      '<tr>',
        '<th rowspan="3">\\(f\\)</th>',
        '<td class="bigsel" rowspan="3"><select class="d-L"><option value=""></option><option>↘</option><option>↗</option></select></td>',
        '<td style="text-align:center"><input class="d-beta-top" type="text" placeholder="maximum"></td>',
        '<td class="bigsel" rowspan="3"><select class="d-R"><option value=""></option><option>↘</option><option>↗</option></select></td>',
      '</tr>',
      '<tr class="gaprow"><td></td></tr>',
      '<tr class="thin">',
        '<td style="text-align:center"><input class="d-beta-bot" type="text" placeholder="minimum"></td>',
      '</tr>',
      '</tbody></table></div>',
      '<div id="res" class="small"></div>'
    ].join('');
    if (window.MathJax?.typeset) MathJax.typeset();
  },
  correct(host,st){
    let ok=0, tot=0;
    const alphaOK1 = algebraOK(ratText(st.alpha), $('.alpha-q',host).value.trim()); if($('.alpha-q',host).value.trim()) { setTick($('.alpha-q',host),alphaOK1); tot++; if(alphaOK1) ok++; }
    const betaOK1  = algebraOK(ratText(st.beta),  $('.beta-q',host).value.trim());  if($('.beta-q',host).value.trim())  { setTick($('.beta-q',host),betaOK1);  tot++; if(betaOK1)  ok++; }

    const alphaOK = algebraOK(ratText(st.alpha), $('.alpha-in',host).value.trim()); if($('.alpha-in',host).value.trim()){ setTick($('.alpha-in',host),alphaOK); tot++; if(alphaOK) ok++; }

    const expect = st.a>0? ['↘','↗','bot'] : ['↗','↘','top']; // bot=min, top=max
    const LT=$('.d-L',host).value, RT=$('.d-R',host).value;
    if(LT){ const LOK=(LT===expect[0]); setTick($('.d-L',host),LOK); tot++; if(LOK) ok++; }
    if(RT){ const ROK=(RT===expect[1]); setTick($('.d-R',host),ROK); tot++; if(ROK) ok++; }

    const betaTop = $('.d-beta-top',host).value.trim(), betaBot = $('.d-beta-bot',host).value.trim();
    if(betaTop || betaBot){
      let betaOK=false;
      if(expect[2]==='top'){
        betaOK = algebraOK(ratText(st.beta), betaTop) && betaBot==='' ;
        setTick($('.d-beta-top',host), algebraOK(ratText(st.beta), betaTop));
        if(betaBot) setTick($('.d-beta-bot',host), false);
      }else{
        betaOK = algebraOK(ratText(st.beta), betaBot) && betaTop==='' ;
        setTick($('.d-beta-bot',host), algebraOK(ratText(st.beta), betaBot));
        if(betaTop) setTick($('.d-beta-top',host), false);
      }
      tot++; if(betaOK) ok++;
    }
    $('#res',host).innerHTML = '<div class="steps"><div class="step">Résultat : <b>'+ok+' / '+tot+'</b></div></div>';
  },
  solution(host,st){
    const expectTop = st.a<0; // max en haut si a<0
    const top = expectTop ? wrap(texRat(st.beta)) : '';
    const bot = expectTop ? '' : wrap(texRat(st.beta));
    const sensL = st.a>0?'↘':'↗';
    const sensR = st.a>0?'↗':'↘';
    const res = $('#res',host);
	const aNote =
  (st.a > 0)
    ? `Ici \\(a=${st.a}>0\\) donc la parabole est tournée vers le <b>haut</b>.`
    : `Ici \\(a=${st.a}<0\\) donc la parabole est tournée vers le <b>bas</b>.`;

res.innerHTML = [
  '<div class="steps"><div class="step"><b>Sommet :</b> \\(S\\)(',wrap(texRat(st.alpha)),' ; ',wrap(texRat(st.beta)),').</div>',
  '<div class="step">Tableau attendu :</div>',
  '<div class="step">On regarde le signe de \\(a\\)</div>',
  ` <div class="step small">${aNote}</div>`,          // ⟵ AJOUT
  '<div class="var-wrap"><table class="var">',
      '<thead><tr><th>\\(x\\)</th><td>\\(−∞\\)</td><td>' + wrap(texRat(st.alpha)) + '</td><td>\\(+∞\\)</td></tr></thead>',
      '<tbody>',
      '<tr><th rowspan="2">\\(f\\)</th><td class="bigsel" rowspan="2">',sensL,'</td><td style="text-align:center">',top,'</td><td class="bigsel" rowspan="2">',sensR,'</td></tr>',
      '<tr class="thin"><td style="text-align:center">',bot,'</td></tr>',
      '</tbody></table></div>',
      '</div>'
    ].join('');
mjTypeset(res);  },
  reset(host){ $('#res',host).textContent=''; }
};


 <style>

.sign-table{
  width:100%;
  border:2px solid #000;
  border-collapse:separate;
  border-spacing:0;
  table-layout:fixed;
  --zeroW: 110px;
}
.sign-table col.col-lbl{ width: 96px; }
.sign-table col.col-zero{ width: var(--zeroW); }
.sign-table col.col-int{ width:auto; }

.sign-table th, .sign-table td{
  padding:8px 6px; text-align:center; vertical-align:middle;
  border-top:1px solid #000;
  border-bottom:1px solid #000;
  border-right:none; border-left:none;
}

.sign-table .lbl{
  font-weight:600;
  border-right:2px solid #000;
  white-space:nowrap;
}

.sign-table td.int{ border-left:0 !important; border-right:0 !important; }
.sign-table td.zero{ border-left:0 !important; border-right:0 !important; }
.sign-table .cap-left{ text-align:left; padding-left:8px; }
.sign-table .cap-right{ text-align:right; padding-right:8px; }

.sign-table .sel, .sign-table .root{
    width: var(--zeroW);
    height: 34px;
    line-height: 1.2;
    font-size: 16px;
    padding: 6px 8px;
    border:1px solid #cbd5e1; border-radius:8px;
    text-align:center; box-sizing:border-box;
    margin:0 auto; display:block; background:#fff;
  }
.sign-table .sel{
  -webkit-appearance:none; -moz-appearance:none; appearance:none;
  text-align-last:center;
}

.sign-table{ font-size:1.15rem; }
.sign-table th, .sign-table td{
  padding:10px 14px;
}
.sign-table .cell{ width:84px; height:44px; font-size:1.12rem; }
.sign-table .sel{ height:40px; min-width:84px; text-align-last:center; }
.sign-table .root{ min-width:110px; height:40px; font-size:1.12rem; }

  @media print{ .controls{display:none !important;} }

.sign-table .cell-inline{ display:inline-flex; align-items:center; justify-content:center; gap:6px; }
.tick{ min-width:1.1em; font-weight:700; font-size:16px; line-height:1; vertical-align:middle; }
.tick.ok{ color:#16a34a; }
.tick.ko{ color:#dc2626; }
.tick.nu{ color:transparent; }

.pdf-large.sign-table{
  font-size: 1.35rem;
  --zeroW: 140px;
}
.pdf-large.sign-table th,
.pdf-large.sign-table td{
  padding: 14px 16px;
}
.pdf-large.sign-table td,
.pdf-large.sign-table th{
  text-align: center !important;
  vertical-align: middle !important;
}
.pdf-large.sign-table .lbl{ text-align: center !important; }

/* Demi-taille pour le tableau de signes */
.sign-table.half{
  font-size:.575rem;           /* 1.15 / 2 */
  --zeroW:55px;                /* 110 / 2 */
}
.sign-table.half th,
.sign-table.half td{ padding:5px 7px; }      /* 10–14 -> ~5–7 */
.sign-table.half .cell{ width:42px; height:22px; font-size:.56rem; } /* 84x44 -> moitié */
.sign-table.half .sel{ height:20px; min-width:42px; }
.sign-table.half .root{ min-width:55px; height:22px; font-size:.56rem; }
/* Extrémités de la ligne f(x) : gauche -> droite ; droite -> gauche */


/* Si tu utilises .half ou .pdf-large, on réaffirme pareil */
.sign-table.half tbody tr:nth-child(2) td.int:first-of-type{ text-align:right !important; }
.sign-table.half tbody tr:nth-child(2) td.int:last-of-type { text-align:left  !important; }
.pdf-large.sign-table tbody tr:nth-child(2) td.int:first-of-type{ text-align:right !important; }
.pdf-large.sign-table tbody tr:nth-child(2) td.int:last-of-type { text-align:left  !important; }
/* Table des deux solutions x1/x2 */
.table.sol2 { table-layout:fixed; width:100% }
.table.sol2 col { width:50% }
.table.sol2 th, .table.sol2 td { padding:12px 18px; vertical-align:top }

/* Chaque ligne de calcul : vrai bloc, marge verticale visible */
.table.sol2 .line mjx-container { 
  margin:6px 0 0 !important;    /* espace réel autour de la fraction */
}

	  
	 </style>  


function signTableHTML(st){
  return [
  '<div class="signwrap">',
    '<table id="signTable" class="sign-table" aria-label="Tableau de signe">',
      '<colgroup>',
        '<col class="col-lbl">',
        '<col class="col-int">',
        '<col class="col-zero">',
        '<col class="col-int">',
        '<col class="col-zero">',
        '<col class="col-int">',
      '</colgroup>',
      '<tbody>',
        '<tr>',
          '<th class="lbl">\\(x\\)</th>',
          '<td class="int cap-left">\\(−∞\\)</td>',
          '<td class="zero">',
            '<div class="cell-inline">',
              '<input id="r1" class="root" placeholder="r₁">',
              '<span id="ok_r1" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="int">',
            '<div class="cell-inline">',
              '<input id="alpha" class="root" placeholder="α">',
              '<span id="ok_alpha" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="zero">',
            '<div class="cell-inline">',
              '<input id="r2" class="root" placeholder="r₂">',
              '<span id="ok_r2" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="int cap-right">\\(+∞\\)</td>',
        '</tr>',
        '<tr>',
          '<th class="lbl">\\(f(x)\\)</th>',
          '<td class="int">',
            '<div class="cell-inline">',
              '<select id="s1" class="sel">',
                '<option value=""></option><option>+</option><option>−</option>',
              '</select>',
              '<span id="ok_s1" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="zero">',
            '<div class="cell-inline">',
              '<select id="z1" class="sel">',
                '<option value=""></option><option>0</option>',
              '</select>',
              '<span id="ok_z1" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="int">',
            '<div class="cell-inline">',
              '<select id="s2" class="sel">',
                '<option value=""></option><option>+</option><option>−</option><option>0</option>',
              '</select>',
              '<span id="ok_s2" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="zero">',
            '<div class="cell-inline">',
              '<select id="z2" class="sel">',
                '<option value=""></option><option>0</option>',
              '</select>',
              '<span id="ok_z2" class="tick nu"></span>',
            '</div>',
          '</td>',
          '<td class="int">',
            '<div class="cell-inline">',
              '<select id="s3" class="sel">',
                '<option value=""></option><option>+</option><option>−</option>',
              '</select>',
              '<span id="ok_s3" class="tick nu"></span>',
            '</div>',
          '</td>',
        '</tr>',
      '</tbody>',
    '</table>',
  '</div>'
  ].join('');
}
	 
avec que alpha :

function signTableHTML(){
  return [
    '<div class="signwrap">',
    '<table id="signTable" class="sign-table" aria-label="Tableau de signe (sans r1/r2)">',
      '<colgroup>',
        '<col class="col-lbl"><col class="col-int"><col class="col-int"><col class="col-int">',
      '</colgroup>',
      '<tbody>',
        '<tr>',
          '<th class="lbl">\\(x\\)</th>',
          '<td class="int cap-left">\\(−∞\\)</td>',
          '<td class="int"><div class="cell-inline"><input id="alpha" class="root" placeholder=""></div></td>',
          '<td class="int cap-right">\\(+∞\\)</td>',
        '</tr>',
        '<tr>',
          '<th class="lbl">\\(f(x)\\)</th>',
          '<td class="int"><div class="cell-inline"><select id="s1" class="sel"><option value=""></option><option>+</option><option>−</option></select></div></td>',
'<td class="zero">',
            '<div class="cell-inline">',
              '<select id="z1" class="sel">',
                '<option value=""></option><option>0</option>',
              '</select>',
              '<span id="ok_z1" class="tick nu"></span>',
            '</div>',
          '</td>',          '<td class="int"><div class="cell-inline"><select id="s3" class="sel"><option value=""></option><option>+</option><option>−</option></select></div></td>',
        '</tr>',
      '</tbody>',
    '</table>',
    '</div>'
  ].join('');
}	 