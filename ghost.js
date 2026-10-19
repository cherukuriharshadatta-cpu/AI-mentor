/* Ghost Tutor: opt-in DOM spotlight. No page edits, no network requests. */
(function () {
  'use strict';
  let layer, shadow, box, beam, label, target = null, snippet = '', active = false;
  function mount() {
    if (layer) return;
    layer = document.createElement('div');
    layer.id = 'bob-ghost-layer';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;overflow:hidden;';
    shadow = layer.attachShadow({mode:'closed'});
    shadow.innerHTML = `<style>
      :host{all:initial}*{box-sizing:border-box}
      .spot{position:fixed;border:2px solid #f18a59;border-radius:10px;background:rgba(241,138,89,.10);box-shadow:0 0 0 5px rgba(241,138,89,.13),0 0 36px rgba(241,138,89,.35);transition:top .12s,left .12s,width .12s,height .12s;animation:glow 1.6s ease-in-out infinite alternate}
      .tag{position:fixed;background:#2b201c;color:#ffd1aa;border:1px solid #f18a59;border-radius:8px;padding:5px 9px;font:600 12px system-ui,sans-serif;max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      svg{position:fixed;inset:0;width:100%;height:100%;overflow:visible}
      path{fill:none;stroke:#f18a59;stroke-width:3;stroke-dasharray:10 8;animation:travel .8s linear infinite;filter:drop-shadow(0 0 5px #ef9468)}
      @keyframes travel{to{stroke-dashoffset:-36}}@keyframes glow{to{box-shadow:0 0 0 9px rgba(241,138,89,.10),0 0 42px rgba(241,138,89,.5)}}
      @media(prefers-reduced-motion:reduce){path,.spot{animation:none}}
    </style><svg aria-hidden="true"><path id="beam"/></svg><div class="spot" id="spot"></div><div class="tag" id="tag">Ghost Tutor · inspecting</div>`;
    box=shadow.getElementById('spot'); beam=shadow.getElementById('beam'); label=shadow.getElementById('tag');
    document.documentElement.appendChild(layer);
  }
  function eligible(el){return el instanceof Element && !el.closest('#bob-host,#bob-ghost-layer') && !el.closest('input,textarea,[contenteditable="true"]') && !!el.getClientRects().length;}
  function rect(el){const r=el.getBoundingClientRect();return r.width>8&&r.height>5&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth?r:null;}
  function pick() {
    const s=window.getSelection();
    if(s && !s.isCollapsed && s.toString().trim()) {
      let node=s.anchorNode; const el=node?.nodeType===1?node:node?.parentElement;
      if(eligible(el)) return {el, text:s.toString().trim()};
    }
    const selectors=['pre','[class*="code-block"]','[data-testid*="code"]','article pre','main code','main article','main h1','main h2','h1','h2','main p'];
    let best=null, score=-Infinity;
    for(const selector of selectors)for(const el of document.querySelectorAll(selector)) {
      if(!eligible(el))continue;
      const r=rect(el); if(!r)continue;
      const txt=(el.innerText||el.textContent||'').trim();if(txt.length<8)continue;
      const visible=Math.min(r.bottom,innerHeight)-Math.max(r.top,0);
      const bonus=/^(PRE|CODE)$/.test(el.tagName)?600:0;
      const n=bonus+Math.min(txt.length,500)+visible/3-Math.abs((r.top+r.bottom)/2-innerHeight/2)/2;
      if(n>score){score=n;best={el,text:txt};}
    }
    return best;
  }
  function update() {
    if(!active||!target)return;
    if(!target.isConnected){clear();return;}
    const r=rect(target);if(!r){layer.style.visibility='hidden';return;}
    layer.style.visibility='visible';
    const margin=4;
    Object.assign(box.style,{left:(r.left-margin)+'px',top:(r.top-margin)+'px',width:(r.width+margin*2)+'px',height:(r.height+margin*2)+'px'});
    label.style.left=Math.max(8,Math.min(innerWidth-220,r.left))+'px';label.style.top=Math.max(5,r.top-34)+'px';
    const buddy=document.querySelector('#bob-host');
    let origin=buddy?.shadowRoot?.getElementById('bubble')?.getBoundingClientRect();
    const panel=buddy?.shadowRoot?.getElementById('panel');
    if(panel && getComputedStyle(panel).display!=='none')origin=panel.getBoundingClientRect();
    if(!origin){beam.setAttribute('d','');return;}
    const x1=origin.left+Math.min(origin.width/2,40),y1=origin.top+Math.min(origin.height/2,50);
    const x2=Math.max(r.left,Math.min(x1,r.right)),y2=Math.max(r.top,Math.min(y1,r.bottom));
    const bend=(x1+x2)/2;
    beam.setAttribute('d',`M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}`);
  }
  function inspect(){const p=pick();if(!p)return null; mount();target=p.el;snippet=p.text.slice(0,5000);active=true;update();return snippet;}
  function clear(){active=false;target=null;snippet='';if(layer){layer.remove();layer=null;}}
  const updatePassive=()=>{if(active)update();};
  window.addEventListener('scroll',updatePassive,true);
  window.addEventListener('resize',updatePassive);
  document.addEventListener('visibilitychange',updatePassive);
  window.BobGhost={inspect,clear,update, getContext:()=>active?snippet:'', isActive:()=>active};
})();
