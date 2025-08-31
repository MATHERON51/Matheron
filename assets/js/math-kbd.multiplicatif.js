async function convertSvgsForWord(html){
  // Largeur utile Word "marges normales" ≈ 159,2 mm -> on fixe 158 mm
  const MM = 158;
  const PX_ATTR = Math.round(MM * (96/25.4));   // attribut width HTML en px pour Word (~597)

  try{
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // --- corrections math avant conversion ---
    normalizeMathTextForWord(doc);      // ÷ -> /, espaces
    stackFractionsAcrossNodes(doc);     // 9/8 -> pile (inline)
    wrapMathBlocksForWord(doc);         // .equ / .math / .expr -> tableau 1×1

    // --- conversion SVG -> PNG haute qualité avec largeur fixe ---
    const svgs = Array.from(doc.querySelectorAll('svg'));
    await Promise.all(svgs.map(async (svg)=>{
      let xml = new XMLSerializer().serializeToString(svg);
      // épaissit un peu les traits
      xml = xml.replace(/stroke-width\s*=\s*"([0-9]*\.?[0-9]+)"/g, (m,v)=>`stroke-width="${(parseFloat(v)*1.2).toFixed(2)}"`);
      xml = xml.replace(/stroke-width\s*:\s*([0-9]*\.?[0-9]+)/g,  (m,v)=>`stroke-width:${(parseFloat(v)*1.2).toFixed(2)}`);

      // hauteur : déduite du viewBox pour garder le ratio
      let ratio = 0.12;
      const vb = svg.getAttribute('viewBox');
      if(vb){
        const p = vb.trim().split(/\s+/).map(Number);
        if(p.length===4 && p[2]>0 && p[3]>0) ratio = p[3]/p[2];
      }
      const W = Math.max(600, Math.round(MM * 300/25.4)); // ~1866 px (≈300 dpi sur 158mm)
      const H = Math.max(120, Math.round(W * ratio));

      const png = await svgStringToPng(xml, W, H);
      const img = doc.createElement('img');
      img.src = png;
      img.style.cssText = `width:${MM}mm;height:auto;display:block`;
      img.setAttribute('width', String(PX_ATTR));
      svg.replaceWith(img);
    }));

    // Règle de sécurité : aucune largeur 100% ne doit ré-étirer les images
    const style = doc.createElement('style');
    style.textContent = `.sol-graph img,.sol-steps img,.graph img{width:${MM}mm !important;height:auto !important;display:block}`;
    (doc.head||doc.documentElement).appendChild(style);

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }catch(e){
    console.warn('[exo-pdf-kit] convertSvgsForWord fallback', e);
    return html;
  }
}
