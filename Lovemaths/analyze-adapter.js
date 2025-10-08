<script>
// ===== Utils (mêmes conventions que MatHeron) =====
const INF_POS = "+∞", INF_NEG = "−∞";
const isInf = v => v===null || v===undefined;

// Convertit valeurs API vers ton affichage (±∞, LaTeX-friendly)
function fmtVal(v){
  if(v===null || v===undefined) return "";
  if(v==="+oo" || v==="+∞") return INF_POS;
  if(v==="-oo" || v==="−∞") return INF_NEG;
  // empêche "--" visuel
  return String(v).replace(/--/g,"+");
}
function fmtEdge(a, openLeft){
  const A = isInf(a)? INF_NEG : String(a).replace(/\.0$/,"");
  return (openLeft? "]":"[") + A;
}
function fmtEdgeR(b, openRight){
  const B = isInf(b)? INF_POS : String(b).replace(/\.0$/,"");
  return B + (openRight? "[":"]");
}

// ===== 1) Variation: API -> modèle pour ton tableau (avec colonnes fantômes) =====
// Règles demandées :
// - Une seule double barre par discontinuité / bord interne de domaine
// - Crée une colonne fantôme à G et/ou D de la double barre pour afficher lim_left / lim_right
// - Si x_min/x_max: pas de double barre auto (sauf si tu la coches explicitement côté énoncé)
// - Un seul "0" aligné au dessus de la DOUBLE BARRE quand il y a 0 (option "barre verticale 0")
function buildVariationModel(api){
  // api.variation est une liste de composantes du domaine : {a,b,open_left,open_right,lim_left,lim_right,monotonic,extrema,bars}
  // On la transforme en colonnes pour ton "tableVariation"
  // Sortie: { columns:[...], rows:{x:..., lim:..., fp:..., var:...} } que tu passes à ton rendu
  const columns = [];
  const rowX     = [];
  const rowLim   = [];
  const rowSignD = []; // signe de f'(x)
  const rowVar   = []; // libellé "croissante/…"
  const dbl = (idx) => ({type:"sep", style:"double"});      // double barre
  const ghost = side => ({type:"ghost", side});             // colonne fantôme (aucun x affiché)
  const mono = sym => ({type:"sym", sym});                  // symbole genre "0" au bon endroit

  // Petite aide : signe f'(x) → "+" / "−" / "0"
  const fpSign = m => m==="croissante"?"+":(m==="decroissante"?"−":"0");

  api.variation.forEach((seg,i)=>{
    const {a,b,open_left,open_right,lim_left,lim_right,monotonic,bars} = seg;

    // 1) Colonne fantôme G, avec limite gauche (si fournie)
    // (cas général : à gauche d'une double barre interne OU si la borne gauche est une rupture)
    if(lim_left){
      columns.push( ghost("left") );
      rowX.push(""); // pas de x dans la fantôme
      rowLim.push( fmtVal(lim_left) );
      rowSignD.push("");
      rowVar.push("");
    }

    // 2) Double barre interne si nécessaire (tu peux raffiner avec ta logique : zéros de dénominateur, asymptote verticale, etc.)
    // Ici: bars.double du serveur est faux par défaut; si tu as la logique côté client, décide selon la structure du domaine:
    const needDouble = !!bars.double; // ou: (i>0 && !isInf(a)) || (i<api.variation.length-1 && !isInf(b))
    if(needDouble){
      columns.push( dbl() );
      // "0" au-dessus de la double barre si tu veux matérialiser l'axe (option)
      rowX.push("0");       // <- Si tu ne veux PAS de 0 systématique, remplace par "" et gère ton case "barre verticale 0"
      rowLim.push("");      // la double barre n'affiche pas de limite elle-même
      rowSignD.push("");
      rowVar.push("");
    }

    // 3) Colonne INTERVALLE [a ; b]
    columns.push({
      type:"interval",
      a: isInf(a)? INF_NEG : a,
      b: isInf(b)? INF_POS : b,
      openLeft: !!open_left,
      openRight: !!open_right,
      monotonic,
    });
    rowX.push(`${fmtEdge(a,open_left)} ; ${fmtEdgeR(b,open_right)}`);
    rowLim.push(`${fmtVal(lim_left)||""} → ${fmtVal(lim_right)||""}`);
    rowSignD.push(fpSign(monotonic));
    rowVar.push(monotonic);

    // 4) Colonne fantôme D, avec limite droite (si fournie)
    if(lim_right){
      columns.push( ghost("right") );
      rowX.push("");
      rowLim.push( fmtVal(lim_right) );
      rowSignD.push("");
      rowVar.push("");
    }
  });

  return {
    columns,
    rows: {
      x: rowX,
      lim: rowLim,
      fp: rowSignD,
      var: rowVar
    }
  };
}

// ===== 2) Rendu minimal (si tu veux vérifier sans toucher à ton composant)
function renderVariationInto(host, model){
  // Si tu as déjà tableVariation(model), appelle-la ici et supprime ce rendu de secours.
  const tbl = document.createElement('table');
  tbl.className = 'table';
  const trX = document.createElement('tr');
  const trL = document.createElement('tr');
  const trF = document.createElement('tr');
  const trV = document.createElement('tr');
  trX.innerHTML = `<td><b>x</b></td>`;
  trL.innerHTML = `<td><b>limites</b></td>`;
  trF.innerHTML = `<td><b>f'(x)</b></td>`;
  trV.innerHTML = `<td><b>variations</b></td>`;

  model.columns.forEach((col, i)=>{
    if(col.type==="sep"){
      const td = `<td class="dbl"></td>`;
      trX.innerHTML += td; trL.innerHTML += td; trF.innerHTML += td; trV.innerHTML += td;
    }else{
      trX.innerHTML += `<td>${model.rows.x[i]??""}</td>`;
      trL.innerHTML += `<td>${model.rows.lim[i]??""}</td>`;
      trF.innerHTML += `<td>${model.rows.fp[i]??""}</td>`;
      trV.innerHTML += `<td>${model.rows.var[i]??""}</td>`;
    }
  });
  tbl.append(trX,trL,trF,trV);
  host.innerHTML = '';
  host.appendChild(tbl);
}

// ===== 3) Domaine (union d'intervalles) — même formatage que tes fiches
function renderDomainText(domain_intervals){
  return domain_intervals.map(([a,b,openL,openR])=>{
    const L = openL? "]":"[";
    const R = openR? "[":"]";
    const A = isInf(a)? INF_NEG : String(a).replace(/\.0$/,"");
    const B = isInf(b)? INF_POS : String(b).replace(/\.0$/,"");
    return `${L}${A} ; ${B}${R}`;
  }).join(" ∪ ");
}

// ===== 4) Graphe : tu as déjà drawGraph(...). Voici deux options :
// (A) Tu veux tracer à partir de l'expression (comme avant) → garde ta logique.
// (B) Tu veux tracer "échantillons API" (évite les V.A.) → polyline simple :
function plotFromSamples(mount, sample){
  // sample = [[x,y], ...]
  const W=620,H=340,m=36; const x0=m,y0=m,w=W-2*m,h=H-2*m;
  const svgNS='http://www.w3.org/2000/svg';
  mount.innerHTML='';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('class','repere');
  // axes simples
  const ax=document.createElementNS(svgNS,'path');
  ax.setAttribute('d',`M ${x0} ${y0+h/2} H ${x0+w} M ${x0+w/2} ${y0} V ${y0+h}`);
  ax.setAttribute('stroke','#888'); ax.setAttribute('fill','none');
  svg.appendChild(ax);
  if(sample.length>1){
    // auto-échelle grossière
    const xs=sample.map(p=>p[0]), ys=sample.map(p=>p[1]);
    const xmin=Math.min(...xs), xmax=Math.max(...xs);
    const ymin=Math.min(...ys), ymax=Math.max(...ys);
    const X = x=> x0 + (x-xmin)/(xmax-xmin||1)*w;
    const Y = y=> y0 + (ymax-y)/(ymax-ymin||1)*h;
    // coupe aux grands sauts (asymptotes)
    const path = [];
    for(let i=0;i<sample.length;i++){
      const [x,y]=sample[i];
      if(i>0){
        const [xp,yp]=sample[i-1];
        if(Math.abs(y-yp)>1e3 || Math.abs(x-xp)>5){ // coupe rudimentaire
          path.push('M',X(x),Y(y));
          continue;
        }
        path.push('L',X(x),Y(y));
      }else{
        path.push('M',X(x),Y(y));
      }
    }
    const pl=document.createElementNS(svgNS,'path');
    pl.setAttribute('d',path.join(' '));
    pl.setAttribute('stroke','black'); pl.setAttribute('fill','none');
    svg.appendChild(pl);
  }
  mount.appendChild(svg);
}

// ===== 5) Colle-tout — à appeler après ton fetch /analyze =====
async function runAnalyzeAndRender(funcStr, intervalStr, mounts){
  // mounts : {domainEl, varEl, graphEl, debugEl}
  const payload = { func: funcStr, interval: intervalStr||null };
  const r = await fetch("/analyze", {method:"POST",headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
  const data = await r.json();

  if(!data.ok){
    mounts.debugEl && (mounts.debugEl.innerHTML = `<div style="color:#b00020">${(data.errors||[]).join("<br>")}</div>`);
    return;
  }
  // Domaine
  if(mounts.domainEl){
    mounts.domainEl.textContent = renderDomainText(data.domain_intervals);
  }
  // Variations (adaptation → ton rendu)
  const model = buildVariationModel(data);
  if(window.tableVariation){               // si tu as déjà ta fonction
    window.tableVariation(mounts.varEl, model);
  }else{
    renderVariationInto(mounts.varEl, model); // rendu de secours
  }
  // Graphe
  if(mounts.graphEl){
    // Option B (échantillons API) :
    plotFromSamples(mounts.graphEl, data.sample);
    // Option A (évaluer f côté client) : appelle plutôt ta drawGraph(...)
  }
  // Rendu LaTeX (jqMath) si présent
  if(window.jQuery && jQuery.fn && jQuery.fn.math) jQuery('body').math();
}

window.MatHeronAnalyzeAdapter = {
  runAnalyzeAndRender, buildVariationModel, renderDomainText, plotFromSamples
};
</script>
