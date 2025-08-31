/*!
 * MathKbd v1.0 – Clavier mathématique réutilisable
 * – Insertion au curseur dans l’input/textarea focalisé
 * – Auto-mount sur tout élément [data-math-kbd]
 * – Pas de -oo / +oo (on garde les symboles ∞)
 */
(function(global){
  "use strict";

  const GROUPS = [
    {name:"Usuels", keys:[
      {label:"≤", txt:"≤"}, {label:"≥", txt:"≥"}, {label:"≠", txt:"≠"}, {label:"≈", txt:"≈"}, {label:"±", txt:"±"},
      {label:"√", txt:"√()", caretFromEnd:1}, {label:"^", txt:"^"}, {label:"π", txt:"π"}, {label:"°", txt:"°"}
    ]},
    {name:"Ensembles", keys:[
      {label:"ℝ", txt:"ℝ"}, {label:"ℕ", txt:"ℕ"}, {label:"ℤ", txt:"ℤ"}, {label:"ℚ", txt:"ℚ"}, {label:"ℂ", txt:"ℂ"},
      {label:"∅", txt:"∅"}, {label:"∈", txt:"∈"}, {label:"∉", txt:"∉"},
      {label:"⊂", txt:"⊂"}, {label:"⊆", txt:"⊆"}, {label:"⊄", txt:"⊄"}, {label:"⊇", txt:"⊇"}
    ]},
    {name:"Intervalles", keys:[
      {label:"[", txt:"["}, {label:"]", txt:"]"}, {label:";", txt:";"}, {label:"∩", txt:"∩"}, {label:"∪", txt:"∪"},
      {label:"−∞", txt:"−∞"}, {label:"+∞", txt:"+∞"}
    ]},
    {name:"Comparaisons", keys:[
      {label:"<", txt:"<"}, {label:"≤", txt:"≤"}, {label:">", txt:">"}, {label:"≥", txt:"≥"}, {label:"=", txt:"="}
    ]},
    {name:"Divers", keys:[
      {label:"|x|", txt:"||", caretFromEnd:1}, {label:"·", txt:"·"}, {label:"×", txt:"×"}, {label:"÷", txt:"÷"},
      {label:"→", txt:"→"}, {label:"⇔", txt:"⇔"}
    ]}
  ];

  let ACTIVE_INPUT = null;
  function setActiveInput(el){ ACTIVE_INPUT = el; }

  function insertAtCursor(el, text, caretFromEnd=0){
    if(!el) return;
    el.focus();
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0,start);
    const after  = el.value.slice(end);
    el.value = before + text + after;
    const pos = before.length + text.length - (caretFromEnd||0);
    el.setSelectionRange(pos, pos);
    el.dispatchEvent(new Event('input', {bubbles:true}));
  }

  function action(el, act){
    if(!el) return;
    if(act==="backspace"){
      const s = el.selectionStart, e = el.selectionEnd;
      if(s!==e){ insertAtCursor(el,""); }
      else if(s>0){ el.setSelectionRange(s-1,e); insertAtCursor(el,""); }
    } else if(act==="space"){
      insertAtCursor(el," ");
    } else if(act==="left"){
      const p = (el.selectionStart||0)-1; el.setSelectionRange(Math.max(0,p),Math.max(0,p)); el.focus();
    } else if(act==="right"){
      const p = (el.selectionEnd||0)+1; el.setSelectionRange(p,p); el.focus();
    } else if(act==="clear"){
      el.value=""; el.focus();
      el.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }

  function buildKeyboard(container, groups=GROUPS){
    const root = document.createElement('div');
    root.className = 'math-kbd';

    const head = document.createElement('div');
    head.className = 'math-kbd-head';
    head.innerHTML = '<strong>Clavier math</strong> <span class="small">Clique pour insérer au curseur</span>';
    root.appendChild(head);

    const tabs = document.createElement('div'); tabs.className = 'math-kbd-tabs';
    root.appendChild(tabs);

    const panels = document.createElement('div');
    root.appendChild(panels);

    groups.forEach((grp, idx)=>{
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'math-kbd-tab' + (idx===0?' active':''); tab.textContent = grp.name;
      tabs.appendChild(tab);

      const grid = document.createElement('div');
      grid.className = 'math-kbd-grid' + (idx===0?' active':'');
      grp.keys.forEach(k=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'math-kbd-btn' + ((k.txt==="||"||k.txt==="^")?' mono':'');
        b.textContent = k.label;
        b.addEventListener('click', ()=>{
          const el = ACTIVE_INPUT || document.querySelector('input[type="text"]:focus, textarea:focus');
          insertAtCursor(el, k.txt, k.caretFromEnd||0);
        });
        grid.appendChild(b);
      });
      panels.appendChild(grid);

      tab.addEventListener('click', ()=>{
        root.querySelectorAll('.math-kbd-tab').forEach(x=>x.classList.remove('active'));
        tab.classList.add('active');
        root.querySelectorAll('.math-kbd-grid').forEach(x=>x.classList.remove('active'));
        grid.classList.add('active');
      });
    });

    const foot = document.createElement('div'); foot.className='math-kbd-foot';
    foot.innerHTML = `
      <button type="button" class="math-kbd-btn" data-act="backspace">⌫</button>
      <button type="button" class="math-kbd-btn" data-act="space">Espace</button>
      <button type="button" class="math-kbd-btn" data-act="left">◀</button>
      <button type="button" class="math-kbd-btn" data-act="right">▶</button>
      <button type="button" class="math-kbd-btn" data-act="clear">Effacer</button>
    `;
    root.appendChild(foot);
    foot.querySelectorAll('[data-act]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const el = ACTIVE_INPUT || document.querySelector('input[type="text"]:focus, textarea:focus');
        action(el, btn.dataset.act);
      });
    });

    container.appendChild(root);
  }

  function mount(where, options={}){
    const el = (typeof where==='string') ? document.querySelector(where) : where;
    if(!el) return;
    buildKeyboard(el, options.groups || GROUPS);
  }

  function autoMount(options={}){
    document.querySelectorAll('[data-math-kbd]').forEach(el=> mount(el, options));
  }

  document.addEventListener('focusin', (e)=>{
    const t = e.target;
    if(t && ((t.tagName==="INPUT" && t.type==="text") || t.tagName==="TEXTAREA")){
      setActiveInput(t);
    }
  });

  global.MathKbd = { mount, autoMount, defaultGroups: GROUPS };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> autoMount());
  } else {
    autoMount();
  }
})(window);
