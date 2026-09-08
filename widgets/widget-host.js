(() => {
  const badges = document.createElement('div'); badges.className = 'widget-badges';
  document.body.append(badges);
  let dialog = null, cleanup = null, opener = null, activeId = null;
  function close() {
    if (!dialog) return;
    cleanup?.(); cleanup=null;
    dialog.close(); dialog.remove(); dialog=null; activeId=null;
    if (opener?.isConnected) opener.focus();
  }
  function open(definition, button) {
    close(); opener=button; activeId=definition.id;
    dialog=document.createElement('dialog'); dialog.className='widget-dialog';
    dialog.setAttribute('aria-labelledby','widget-title');
    const header=document.createElement('header'); header.className='widget-header';
    const title=document.createElement('h2'); title.id='widget-title'; title.textContent=definition.title;
    const dismiss=document.createElement('button'); dismiss.className='widget-close'; dismiss.type='button'; dismiss.textContent='×'; dismiss.setAttribute('aria-label','Close interactive widget');
    header.append(title,dismiss);
    const body=document.createElement('div'); body.className='widget-body';
    const resize=document.createElement('button'); resize.type='button'; resize.className='widget-resize'; resize.setAttribute('aria-label','Resize widget (use arrow keys)');
    dialog.append(header,body,resize); document.body.append(dialog);
    dismiss.addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{ event.preventDefault(); close(); });
    // Keep widget shortcuts and typing out of the reader's page-turn handler.
    dialog.addEventListener('keydown',event=>event.stopPropagation());
    dialog.showModal();
    cleanup=definition.mount(body);
    dialog.style.left=`${Math.max(6,(innerWidth-dialog.offsetWidth)/2)}px`;
    dialog.style.top=`${Math.max(6,Math.min(60,(innerHeight-dialog.offsetHeight)/2))}px`;
    const panel=dialog;
    function constrain() {
      panel.style.left=`${Math.max(6,Math.min(parseFloat(panel.style.left)||6,innerWidth-panel.offsetWidth-6))}px`;
      panel.style.top=`${Math.max(6,Math.min(parseFloat(panel.style.top)||6,innerHeight-panel.offsetHeight-6))}px`;
    }
    let gesture=null;
    function start(event, mode) {
      if (event.target.closest('.widget-close') || event.button!==0) return;
      const rect=panel.getBoundingClientRect();
      gesture={id:event.pointerId,mode,x:event.clientX,y:event.clientY,rect};
      event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
    }
    header.addEventListener('pointerdown',event=>start(event,'drag'));
    resize.addEventListener('pointerdown',event=>start(event,'resize'));
    panel.addEventListener('pointermove',event=>{
      if (!gesture || event.pointerId!==gesture.id) return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,r=gesture.rect;
      if(gesture.mode==='drag') { panel.style.left=`${r.left+dx}px`; panel.style.top=`${r.top+dy}px`; }
      else { panel.style.width=`${Math.max(280,Math.min(innerWidth-r.left-6,r.width+dx))}px`; panel.style.height=`${Math.max(180,Math.min(innerHeight-r.top-6,r.height+dy))}px`; }
      constrain();
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture']) panel.addEventListener(name,()=>{gesture=null;});
    resize.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const rect=panel.getBoundingClientRect();
      if(event.key==='ArrowLeft'||event.key==='ArrowRight') panel.style.width=`${Math.max(280,Math.min(innerWidth-12,rect.width+(event.key==='ArrowRight'?20:-20)))}px`;
      else panel.style.height=`${Math.max(180,Math.min(innerHeight-12,rect.height+(event.key==='ArrowDown'?20:-20)))}px`;
      constrain();
    });
    const observer=new ResizeObserver(constrain); observer.observe(panel);
    const widgetCleanup=cleanup;
    cleanup=()=>{observer.disconnect();widgetCleanup?.();};
  }
  window.addEventListener('journal:view', event => {
    const {pages, canvases, hidden=false}=event.detail;
    if(hidden) { badges.hidden=true; close(); return; }
    badges.hidden=false; badges.replaceChildren();
    const definitions=window.JournalWidgets || [];
    if(activeId && !definitions.find(d=>d.id===activeId)?.pages.some(p=>pages.includes(p))) close();
    // `pages` says when a modal remains relevant; `badge` is the one
    // deliberate, non-spoiling entry point in that chapter.  Do not duplicate
    // an Explore control simply because its chapter spans several spreads.
    definitions.forEach(definition => {
      const badge = definition.badge || { page: definition.pages[0], y: definition.y, offsetY: definition.offsetY };
      const index = pages.indexOf(badge.page);
      if (index < 0) return;
      {
        const rect=canvases[index].getBoundingClientRect();
        const button=document.createElement('button'); button.type='button'; button.className='widget-badge';
        const icon=document.createElement('span'); icon.textContent='▷'; icon.setAttribute('aria-hidden','true');
        button.append(icon,'Explore'); button.title=definition.title;
        button.setAttribute('aria-label',`Explore ${definition.title}`);
        // Match the Solution and Errata gutter column exactly: page side
        // selects the inside spread gutter, and single-page mode uses its
        // outer-page column.
        const x=pages.length===2 ? (index===0 ? rect.right-50 : rect.left-4) : rect.right-64;
        button.style.left=`${x}px`;
        button.style.top=`${Math.min(rect.bottom-60,rect.top+rect.height*badge.y+(badge.offsetY||0))}px`;
        button.addEventListener('click',()=>open(definition,button)); badges.append(button);
      }
    });
  });
})();
