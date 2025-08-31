
// MatHeron — Patch 2025-08-13
// - Fix: define repereSkewSVGBounds (used by exos 8 & 9)
// - Grid lines black (not bold) for repères 6–9
// - Axes with arrow heads via marker-end
// - Unicode minus (U+2212) normalization on coordinates in exos 1–3
// - Ensure enoncés-only PDF contains repères by leaving SVGs inside statements when possible

(function(){
  'use strict';

  // ---------- Utilities
  function uMinus(s){
    // Replace hyphen-minus before digits with Unicode minus — conservative (doesn't touch subtraction in variables)
    return String(s).replace(/(^|[^\w])-(\d)/g, function(_, p1, d){ return p1 + '\u2212' + d; });
  }
  function fmtNum(n){
    if (typeof n === 'number') {
      if (Object.is(n, -0)) n = 0; // avoid "-0"
      return n < 0 ? '\u2212' + Math.abs(n) : String(n);
    }
    return uMinus(n);
  }

  // Monkey-patch a global formatter if present
  if (typeof window.fmtNumberHTML === 'function') {
    const _old = window.fmtNumberHTML;
    window.fmtNumberHTML = function(){
      const out = _old.apply(this, arguments);
      return uMinus(out);
    };
  }

  // Normalize minus in exercises 1..3 once DOM is ready
  function normalizeMinusInCoords(){
    try{
      const roots = Array.from(document.querySelectorAll('[data-exo-id="1"],[data-exo-id="2"],[data-exo-id="3"],.exo-1,.exo-2,.exo-3'));
      roots.forEach(root => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        const texts = [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        texts.forEach(node => {
          const rep = uMinus(node.nodeValue);
          if (rep !== node.nodeValue) node.nodeValue = rep;
        });
      });
    }catch(e){ /* silent */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeMinusInCoords);
  } else normalizeMinusInCoords();

  // ---------- SVG helpers
  function makeSVG(tag, attrs){
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) {
      if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  function gridAndAxesSVG({xmin, xmax, ymin, ymax, norme=false, showGrid=true, showAxes=true}){
    // Pixel size baseline
    let W = 520, H = 360;
    const spanX = xmax - xmin;
    const spanY = ymax - ymin;
    let sx = W / spanX, sy = H / spanY;
    if (norme){
      const s = Math.min(sx, sy);
      sx = sy = s;
      W = Math.round(spanX * s);
      H = Math.round(spanY * s);
    }
    const X = x => (x - xmin) * sx;
    const Y = y => H - (y - ymin) * sy;

    const svg = makeSVG('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'repere', 'aria-label': 'repère' });
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // defs: arrow marker
    const defs = makeSVG('defs', {});
    const marker = makeSVG('marker', {
      id: 'arrow-ax',
      markerWidth: 8,
      markerHeight: 8,
      refX: 6,
      refY: 4,
      orient: 'auto-start-reverse',
      markerUnits: 'strokeWidth'
    });
    const path = makeSVG('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#000' });
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Grid
    if (showGrid){
      const gGrid = makeSVG('g', { class: 'grid' });
      // black thin lines (not bold)
      const x0 = Math.ceil(xmin), x1 = Math.floor(xmax);
      for(let x=x0; x<=x1; x++){
        const v = makeSVG('line', { x1: X(x), y1: Y(ymin), x2: X(x), y2: Y(ymax), stroke: '#000', 'stroke-width': 1, 'shape-rendering': 'crispEdges' });
        gGrid.appendChild(v);
      }
      const y0 = Math.ceil(ymin), y1 = Math.floor(ymax);
      for(let y=y0; y<=y1; y++){
        const h = makeSVG('line', { x1: X(xmin), y1: Y(y), x2: X(xmax), y2: Y(y), stroke: '#000', 'stroke-width': 1, 'shape-rendering': 'crispEdges' });
        gGrid.appendChild(h);
      }
      svg.appendChild(gGrid);
    }

    // Axes
    if (showAxes){
      const gAx = makeSVG('g', { class: 'axes' });
      // x-axis if 0 in [ymin,ymax]
      if (ymin <= 0 && 0 <= ymax){
        const lx = makeSVG('line', {
          x1: X(xmin), y1: Y(0), x2: X(xmax), y2: Y(0),
          stroke: '#000', 'stroke-width': 1.5, 'marker-end': 'url(#arrow-ax)'
        });
        gAx.appendChild(lx);
      }
      // y-axis if 0 in [xmin,xmax]
      if (xmin <= 0 && 0 <= xmax){
        const ly = makeSVG('line', {
          x1: X(0), y1: Y(ymin), x2: X(0), y2: Y(ymax),
          stroke: '#000', 'stroke-width': 1.5, 'marker-end': 'url(#arrow-ax)'
        });
        gAx.appendChild(ly);
      }
      svg.appendChild(gAx);
    }

    // Origin dot
    if (xmin <= 0 && 0 <= xmax && ymin <= 0 && 0 <= ymax){
      const O = makeSVG('circle', { cx: X(0), cy: Y(0), r: 2.5, fill: '#000' });
      svg.appendChild(O);
    }

    // Nice border (thin)
    const border = makeSVG('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: '#000', 'stroke-width': 0.6 });
    svg.appendChild(border);

    return {svg, X, Y, W, H, sx, sy, xmin, xmax, ymin, ymax};
  }

  // ---------- Public function used by exos 8/9
  // Keep the exact requested name to fix "not defined"
  window.repereSkewSVGBounds = function(opts){
    const {
      xmin=-10, xmax=10, ymin=-6, ymax=6,
      norme=false, includeGrid=true, includeAxes=true
    } = (opts||{});

    const rep = gridAndAxesSVG({ xmin, xmax, ymin, ymax, norme, showGrid: includeGrid, showAxes: includeAxes });
    return rep.svg;
  };

  // ---------- Ensure repères exist inside statements for PDF "énoncés seuls"
  function ensureRepereInStatements(){
    try{
      const exoSelectors = [
        '[data-exo-id="6"]','[data-exo-id="7"]','[data-exo-id="8"]','[data-exo-id="9"]',
        '.exo-6','.exo-7','.exo-8','.exo-9'
      ];
      document.querySelectorAll(exoSelectors.join(',')).forEach(exo => {
        const statement = exo.querySelector('.statement, .equ');
        if (!statement) return;
        const already = statement.querySelector('svg.repere');
        if (already) return;
        const anyRep = exo.querySelector('svg.repere');
        if (anyRep){
          // clone into statement for PDF capture
          statement.insertBefore(anyRep.cloneNode(true), statement.firstChild);
        }
      });
    }catch(e){ /* silent */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureRepereInStatements);
  } else ensureRepereInStatements();

  // ---------- Style tweak (grid black, not bold)
  const style = document.createElement('style');
  style.textContent = `
    svg.repere .grid line { stroke:#000 !important; stroke-width:1 !important; }
    svg.repere .axes line { stroke:#000 !important; }
  `;
  document.documentElement.appendChild(style);

})();
